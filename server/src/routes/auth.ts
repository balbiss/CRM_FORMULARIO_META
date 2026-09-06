import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { perfis, notificacoes, imobiliarias } from '../db/schema.js';
import { signToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'E-mail ou senha inválidos' });
  const { email, senha } = parsed.data;

  const [perfil] = await db.select().from(perfis).where(eq(perfis.email, email.toLowerCase())).limit(1);
  if (!perfil) return res.status(401).json({ error: 'E-mail ou senha incorretos' });
  if (perfil.bloqueado) return res.status(403).json({ error: 'Acesso bloqueado. Fale com o gerente ou dono.' });

  const [imob] = await db.select({ status: imobiliarias.status, motivo: imobiliarias.bloqueioMotivo })
    .from(imobiliarias).where(eq(imobiliarias.id, perfil.imobiliariaId)).limit(1);
  if (imob && imob.status !== 'ativa') {
    return res.status(403).json({
      error: imob.motivo === 'inadimplencia'
        ? 'Acesso suspenso por pendência de pagamento. Regularize com o suporte da Visita IA para reativar.'
        : 'Acesso suspenso. Fale com o suporte da Visita IA.',
    });
  }

  const ok = await bcrypt.compare(senha, perfil.senhaHash);
  if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos' });

  const token = signToken({ sub: perfil.id, imobiliariaId: perfil.imobiliariaId, role: perfil.role, nome: perfil.nome });
  res.json({
    token,
    perfil: { id: perfil.id, nome: perfil.nome, email: perfil.email, role: perfil.role, emPlantao: perfil.emPlantao },
  });
});

const esqueciSchema = z.object({ email: z.string().email() });

// Sem serviço de e-mail: a solicitação de redefinição vira uma notificação pro Dono/Gerente
// da mesma imobiliária, que redefine a senha do corretor pela tela de Equipe. Resposta sempre
// genérica (não revela se o e-mail existe).
authRouter.post('/esqueci-senha', async (req, res) => {
  const parsed = esqueciSchema.safeParse(req.body);
  if (!parsed.success) return res.json({ ok: true });
  const email = parsed.data.email.toLowerCase();

  const [perfil] = await db.select().from(perfis).where(eq(perfis.email, email)).limit(1);
  if (perfil) {
    const gestores = await db.select({ id: perfis.id }).from(perfis).where(
      and(eq(perfis.imobiliariaId, perfil.imobiliariaId), inArray(perfis.role, ['dono', 'gerente'])),
    );
    const alvos = gestores.filter(g => g.id !== perfil.id);
    if (alvos.length) {
      await db.insert(notificacoes).values(alvos.map(g => ({
        perfilId: g.id,
        tipo: 'senha',
        titulo: 'Pedido de redefinição de senha',
        texto: `${perfil.nome} (${perfil.email}) esqueceu a senha e pediu ajuda para entrar. Redefina em Equipe.`,
        lida: false,
      })));
    }
  }
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const [perfil] = await db.select().from(perfis).where(eq(perfis.id, req.auth!.sub)).limit(1);
  if (!perfil) return res.status(404).json({ error: 'Perfil não encontrado' });
  res.json({ id: perfil.id, nome: perfil.nome, email: perfil.email, role: perfil.role, emPlantao: perfil.emPlantao, telefone: perfil.telefone });
});

const senhaSchema = z.object({
  senhaAtual: z.string().min(1),
  senhaNova: z.string().min(6),
});

authRouter.patch('/senha', requireAuth, async (req, res) => {
  const parsed = senhaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Senha nova precisa ter pelo menos 6 caracteres' });

  const [perfil] = await db.select().from(perfis).where(eq(perfis.id, req.auth!.sub)).limit(1);
  if (!perfil) return res.status(404).json({ error: 'Perfil não encontrado' });

  const ok = await bcrypt.compare(parsed.data.senhaAtual, perfil.senhaHash);
  if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });

  const senhaHash = await bcrypt.hash(parsed.data.senhaNova, 10);
  await db.update(perfis).set({ senhaHash }).where(eq(perfis.id, perfil.id));
  res.json({ ok: true });
});
