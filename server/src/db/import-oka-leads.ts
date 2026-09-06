import bcrypt from 'bcryptjs';
import { and, eq, inArray, like } from 'drizzle-orm';
import { db, sql as pgClient } from './client.js';
import { imobiliarias, colunasKanban, perfis, filasAtendimento, leads } from './schema.js';

/** Nomes fixos dos 10 leads de demonstração do seed (`DEMO_LEADS` em seed.ts) — removidos daqui
 * porque não são leads reais, só existiam pra mostrar a interface antes de ter dado de verdade. */
const NOMES_LEADS_FANTASMA = [
  'Beatriz Aguiar', 'Henrique Sampaio', 'Lucia Ferrari', 'Tiago Meireles', 'Renata Palhares',
  'Otávio Bandeira', 'Sofia Krause', 'Danilo Vasques', 'Mariana Prado', 'Eduardo Bastos',
];

/** Importação pontual dos dados reais do CRM OKA (produção) pro banco do CRM Hinode.
 * Requer OKA_SUPABASE_TOKEN no ambiente — nunca commitar o token em si.
 * Idempotente por padrão: se já existirem mais de 100 leads na imobiliária, não faz nada
 * (rodar com FORCE=1 pra reimportar mesmo assim). */

const SUPABASE_PROJECT = 'osheoeeigahkwsrzfjdw';

async function supaQuery(query: string): Promise<any[]> {
  const token = process.env.OKA_SUPABASE_TOKEN;
  if (!token) throw new Error('OKA_SUPABASE_TOKEN não configurado');
  const res = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = (await res.json()) as any;
  if (json.message) throw new Error('Supabase query falhou: ' + json.message);
  return json as any[];
}

const REAL_PERFIS = [
  { nome: 'Oka', email: 'hinodeimoveis.crm@gmail.com', role: 'dono' as const },
  { nome: 'Vitor Hinode Imoveis', email: 'vitor.hinodeimoveis@gmail.com', role: 'gerente' as const },
  { nome: 'França', email: 'franca@ape161.com.br', role: 'corretor' as const },
  { nome: 'Melissa Hinode Imoveis', email: 'melissa.hinodeimoveis@gmail.com', role: 'corretor' as const },
  { nome: 'Oka corretor', email: 'oka@hinodeimoveis.com.br', role: 'corretor' as const },
  { nome: 'Leonardo Hinode Imoveis', email: 'leonardo.hinodeimoveis@gmail.com', role: 'corretor' as const },
  { nome: 'Rodrigo Hinode Imóveis', email: 'rodrigo.hinodeimoveis@gmail.com', role: 'corretor' as const },
  { nome: 'Farah Hinode Imóveis', email: 'farah.hinodeimoveis@gmail.com', role: 'corretor' as const },
  { nome: 'Balbis', email: 'balbis2050@gmail.com', role: 'corretor' as const },
  { nome: 'Barbara', email: 'barbara.hinodeimoveis@gmail.com', role: 'corretor' as const },
  { nome: 'Michael Hinode Imoveis', email: 'michael.hinodeimoveis@gmail.com', role: 'corretor' as const },
  { nome: 'Julia HInode Imoveis', email: 'julia.hinodeimoveis@gmail.com', role: 'corretor' as const },
];
const REAL_PERFIS_OKA_ID: Record<string, string> = {
  '3423b31b-44ff-4988-a11c-11732ad70c60': 'hinodeimoveis.crm@gmail.com',
  '6e93ff8c-70ed-48e5-a6ec-64b1c10f3d44': 'vitor.hinodeimoveis@gmail.com',
  'ea5de130-cc58-46b1-be74-ccac695ffd27': 'franca@ape161.com.br',
  'e2d27f4d-544a-4f7e-b360-de4825b96ee8': 'melissa.hinodeimoveis@gmail.com',
  '288ece2c-db7c-45c8-a548-d25359adc743': 'oka@hinodeimoveis.com.br',
  '93237039-3a82-466d-abd7-46f1bf1cb552': 'leonardo.hinodeimoveis@gmail.com',
  'b69ae265-802f-4e50-8377-0d81f5d6fa92': 'rodrigo.hinodeimoveis@gmail.com',
  '5b34a8c2-520f-4f4c-8bc4-27fb2967ac65': 'farah.hinodeimoveis@gmail.com',
  '5f31cbc7-9a3f-44b5-a63d-1f433d88df3f': 'balbis2050@gmail.com',
  '2e93a7fb-87df-43a8-8321-e7954d435652': 'barbara.hinodeimoveis@gmail.com',
  '14cfa92e-8c4a-4961-97e9-05beab3e51a9': 'michael.hinodeimoveis@gmail.com',
  '55dda8e1-7dd8-4160-8926-14c50005c391': 'julia.hinodeimoveis@gmail.com',
};

