import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { colunasKanban } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

export const colunasRouter = Router();
colunasRouter.use(requireAuth);

colunasRouter.get('/', async (req, res) => {
  const rows = await db.select().from(colunasKanban)
    .where(eq(colunasKanban.imobiliariaId, req.auth!.imobiliariaId))
    .orderBy(asc(colunasKanban.ordem));
  res.json(rows);
});
