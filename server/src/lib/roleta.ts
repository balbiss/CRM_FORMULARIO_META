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
 *  Sobre o motor de envio: o WAHA (engine GOWS) falha de forma consistente pra esse tipo de
 *  mensagem ("a frio", o CRM inicia sem o corretor ter mandado nada antes) — bug conhecido do
 *  WAHA (devlikeapro/waha#2214, "no LID found"), investigado a fundo, sem correção disponível.
 *  Por isso essa função específica usa um serviço Baileys dedicado (baileysApi.ts) em vez do
 *  WAHA. Esse serviço hoje atende UM número só (BAILEYS_IMOBILIARIA_ID) — por segurança,
 *  qualquer outra imobiliária que ligar essa opção no futuro não vai mandar nada até esse
 *  serviço virar multi-tenant de verdade (evita mandar mensagem pelo número errado). */
async function notificarCorretorPorWhatsapp(
  imobiliariaId: string,
  leadId: string,
  corretorId: string,
  _roletaId: string,
  lead: { nome: string; telefone: string; email: string | null; campanha: string | null; canal: string },
) {
  try {
    const [imob] = await db.select({ ligado: imobiliarias.notificarCorretorWhatsapp })
      .from(imobiliarias).where(eq(imobiliarias.id, imobiliariaId)).limit(1);
    if (!imob?.ligado) return;

    if (imobiliariaId !== process.env.BAILEYS_IMOBILIARIA_ID) {
      registrarEvento(imobiliariaId, leadId, 'aviso', 'Aviso por WhatsApp ainda não disponível pra essa imobiliária (serviço dedicado, 1 conta por vez).', 'Sistema');
      return;
    }

    const [corretor] = await db.select({ telefone: perfis.telefone }).from(perfis).where(eq(perfis.id, corretorId)).limit(1);
    if (!corretor?.telefone) {
      registrarEvento(imobiliariaId, leadId, 'aviso', 'Corretor sem telefone cadastrado — não deu pra avisar por WhatsApp.', 'Sistema');
      return;
    }

    const { baileysConfigurado, statusConexao, enviarTexto } = await import('./baileysApi.js');
    if (!baileysConfigurado()) {
      registrarEvento(imobiliariaId, leadId, 'aviso', 'Serviço de WhatsApp (Baileys) não configurado — não deu pra avisar o corretor.', 'Sistema');
      return;
    }
    const status = await statusConexao();
    if (!status?.connected) {
      registrarEvento(imobiliariaId, leadId, 'aviso', 'Número central (Baileys) desconectado — não deu pra avisar o corretor por WhatsApp.', 'Sistema');
      return;
    }

    const partes = ['*Novo lead atribuído a você*', '', `*Nome:* ${lead.nome}`, `*WhatsApp:* ${lead.telefone}`];
    if (lead.email) partes.push(`*E-mail:* ${lead.email}`);
    partes.push(`*Canal:* ${lead.canal}`);
    if (lead.campanha) partes.push(`*Campanha:* ${lead.campanha}`);
    partes.push('', 'Entre em contato o quanto antes para não perder a oportunidade.', '', '_Mensagem automática — Visita IA CRM_');
    await enviarTexto(corretor.telefone, partes.join('\n'));
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