function statusParaTitulo(status: string) {
  switch (status) {
    case 'novo': return 'Lead Novo';
    case 'em_atendimento':
    case 'tarefas':
    case 'futuros': return 'Em Atendimento';
    case 'pendente':
    case 'cobrar_doc':
    case 'aprovado':
    case 'reprovado': return 'Análise de Crédito';
    case 'agendado': return 'Visita Agendada';
    case 'venda_concluida': return 'Venda Concluída';
    case 'rebatida':
    case 'desqualificado': return 'Rebatida';
    default: return 'Lead Novo';
  }
}

function origemParaCanal(origem: string | null): 'WhatsApp' | 'Instagram' | 'Indicacao' | 'Facebook' {
  if (!origem) return 'Facebook';
  const o = origem.toLowerCase();
  if (o.includes('whatsapp')) return 'WhatsApp';
  if (o.includes('instagram')) return 'Instagram';
  if (o.includes('indica')) return 'Indicacao';
  return 'Facebook';
}

const COLS_BASE = [
  { titulo: 'Lead Novo', cor: 'var(--muted)' },
  { titulo: 'Em Atendimento', cor: 'var(--terra)' },
  { titulo: 'Análise de Crédito', cor: 'var(--terra)' },
  { titulo: 'Visita Agendada', cor: 'var(--terra)' },
  { titulo: 'Proposta', cor: 'var(--terra)' },
  { titulo: 'Venda Concluída', cor: 'var(--olive)' },
  { titulo: 'Rebatida', cor: 'var(--muted)' },
];

