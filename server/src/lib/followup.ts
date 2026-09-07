import { and, asc, eq, lte, ne } from 'drizzle-orm';
import type { Server as SocketServer } from 'socket.io';
import { db } from '../db/client.js';
import {
  followupFluxos, followupPassos, followupExecucoes,
  leads, perfis, imobiliarias, colunasKanban, mensagensWhatsapp, sessoesWhatsapp, notificacoes,
} from '../db/schema.js';
import { registrarEvento } from './eventos.js';
import { checarNumero } from './waha.js';

type Fluxo = typeof followupFluxos.$inferSelect;

const SP = 'America/Sao_Paulo';
const emSP = (d: Date) => new Date(d.toLocaleString('en-US', { timeZone: SP }));
/** Diferença fixa entre o relógio real e o relógio de SP (Brasil não tem horário de verão). */
const offsetSP = (d: Date) => d.getTime() - emSP(d).getTime();

function dias(fluxo: Fluxo): boolean[] {
  const j = fluxo.janelaDias as unknown;
  return Array.isArray(j) && j.length === 7 ? (j as boolean[]) : [false, true, true, true, true, true, false];
}

/** A janela do fluxo permite mandar AGORA? (hora + dia da semana, fuso SP) */
export function janelaPermiteAgora(fluxo: Fluxo, agora = new Date()): boolean {
  const d = emSP(agora);
  if (!dias(fluxo)[d.getDay()]) return false;
  const min = d.getHours() * 60 + d.getMinutes();
  return min >= fluxo.janelaInicioMin && min < fluxo.janelaFimMin;
}

/** Empurra `base` pro próximo instante que cai dentro da janela do fluxo. Se já está dentro,
 *  devolve o próprio `base`. */
export function proximaJanela(fluxo: Fluxo, base: Date): Date {
  const off = offsetSP(base);
  const sp = emSP(base);
  for (let i = 0; i < 8; i++) {
    const dia = new Date(sp.getFullYear(), sp.getMonth(), sp.getDate() + i, 0, 0, 0, 0);
    if (!dias(fluxo)[dia.getDay()]) continue;
    const inicio = new Date(dia.getTime()); inicio.setMinutes(fluxo.janelaInicioMin);
    const fim = new Date(dia.getTime()); fim.setMinutes(fluxo.janelaFimMin);
    let alvo: Date;
    if (i === 0) {
      if (sp.getTime() < inicio.getTime()) alvo = inicio;
      else if (sp.getTime() < fim.getTime()) alvo = sp;
      else continue;
    } else {
      alvo = inicio;
    }
    return new Date(alvo.getTime() + off);
  }
  return base;
}

function primeiroNome(nome: string) {
  return (nome || '').trim().split(/\s+/)[0] || nome;
}

export function resolverVars(texto: string, ctx: { leadNome: string; corretorNome?: string | null; imobNome?: string | null; imovel?: string | null }): string {
  return (texto || '')
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, primeiroNome(ctx.leadNome))
    .replace(/\{\{\s*nome\s*\}\}/gi, ctx.leadNome || '')
    .replace(/\{\{\s*corretor\s*\}\}/gi, ctx.corretorNome || '')
    .replace(/\{\{\s*imobiliaria\s*\}\}/gi, ctx.imobNome || '')
    .replace(/\{\{\s*imovel\s*\}\}/gi, ctx.imovel || '');
}

async function fluxoDisparoDoCorretor(corretorId: string) {
  const [f] = await db.select().from(followupFluxos)
    .where(and(
      eq(followupFluxos.corretorId, corretorId),
      eq(followupFluxos.ativo, true),
      eq(followupFluxos.disparaEmLeadNovo, true),
    ))
    .orderBy(asc(followupFluxos.criadoEm))
    .limit(1);
  return f ?? null;
}

async function execucaoViva(leadId: string) {
  const [e] = await db.select().from(followupExecucoes)
    .where(and(eq(followupExecucoes.leadId, leadId), ne(followupExecucoes.status, 'encerrada')))
    .limit(1);
  return e ?? null;
}

