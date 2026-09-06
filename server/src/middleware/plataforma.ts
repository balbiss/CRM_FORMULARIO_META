import type { Request, Response, NextFunction } from 'express';
import { verifyPlatformToken, type PlatformClaims } from '../lib/jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      plataforma?: PlatformClaims;
    }
  }
}

/** Exige um JWT de administrador da plataforma (dono do SaaS). */
export function requirePlataforma(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  try {
    req.plataforma = verifyPlatformToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