async function main() {
  let [imob] = await db.select().from(imobiliarias).limit(1);
  if (!imob) {
    console.log('Nenhuma imobiliária ainda — criando a base (sem dado de demonstração)...');
    [imob] = await db.insert(imobiliarias).values({ nome: 'Hinode Imóveis' }).returning();
  }

  const colunasExistentes = await db.select().from(colunasKanban).where(eq(colunasKanban.imobiliariaId, imob.id));
  if (colunasExistentes.length === 0) {
    await db.insert(colunasKanban).values(
      COLS_BASE.map((c, i) => ({ imobiliariaId: imob.id, titulo: c.titulo, ordem: i, cor: c.cor })),
    );
    console.log('  colunas do kanban criadas');
  }

  console.log('Limpando leads fantasma e corretores de demonstração...');
  const leadsFantasmaRemovidos = await db.delete(leads)
    .where(and(eq(leads.imobiliariaId, imob.id), inArray(leads.nome, NOMES_LEADS_FANTASMA)))
    .returning({ id: leads.id });
  console.log('  leads fantasma removidos:', leadsFantasmaRemovidos.length);
  const corretoresDemoRemovidos = await db.delete(perfis)
    .where(and(eq(perfis.imobiliariaId, imob.id), like(perfis.email, '%@novaimob.com.br')))
    .returning({ id: perfis.id, nome: perfis.nome });
  corretoresDemoRemovidos.forEach(c => console.log('  corretor de demonstração removido:', c.nome));

  const leadsExistentes = await db.select({ id: leads.id }).from(leads).where(eq(leads.imobiliariaId, imob.id)).limit(200);
  if (leadsExistentes.length > 100 && process.env.FORCE !== '1') {
    console.log('Import: já existem', leadsExistentes.length, '+ leads reais — pulando reimportação (rode com FORCE=1 pra forçar).');
    return;
  }

  const colunas = await db.select().from(colunasKanban).where(eq(colunasKanban.imobiliariaId, imob.id));
  const colunaIdByTitulo = new Map(colunas.map(c => [c.titulo, c.id]));

  console.log('Sincronizando perfis reais do CRM OKA...');
  const senhaHashPadrao = await bcrypt.hash('123456', 10);
  const emailToHinodeId = new Map<string, string>();
  const filasExistentes = await db.select({ posicao: filasAtendimento.posicao }).from(filasAtendimento).where(eq(filasAtendimento.imobiliariaId, imob.id));
  let posicaoFila = filasExistentes.length ? Math.max(...filasExistentes.map(f => f.posicao)) + 1 : 0;

  for (const p of REAL_PERFIS) {
    const [existente] = await db.select().from(perfis).where(eq(perfis.email, p.email)).limit(1);
    if (existente) {
      await db.update(perfis).set({ nome: p.nome, role: p.role }).where(eq(perfis.id, existente.id));
      emailToHinodeId.set(p.email, existente.id);
      console.log('  atualizado:', p.nome, p.email);
    } else {
      const [novo] = await db.insert(perfis).values({
        imobiliariaId: imob.id, nome: p.nome, email: p.email, senhaHash: senhaHashPadrao, role: p.role,
      }).returning();
      emailToHinodeId.set(p.email, novo.id);
      console.log('  criado:', p.nome, p.email);
      if (p.role === 'corretor') {
        await db.insert(filasAtendimento).values({ imobiliariaId: imob.id, corretorId: novo.id, posicao: posicaoFila });
        posicaoFila++;
      }
    }
  }

  const corretorOkaIdToHinodeId = new Map<string, string | undefined>();
  for (const [okaId, email] of Object.entries(REAL_PERFIS_OKA_ID)) {
    corretorOkaIdToHinodeId.set(okaId, emailToHinodeId.get(email));
  }

  console.log('Buscando leads reais do CRM OKA (Supabase)...');
  const okaLeads = await supaQuery(`
    select id, corretor_id, nome, email, telefone, telefone_alternativo, origem, status,
           valor_estimado, valor_venda, renda_familiar, motivo_descarte, empreendimento, unidade,
           torre, created_at, updated_at, ultima_acao_at
    from leads
    order by created_at
  `);
  console.log('Total de leads buscados:', okaLeads.length);

  const BATCH = 500;
  let inseridos = 0;
  for (let i = 0; i < okaLeads.length; i += BATCH) {
    const lote = okaLeads.slice(i, i + BATCH);
    const valores = lote.map(l => {
      const imovelSub = [l.torre ? 'Torre ' + l.torre : null, l.unidade ? 'Unidade ' + l.unidade : null].filter(Boolean).join(' · ') || null;
      return {
        imobiliariaId: imob.id,
        nome: l.nome,
        telefone: l.telefone || l.telefone_alternativo || '(sem telefone)',
        email: l.email,
        imovelTitulo: l.empreendimento,
        imovelSub,
        valor: String(l.valor_venda ?? l.valor_estimado ?? 0),
        canal: origemParaCanal(l.origem),
        colunaId: colunaIdByTitulo.get(statusParaTitulo(l.status)) ?? null,
        corretorId: l.corretor_id ? (corretorOkaIdToHinodeId.get(l.corretor_id) ?? null) : null,
        campanha: l.origem,
        motivoDescarte: l.motivo_descarte,
        rendaDeclarada: l.renda_familiar != null ? String(l.renda_familiar) : null,
        entrouNaColunaEm: new Date(l.updated_at || l.ultima_acao_at || l.created_at),
        criadoEm: new Date(l.created_at),
      };
    });
    await db.insert(leads).values(valores as any);
    inseridos += lote.length;
    console.log(`  ${inseridos}/${okaLeads.length}`);
  }

  console.log('Importação concluída:', inseridos, 'leads inseridos.');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => pgClient.end());