/** Sessão do WhatsApp que vai despachar essa régua (central ou do corretor). */
async function sessaoDespacho(imobiliariaId: string, corretorId: string | null) {
  const [imob] = await db.select({ modo: imobiliarias.modoWhatsapp }).from(imobiliarias).where(eq(imobiliarias.id, imobiliariaId)).limit(1);
  if (imob?.modo === 'central') {
    const [s] = await db.select().from(sessoesWhatsapp)
      .where(and(eq(sessoesWhatsapp.imobiliariaId, imobiliariaId), eq(sessoesWhatsapp.escopo, 'central'), eq(sessoesWhatsapp.status, 'conectada'))).limit(1);
    return s ?? null;
  }
  if (corretorId) {
    const [s] = await db.select().from(sessoesWhatsapp)
      .where(and(eq(sessoesWhatsapp.corretorId, corretorId), eq(sessoesWhatsapp.status, 'conectada'))).limit(1);
    return s ?? null;
  }
  return null;
}

/** Data do 1º envio de uma execução recém-criada. `graceMs` cobre a janela de "aceitar o lead"
 *  quando o disparo é automático (a régua não manda antes de o corretor ter chance de recusar). */
function primeiroEnvio(fluxo: Fluxo, passo0Min: number, graceMs: number): Date {
  const base = new Date(Date.now() + Math.max(passo0Min * 60000, graceMs));
  return proximaJanela(fluxo, base);
}

interface IniciarOpts {
  leadId: string;
  fluxoId: string;
  imobiliariaId: string;
  corretorId: string | null;
  automatico: boolean; // true = disparo por lead novo (aplica grace + checa número)
}

/** Cria uma execução de follow-up pro lead (se ainda não tem uma viva). */
export async function iniciarFollowup(io: SocketServer, opts: IniciarOpts): Promise<{ ok: boolean; motivo?: string }> {
  if (await execucaoViva(opts.leadId)) return { ok: false, motivo: 'já tem follow-up rodando' };

  const [fluxo] = await db.select().from(followupFluxos)
    .where(and(eq(followupFluxos.id, opts.fluxoId), eq(followupFluxos.imobiliariaId, opts.imobiliariaId))).limit(1);
  if (!fluxo) return { ok: false, motivo: 'fluxo não encontrado' };

  const passos = await db.select().from(followupPassos).where(eq(followupPassos.fluxoId, fluxo.id)).orderBy(asc(followupPassos.ordem));
  if (!passos.length) return { ok: false, motivo: 'fluxo sem passos' };

  // Check de número antes da 1ª mensagem (só quando há sessão conectada pra checar).
  if (opts.automatico) {
    const [lead] = await db.select({ telefone: leads.telefone, nome: leads.nome }).from(leads).where(eq(leads.id, opts.leadId)).limit(1);
    const sessao = await sessaoDespacho(opts.imobiliariaId, opts.corretorId);
    if (lead && sessao) {
      const existe = await checarNumero(sessao.sessionName, lead.telefone);
      if (existe === false) {
        if (opts.corretorId) {
          await db.insert(notificacoes).values({
            perfilId: opts.corretorId, tipo: 'followup', titulo: 'WhatsApp do lead parece inválido',
            texto: `Não consegui iniciar o follow-up de ${lead.nome} — confere o número.`, lida: false,
          });
        }
        registrarEvento(opts.imobiliariaId, opts.leadId, 'followup', 'Follow-up não iniciado: WhatsApp do lead parece inválido', fluxo.nome);
        return { ok: false, motivo: 'número inválido' };
      }
    }
  }

  const proximo = primeiroEnvio(fluxo, passos[0].atrasoMinutos, opts.automatico ? 90000 : 0);
  await db.insert(followupExecucoes).values({
    imobiliariaId: opts.imobiliariaId, leadId: opts.leadId, fluxoId: fluxo.id,
    corretorId: opts.corretorId, passoAtual: 0, status: 'ativa', proximoEnvioEm: proximo,
  });
  registrarEvento(opts.imobiliariaId, opts.leadId, 'followup', 'Follow-up iniciado: ' + fluxo.nome, fluxo.nome);
  io.to('imobiliaria:' + opts.imobiliariaId).emit('followup:mudou', { leadId: opts.leadId });
  return { ok: true };
}

/** Chamado quando um lead é atribuído a um corretor (roleta ou manual). */
export async function dispararGatilhoLeadNovo(io: SocketServer, imobiliariaId: string, leadId: string, corretorId: string) {
  try {
    if (await execucaoViva(leadId)) return;
    const fluxo = await fluxoDisparoDoCorretor(corretorId);
    if (!fluxo) return;
    await iniciarFollowup(io, { leadId, fluxoId: fluxo.id, imobiliariaId, corretorId, automatico: true });
  } catch (e) {
    console.error('followup gatilho:', (e as Error).message);
  }
}

