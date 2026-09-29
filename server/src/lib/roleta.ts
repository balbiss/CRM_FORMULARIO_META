import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { filasAtendimento, roletas, perfis, leads, colunasKanban, distribuicaoLog, notificacoes, imobiliarias } from '../db/schema.js';
import { enviarPush } from './push.js';
import { registrarEvento } from './eventos.js';
import { dispararGatilhoLeadNovo } from './followup.js';
import type { Server as SocketServer } from 'socket.io';

type Roleta = typeof roletas.$inferSelect;

/** Avisa o corretor por WhatsApp (número central, no celular PESSOAL dele) que um lead novo
 *  caiu pra ele — só quando a imobiliária ligou essa opção. Nunca lança — falha aqui não pode
 *  derrubar a atribuição do lead, que já aconteceu antes desta função ser chamada.
 *
 *  O envio em si NÃO é feito por aqui — só empurra os dados pra um webhook do n8n
 *  (N8N_AVISO_CORRETOR_WEBHOOK_URL), que decide como mandar de verdade. Decisão deliberada:
 *  já tentamos WAHA (bug conhecido devlikeapro/waha#2214, "no LID found" — falha consistente
 *  pra mensagem iniciada pelo sistema) e um serviço Baileys dedicado (crashava de forma
 *  reproduzível logo após o primeiro pareamento) — os dois direto no código do CRM. Botar
 *  essa etapa no n8n permite trocar o motor de envio sem precisar redeployar o backend. */
async function notificarCorretorPorWhatsapp(
  imobiliariaId: string,
  leadId: string,
  corretorId: string,
  roletaId: string,
  lead: { nome: string; telefone: string; email: string | null; campanha: string | null; canal: string },
) {
  try {
    const [imob] = await db.select({ ligado: imobiliarias.notificarCorretorWhatsapp })
      .from(imobiliarias).where(eq(imobiliarias.id, imobiliariaId)).limit(1);
    if (!imob?.ligado) return;

    const webhookUrl = process.env.N8N_AVISO_CORRETOR_WEBHOOK_URL;
    if (!webhookUrl) {
      registrarEvento(imobiliariaId, leadId, 'aviso', 'Webhook de aviso ao corretor não configurado — não deu pra avisar por WhatsApp.', 'Sistema');
      return;
    }

    const [corretor] = await db.select({ nome: perfis.nome, telefone: perfis.telefone }).from(perfis).where(eq(perfis.id, corretorId)).limit(1);
    if (!corretor?.telefone) {
      registrarEvento(imobiliariaId, leadId, 'aviso', 'Corretor sem telefone cadastrado — não deu pra avisar por WhatsApp.', 'Sistema');
      return;
    }

    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imobiliariaId, leadId, corretorId, roletaId,
        corretorNome: corretor.nome, corretorTelefone: corretor.telefone,
        lead: { nome: lead.nome, telefone: lead.telefone, email: lead.email, campanha: lead.campanha, canal: lead.canal },
      }),
    });
    if (!r.ok) throw new Error('webhook n8n -> ' + r.status);
  } catch (e) {
    registrarEvento(imobiliariaId, leadId, 'aviso', 'Erro ao avisar o corretor por WhatsApp: ' + (e as Error).message, 'Sistema');
  }
}

/** Garante que a imobiliária tem pelo menos uma roleta padrão. Retorna o id dela. */
export async function garantirRoletaPadrao(imobiliariaId: string): Promise<string> {
  const [existe] = await db.select({ id: roletas.id }).from(roletas)
    .where(and(eq(roletas.imobiliariaId, imobiliariaId), eq(roletas.padrao, true))).limit(1);
  if (existe) return existe.id;
  const [nova] = await db.insert(roletas).values({ imobiliariaId, nome: 'Geral', padrao: true, ordem: 0 }).returning();
  return nova.id;
}

/** Escolhe a roleta que deve receber o lead, pelas regras de entrada (número > canal > finalidade).
 *  Cai na roleta padrão se nenhuma regra específica casar. */
