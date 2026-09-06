import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { verifyToken, type JwtClaims } from '../lib/jwt.js';
import { db } from '../db/client.js';
import { imobiliarias } from '../db/schema.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtClaims;
    }
  }
}

/** Requires a valid JWT AND that the imobiliária is 'ativa'. Populates req.auth.
 *  Imobiliária bloqueada (manual ou por inadimplência) → 403 ACESSO_SUSPENSO em toda request. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente' });

  let claims: JwtClaims;
  try {
    claims = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
  req.auth = claims;

  try {
    const [imob] = await db
      .select({ status: imobiliarias.status, motivo: imobiliarias.bloqueioMotivo })
      .from(imobiliarias)
      .where(eq(imobiliarias.id, claims.imobiliariaId))
      .limit(1);
    if (!imob) return res.status(401).json({ error: 'Imobiliária não encontrada' });
    if (imob.status !== 'ativa') {
      return res.status(403).json({
        error: 'ACESSO_SUSPENSO',
        motivo: imob.motivo === 'inadimplencia' ? 'inadimplencia' : 'manual',
      });
    }
  } catch {
    return res.status(500).json({ error: 'Erro ao validar acesso' });
  }
  next();
}

/** Requires req.auth.role to be one of the given roles. Use after requireAuth. */
export function requireRole(...roles: Array<'dono' | 'gerente' | 'corretor'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: 'Não autenticado' });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: 'Sem permissão para esta ação' });
    next();
  };
}