/** Lead respondeu no WhatsApp → pausa a régua (o corretor assume; pode retomar depois). */
export async function pausarPorResposta(io: SocketServer, imobiliariaId: string, leadId: string) {
  try {
    const ex = await execucaoViva(leadId);
    if (!ex || ex.status !== 'ativa') return;
    await db.update(followupExecucoes).set({ status: 'pausada', motivoFim: 'lead respondeu' }).where(eq(followupExecucoes.id, ex.id));
    if (ex.corretorId) {
      await db.insert(notificacoes).values({
        perfilId: ex.corretorId, tipo: 'followup', titulo: 'Follow-up pausado',
        texto: 'O lead respondeu — assumindo a conversa.', lida: false,
      });
    }
    registrarEvento(imobiliariaId, leadId, 'followup', 'Follow-up pausado — o lead respondeu', null);
    io.to('imobiliaria:' + imobiliariaId).emit('followup:mudou', { leadId });
  } catch (e) {
    console.error('followup pausar:', (e as Error).message);
  }
}

/** Encerra qualquer execução viva do lead (recusa, venda, descarte, exclusão). */
export async function encerrarPorLead(io: SocketServer, imobiliariaId: string, leadId: string, motivo: string) {
  try {
    const ex = await execucaoViva(leadId);
    if (!ex) return;
    await db.update(followupExecucoes).set({ status: 'encerrada', motivoFim: motivo, proximoEnvioEm: null }).where(eq(followupExecucoes.id, ex.id));
    io.to('imobiliaria:' + imobiliariaId).emit('followup:mudou', { leadId });
  } catch (e) {
    console.error('followup encerrar:', (e as Error).message);
  }
}

async function concluir(io: SocketServer, ex: typeof followupExecucoes.$inferSelect, fluxo: Fluxo) {
  await db.update(followupExecucoes).set({ status: 'encerrada', motivoFim: 'concluído', proximoEnvioEm: null }).where(eq(followupExecucoes.id, ex.id));
  registrarEvento(ex.imobiliariaId, ex.leadId, 'followup', 'Follow-up concluído: ' + fluxo.nome, fluxo.nome);

  if (fluxo.aoEsgotar === 'descartar') {
    const [rebatida] = await db.select({ id: colunasKanban.id }).from(colunasKanban)
      .where(and(eq(colunasKanban.imobiliariaId, ex.imobiliariaId), eq(colunasKanban.slug, 'rebatida'))).limit(1);
    await db.update(leads).set({
      motivoDescarte: 'Follow-up esgotado sem resposta',
      ...(rebatida ? { colunaId: rebatida.id, entrouNaColunaEm: new Date() } : {}),
    }).where(eq(leads.id, ex.leadId));
    registrarEvento(ex.imobiliariaId, ex.leadId, 'descarte', 'Descartado: follow-up esgotado sem resposta', fluxo.nome);
    const [lead] = await db.select().from(leads).where(eq(leads.id, ex.leadId)).limit(1);
    if (lead) io.to('imobiliaria:' + ex.imobiliariaId).emit('lead:updated', lead);
  } else if (fluxo.aoEsgotar === 'mover' && fluxo.aoEsgotarColunaId) {
    await db.update(leads).set({ colunaId: fluxo.aoEsgotarColunaId, entrouNaColunaEm: new Date() }).where(eq(leads.id, ex.leadId));
    const [lead] = await db.select().from(leads).where(eq(leads.id, ex.leadId)).limit(1);
    if (lead) io.to('imobiliaria:' + ex.imobiliariaId).emit('lead:updated', lead);
  }
  io.to('imobiliaria:' + ex.imobiliariaId).emit('followup:mudou', { leadId: ex.leadId });
}