async function escolherRoleta(
  imobiliariaId: string,
  lead: { canal: string; finalidade: string | null; sessaoWhatsappId: string | null },
): Promise<Roleta | null> {
  const todas = await db.select().from(roletas)
    .where(and(eq(roletas.imobiliariaId, imobiliariaId), eq(roletas.ativa, true)));
  if (!todas.length) return null;

  const casam: { r: Roleta; score: number }[] = [];
  for (const r of todas) {
    if (r.sessaoWhatsappId && r.sessaoWhatsappId !== lead.sessaoWhatsappId) continue;
    const canais = (r.canais as string[]) ?? [];
    if (canais.length && !canais.includes(lead.canal)) continue;
    if (r.finalidade !== 'ambos') {
      if (!lead.finalidade || r.finalidade !== lead.finalidade) continue;
    }
    let score = 0;
    if (r.sessaoWhatsappId) score += 4;
    if (canais.length) score += 2;
    if (r.finalidade !== 'ambos') score += 1;
    casam.push({ r, score });
  }
  casam.sort((a, b) => b.score - a.score || a.r.ordem - b.r.ordem);
  if (casam.length) return casam[0].r;
  return todas.find(r => r.padrao) ?? null;
}

/** Distribui UM lead pro próximo corretor da roleta que o recebe (o que está em plantão e faz
 *  mais tempo que não recebe um lead DESSA roleta). Retorna o corretorId, ou null. */
export async function distribuirLead(io: SocketServer, imobiliariaId: string, leadId: string): Promise<string | null> {
  const [dados] = await db.select({
    canal: leads.canal, finalidade: leads.finalidade, sessaoWhatsappId: leads.sessaoWhatsappId, corretorId: leads.corretorId,
  }).from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!dados || dados.corretorId) return null;

  const roleta = await escolherRoleta(imobiliariaId, dados);
  if (!roleta) return null;

  // No modo "avisar corretor por WhatsApp" (ver notificarCorretorPorWhatsapp abaixo), o
  // corretor nunca abre o CRM — então "em plantão" deixa de fazer sentido como filtro:
  // todo membro da roleta (não bloqueado) é candidato, o tempo todo, em qualquer horário.
  const [imob] = await db.select({ semPlantao: imobiliarias.notificarCorretorWhatsapp })
    .from(imobiliarias).where(eq(imobiliarias.id, imobiliariaId)).limit(1);

  const condicoes = [eq(filasAtendimento.roletaId, roleta.id), eq(perfis.bloqueado, false)];
  if (!imob?.semPlantao) condicoes.push(eq(perfis.emPlantao, true));

  const candidatos = await db
    .select({ corretorId: filasAtendimento.corretorId })
    .from(filasAtendimento)
    .innerJoin(perfis, eq(perfis.id, filasAtendimento.corretorId))
    .where(and(...condicoes))
    .orderBy(sql`${filasAtendimento.ultimaAtribuicao} asc nulls first`, asc(filasAtendimento.posicao))
    .limit(1);

  const escolhido = candidatos[0];
  if (!escolhido) return null;

  await db.update(filasAtendimento).set({ ultimaAtribuicao: new Date() })
    .where(and(eq(filasAtendimento.roletaId, roleta.id), eq(filasAtendimento.corretorId, escolhido.corretorId)));

  const [lead] = await db.update(leads).set({ corretorId: escolhido.corretorId })
    .where(and(eq(leads.id, leadId), isNull(leads.corretorId))).returning();
  if (!lead) return null;

  await db.insert(distribuicaoLog).values({ imobiliariaId, leadId, corretorId: escolhido.corretorId, origem: 'roleta', roletaId: roleta.id });
  const [corr] = await db.select({ nome: perfis.nome }).from(perfis).where(eq(perfis.id, escolhido.corretorId)).limit(1);
  registrarEvento(imobiliariaId, leadId, 'roleta', 'Distribuído pela roleta "' + roleta.nome + '" para ' + (corr?.nome ?? 'corretor'), 'Roleta');
  await db.insert(notificacoes).values({
    perfilId: escolhido.corretorId,
    tipo: 'lead',
    titulo: 'Novo lead atribuído a você',
    texto: `${lead.nome} caiu na sua carteira pela roleta ${roleta.nome}.`,
    lida: false,
  });

  io.to('imobiliaria:' + imobiliariaId).emit('lead:updated', lead);
  enviarPush(escolhido.corretorId, {
    title: 'Novo lead pra você',
    body: `${lead.nome} caiu na sua carteira. Abra o CRM pra atender.`,
    url: '/kanban',
    tag: 'lead-' + lead.id,
  }).catch(() => {});
  void dispararGatilhoLeadNovo(io, imobiliariaId, leadId, escolhido.corretorId);
  void notificarCorretorPorWhatsapp(imobiliariaId, leadId, escolhido.corretorId, roleta.id, {
    nome: lead.nome, telefone: lead.telefone, email: lead.email, campanha: lead.campanha, canal: lead.canal,
  });
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
