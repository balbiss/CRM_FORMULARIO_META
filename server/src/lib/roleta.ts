import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { filasAtendimento, perfis, leads, colunasKanban, distribuicaoLog, notificacoes } from '../db/schema.js';
import { enviarPush } from './push.js';
import type { Server as SocketServer } from 'socket.io';

/** Distribui UM lead pro próximo corretor da roleta (o que está em plantão e faz mais tempo
 *  que não recebe um lead). Retorna o corretorId escolhido, ou null se ninguém está no plantão. */
export async function distribuirLead(io: SocketServer, imobiliariaId: string, leadId: string): Promise<string | null> {
  const candidatos = await db
    .select({ corretorId: filasAtendimento.corretorId })
    .from(filasAtendimento)
    .innerJoin(perfis, eq(perfis.id, filasAtendimento.corretorId))
    .where(and(
      eq(filasAtendimento.imobiliariaId, imobiliariaId),
      eq(perfis.emPlantao, true),
      eq(perfis.bloqueado, false),
    ))
    .orderBy(sql`${filasAtendimento.ultimaAtribuicao} asc nulls first`, asc(filasAtendimento.posicao))
    .limit(1);

  const escolhido = candidatos[0];
  if (!escolhido) return null;

  await db.update(filasAtendimento).set({ ultimaAtribuicao: new Date() })
    .where(eq(filasAtendimento.corretorId, escolhido.corretorId));

  const [lead] = await db.update(leads).set({ corretorId: escolhido.corretorId })
    .where(and(eq(leads.id, leadId), isNull(leads.corretorId))).returning();
  if (!lead) return null; // já tinha corretor / não existe

  await db.insert(distribuicaoLog).values({ imobiliariaId, leadId, corretorId: escolhido.corretorId, origem: 'roleta' });
  await db.insert(notificacoes).values({
    perfilId: escolhido.corretorId,
    tipo: 'lead',
    titulo: 'Novo lead atribuído a você',
    texto: `${lead.nome} caiu na sua carteira pela roleta.`,
    lida: false,
  });

  io.to('imobiliaria:' + imobiliariaId).emit('lead:updated', lead);
  enviarPush(escolhido.corretorId, {
    title: 'Novo lead pra você',
    body: `${lead.nome} caiu na sua carteira. Abra o CRM pra atender.`,
    url: '/kanban',
    tag: 'lead-' + lead.id,
  }).catch(() => {});
  return escolhido.corretorId;
}

/** Distribui todos os leads da coluna "Lead Novo" que ainda estão sem corretor (round-robin).
 *  Chamado quando um corretor entra no plantão — pega o acúmulo que chegou com a equipe offline. */
export async function distribuirPendentes(io: SocketServer, imobiliariaId: string): Promise<number> {
  const [colNovo] = await db.select({ id: colunasKanban.id }).from(colunasKanban)
    .where(and(eq(colunasKanban.imobiliariaId, imobiliariaId), eq(colunasKanban.slug, 'novo'))).limit(1);
  if (!colNovo) return 0;

  const pendentes = await db.select({ id: leads.id }).from(leads)
    .where(and(eq(leads.imobiliariaId, imobiliariaId), eq(leads.colunaId, colNovo.id), isNull(leads.corretorId)))
    .orderBy(asc(leads.criadoEm));

  let n = 0;
  for (const p of pendentes) {
    const r = await distribuirLead(io, imobiliariaId, p.id);
    if (r) n++;
  }
  return n;
}