/** Varredura periódica: manda os passos que venceram, respeitando a janela. */
export async function varrerFollowups(io: SocketServer): Promise<number> {
  const agora = new Date();
  const pendentes = await db.select().from(followupExecucoes)
    .where(and(eq(followupExecucoes.status, 'ativa'), lte(followupExecucoes.proximoEnvioEm, agora)));
  let enviados = 0;

  for (const ex of pendentes) {
    try {
      const [fluxo] = await db.select().from(followupFluxos).where(eq(followupFluxos.id, ex.fluxoId)).limit(1);
      if (!fluxo || !fluxo.ativo) {
        await db.update(followupExecucoes).set({ status: 'encerrada', motivoFim: 'fluxo desativado', proximoEnvioEm: null }).where(eq(followupExecucoes.id, ex.id));
        io.to('imobiliaria:' + ex.imobiliariaId).emit('followup:mudou', { leadId: ex.leadId });
        continue;
      }
      if (!janelaPermiteAgora(fluxo, agora)) {
        await db.update(followupExecucoes).set({ proximoEnvioEm: proximaJanela(fluxo, agora) }).where(eq(followupExecucoes.id, ex.id));
        continue;
      }

      const passos = await db.select().from(followupPassos).where(eq(followupPassos.fluxoId, ex.fluxoId)).orderBy(asc(followupPassos.ordem));
      const passo = passos[ex.passoAtual];
      if (!passo) { await concluir(io, ex, fluxo); continue; }

      const [lead] = await db.select().from(leads).where(eq(leads.id, ex.leadId)).limit(1);
      if (!lead) {
        await db.update(followupExecucoes).set({ status: 'encerrada', motivoFim: 'lead removido', proximoEnvioEm: null }).where(eq(followupExecucoes.id, ex.id));
        continue;
      }
      const [corr] = ex.corretorId ? await db.select({ nome: perfis.nome }).from(perfis).where(eq(perfis.id, ex.corretorId)).limit(1) : [undefined];
      const [imob] = await db.select({ nome: imobiliarias.nome }).from(imobiliarias).where(eq(imobiliarias.id, ex.imobiliariaId)).limit(1);

      const texto = passo.conteudo ? resolverVars(passo.conteudo, { leadNome: lead.nome, corretorNome: corr?.nome, imobNome: imob?.nome, imovel: lead.imovelTitulo }) : null;
      const anexoTipo = passo.tipo === 'imagem' ? 'imagem' : passo.tipo === 'audio' ? 'audio' : passo.tipo === 'pdf' ? 'documento' : null;

      const { despacharPeloWhatsapp } = await import('../routes/whatsapp.js');
      const r = await despacharPeloWhatsapp({
        imobiliariaId: ex.imobiliariaId, telefone: lead.telefone, corretorId: ex.corretorId, sessaoWhatsappId: lead.sessaoWhatsappId,
        texto, anexoUrl: passo.anexoUrl, anexoTipo: anexoTipo as 'imagem' | 'audio' | 'documento' | null, anexoNome: passo.anexoNome,
      });
      if (!r.enviado) {
        // sem sessão conectada agora — tenta de novo em 15 min, sem avançar
        await db.update(followupExecucoes).set({ proximoEnvioEm: new Date(agora.getTime() + 15 * 60000) }).where(eq(followupExecucoes.id, ex.id));
        continue;
      }

      const [msg] = await db.insert(mensagensWhatsapp).values({
        leadId: lead.id, direcao: 'out', canal: 'followup', enviadoPor: ex.corretorId, ackStatus: 1,
        texto: texto ?? null, anexoUrl: passo.anexoUrl ?? null, anexoTipo, anexoNome: passo.anexoNome ?? null,
      }).returning();
      io.to('imobiliaria:' + ex.imobiliariaId).emit('mensagem:created', msg);

      if (passo.cadenciaLabel && lead.cadencia !== passo.cadenciaLabel) {
        await db.update(leads).set({ cadencia: passo.cadenciaLabel }).where(eq(leads.id, lead.id));
        io.to('imobiliaria:' + ex.imobiliariaId).emit('lead:updated', { ...lead, cadencia: passo.cadenciaLabel });
      }
      registrarEvento(ex.imobiliariaId, lead.id, 'followup', 'Follow-up enviou' + (passo.cadenciaLabel ? ' — ' + passo.cadenciaLabel : ' o passo ' + (ex.passoAtual + 1)), fluxo.nome);
      enviados++;

      const prox = ex.passoAtual + 1;
      if (prox >= passos.length) {
        await concluir(io, { ...ex, passoAtual: prox }, fluxo);
      } else {
        const base = new Date(agora.getTime() + passos[prox].atrasoMinutos * 60000);
        await db.update(followupExecucoes).set({ passoAtual: prox, proximoEnvioEm: proximaJanela(fluxo, base) }).where(eq(followupExecucoes.id, ex.id));
        io.to('imobiliaria:' + ex.imobiliariaId).emit('followup:mudou', { leadId: lead.id });
      }
    } catch (e) {
      console.error('followup varredura (execução ' + ex.id + '):', (e as Error).message);
      await db.update(followupExecucoes).set({ proximoEnvioEm: new Date(agora.getTime() + 15 * 60000) }).where(eq(followupExecucoes.id, ex.id)).catch(() => {});
    }
  }
  return enviados;
}
