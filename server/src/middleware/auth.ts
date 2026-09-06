import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtClaims } from '../lib/jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtClaims;
    }
  }
}

/** Requires a valid JWT. Populates req.auth with {sub, imobiliariaId, role, nome}. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/** Requires req.auth.role to be one of the given roles. Use after requireAuth. */
export function requireRole(...roles: Array<'dono' | 'gerente' | 'corretor'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: 'Não autenticado' });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: 'Sem permissão para esta ação' });
    next();
  };
}
