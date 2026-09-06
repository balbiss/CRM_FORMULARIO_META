import 'dotenv/config';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const CORRETORES = [
  { nome: 'Eduardo Marins', email: 'hinodeimoveis.crm@gmail.com', role: 'dono' as const, telefone: '(11) 98700-0001' },
  { nome: 'Camila Rocha', email: 'camila.rocha@novaimob.com.br', role: 'gerente' as const, telefone: '(11) 98812-4477' },
  { nome: 'Diego Antunes', email: 'diego.antunes@novaimob.com.br', role: 'corretor' as const, telefone: '(11) 97001-1122' },
  { nome: 'Fernanda Lopes', email: 'fernanda.lopes@novaimob.com.br', role: 'corretor' as const, telefone: '(11) 97002-2233' },
  { nome: 'Marcelo Braga', email: 'marcelo.braga@novaimob.com.br', role: 'corretor' as const, telefone: '(11) 97003-3344' },
  { nome: 'Priscila Nunes', email: 'priscila.nunes@novaimob.com.br', role: 'corretor' as const, telefone: '(11) 97004-4455' },
  { nome: 'Rafael Teixeira', email: 'rafael.teixeira@novaimob.com.br', role: 'corretor' as const, telefone: '(11) 97005-5566' },
];

const COLS = [
  { titulo: 'Lead Novo', cor: 'var(--muted)' },
  { titulo: 'Em Atendimento', cor: 'var(--terra)' },
  { titulo: 'Análise de Crédito', cor: 'var(--terra)' },
  { titulo: 'Visita Agendada', cor: 'var(--terra)' },
  { titulo: 'Proposta', cor: 'var(--terra)' },
  { titulo: 'Venda Concluída', cor: 'var(--olive)' },
  { titulo: 'Rebatida', cor: 'var(--muted)' },
];

const IMOVEIS = [
  ['Edifício Aurora — Cobertura 1201', 'Itaim Bibi, São Paulo · 248 m²', 4200000],
  ['Vila Serena — Casa 14', 'Cambuí, Campinas · 190 m²', 1850000],
  ['Residencial Mirante — Apto 803', 'Vila Mariana, São Paulo · 112 m²', 1290000],
  ['Praia Grande Tower — Apto 1502', 'Gonzaga, Santos · 96 m²', 980000],
  ['Aurora — Garden 102', 'Itaim Bibi, São Paulo · 165 m²', 3100000],
  ['Quinta do Bosque — Lote 27', 'Sousas, Campinas · 620 m²', 740000],
] as const;

// 10 leads pra demonstração real pra empresa: nomes/telefones/imóveis variados, espalhados
// pelas etapas do funil (incluindo 2 vendas fechadas, pra mostrar o funil completo funcionando).
const DEMO_LEADS = [
  { nome: 'Beatriz Aguiar', canal: 'WhatsApp', coluna: 'Lead Novo', imovel: 0, dias: 0 },
  { nome: 'Henrique Sampaio', canal: 'Instagram', coluna: 'Lead Novo', imovel: 1, dias: 0 },
  { nome: 'Lucia Ferrari', canal: 'Facebook', coluna: 'Em Atendimento', imovel: 2, dias: 2 },
  { nome: 'Tiago Meireles', canal: 'WhatsApp', coluna: 'Em Atendimento', imovel: 3, dias: 1 },
  { nome: 'Renata Palhares', canal: 'Indicacao', coluna: 'Análise de Crédito', imovel: 4, dias: 4 },
  { nome: 'Otávio Bandeira', canal: 'WhatsApp', coluna: 'Análise de Crédito', imovel: 0, dias: 6 },
  { nome: 'Sofia Krause', canal: 'Instagram', coluna: 'Visita Agendada', imovel: 1, dias: 1 },
  { nome: 'Danilo Vasques', canal: 'Manual', coluna: 'Proposta', imovel: 5, dias: 3 },
  { nome: 'Mariana Prado', canal: 'WhatsApp', coluna: 'Venda Concluída', imovel: 2, dias: 8 },
  { nome: 'Eduardo Bastos', canal: 'Facebook', coluna: 'Venda Concluída', imovel: 4, dias: 12 },
] as const;

async function main() {
  console.log('Seed: limpando dados existentes…');
  await db.delete(schema.mensagensWhatsapp);
  await db.delete(schema.leads);
  await db.delete(schema.filasAtendimento);
  await db.delete(schema.colunasKanban);
  await db.delete(schema.perfis);
  await db.delete(schema.imoveis);
  await db.delete(schema.linksUteis);
  await db.delete(schema.treinamentos);
  await db.delete(schema.imobiliarias);

  const [imob] = await db.insert(schema.imobiliarias).values({ nome: 'Hinode Imóveis' }).returning();
  console.log('Seed: imobiliária criada', imob.id);

  const senhaHash = await bcrypt.hash('123456', 10);
  const senhaHashDono = await bcrypt.hash('280896Ab@', 10);
  const perfisRows = await db.insert(schema.perfis).values(
    CORRETORES.map(c => ({
      imobiliariaId: imob.id, nome: c.nome, email: c.email,
      senhaHash: c.role === 'dono' ? senhaHashDono : senhaHash,
      role: c.role, telefone: c.telefone, emPlantao: false,
    })),
  ).returning();
  console.log('Seed:', perfisRows.length, 'perfis criados (senha padrão: 123456; Dono usa senha própria)');

  const colunasRows = await db.insert(schema.colunasKanban).values(
    COLS.map((c, i) => ({ imobiliariaId: imob.id, titulo: c.titulo, ordem: i, cor: c.cor })),
  ).returning();

  const colunaByTitulo = new Map(colunasRows.map(c => [c.titulo, c.id]));
  // Só os corretores de verdade entram na roleta/fila — dono/gerente ficam de fora, igual à
  // produção real (eles GERENCIAM a fila, não trabalham lead pessoalmente por padrão). Isso também
  // deixa o isolamento por papel óbvio na demo: cada corretor loga e só vê os 2 dele, enquanto
  // Dono/Gerente logam e veem os 10.
  const corretoresRows = perfisRows.filter(p => p.role === 'corretor');

  await db.insert(schema.filasAtendimento).values(
    corretoresRows.map((p, i) => ({ imobiliariaId: imob.id, corretorId: p.id, posicao: i })),
  );

  const leadsRows = await db.insert(schema.leads).values(
    DEMO_LEADS.map((l, i) => {
      const im = IMOVEIS[l.imovel];
      return {
        imobiliariaId: imob.id,
        nome: l.nome,
        telefone: '(11) 9' + (8000 + i * 37) + '-' + (1000 + i * 13),
        email: l.nome.toLowerCase().replace(/ /g, '.') + '@email.com',
        imovelTitulo: im[0],
        imovelSub: im[1],
        valor: String(im[2]),
        canal: l.canal,
        colunaId: colunaByTitulo.get(l.coluna),
        corretorId: corretoresRows[i % corretoresRows.length].id,
        campanha: i % 2 ? 'Aurora — Lançamento' : 'Vila Serena — Fase 2',
        rendaDeclarada: String(9000 + (i % 6) * 4200),
        entrouNaColunaEm: new Date(Date.now() - l.dias * 86400000),
      };
    }),
  ).returning();

  // Conversas de demonstração pra validar o chat de verdade (persistência real, sem WAHA ainda —
  // por isso só mensagens "out", do corretor; nada simula resposta automática do lead).
  const horasAtras = (h: number) => new Date(Date.now() - h * 3600000);
  const leadLucia = leadsRows.find(l => l.nome === 'Lucia Ferrari')!;
  const leadTiago = leadsRows.find(l => l.nome === 'Tiago Meireles')!;
  await db.insert(schema.mensagensWhatsapp).values([
    { leadId: leadLucia.id, direcao: 'out', texto: 'Oi Lucia! Vi seu interesse no Residencial Mirante — posso te mandar mais fotos?', canal: 'corretor', enviadoEm: horasAtras(30) },
    { leadId: leadLucia.id, direcao: 'in', texto: 'Pode sim, por favor!', canal: 'corretor', enviadoEm: horasAtras(29) },
    { leadId: leadLucia.id, direcao: 'out', texto: 'Segue a fachada do prédio.', anexoUrl: 'https://picsum.photos/seed/mirante-chat-1/700/500', anexoTipo: 'imagem', canal: 'corretor', enviadoEm: horasAtras(29) },
    { leadId: leadLucia.id, direcao: 'in', texto: 'Ficou linda! Consigo agendar uma visita essa semana?', canal: 'corretor', enviadoEm: horasAtras(4) },
    { leadId: leadTiago.id, direcao: 'out', texto: 'Oi Tiago, tudo bem? Separei a tabela de valores atualizada do Aurora.', canal: 'corretor', enviadoEm: horasAtras(20) },
    { leadId: leadTiago.id, direcao: 'in', texto: 'Show, valeu! Vou dar uma olhada.', canal: 'corretor', enviadoEm: horasAtras(19) },
  ]);

  // imagens são URLs (picsum.photos, placeholder estável só pra demo/validação do campo) — uma
  // foto de verdade enviada pelo app entra via /api/uploads e vira URL do MinIO, mesmo formato.
  const foto = (seed: string) => 'https://picsum.photos/seed/' + seed + '/800/600';
  await db.insert(schema.imoveis).values([
    { imobiliariaId: imob.id, tipo: 'Apartamento', finalidade: 'Venda', titulo: 'Edifício Aurora — Cobertura 1201', endereco: 'Rua Joaquim Antunes, 480', cidade: 'São Paulo', estado: 'SP', preco: '4200000', area: '248', quartos: 4, suites: 3, banheiros: 5, vagas: 4, amenidades: ['Piscina', 'Academia', 'Portaria 24h', 'Elevador'], descricao: 'Cobertura duplex com vista panorâmica, terraço gourmet e 4 vagas de garagem.', imagens: [foto('aurora-1201-a'), foto('aurora-1201-b')], valorCondominio: '3800', valorIptu: '12000' },
    { imobiliariaId: imob.id, tipo: 'Casa', finalidade: 'Venda', titulo: 'Vila Serena — Casa 14', endereco: 'Rua das Palmeiras, 220', cidade: 'Campinas', estado: 'SP', preco: '1850000', area: '190', quartos: 3, suites: 1, banheiros: 3, vagas: 2, amenidades: ['Churrasqueira', 'Varanda', 'Mobiliado'], descricao: 'Casa térrea em condomínio fechado, quintal amplo e churrasqueira integrada.', imagens: [foto('vila-serena-14-a'), foto('vila-serena-14-b')], valorCondominio: '450', valorIptu: '3200' },
    { imobiliariaId: imob.id, tipo: 'Apartamento', finalidade: 'Venda', titulo: 'Residencial Mirante — Apto 803', endereco: 'Av. Indianópolis, 1900', cidade: 'São Paulo', estado: 'SP', preco: '1290000', area: '112', quartos: 3, suites: 1, banheiros: 2, vagas: 1, amenidades: ['Academia', 'Elevador'], descricao: 'Em obras, entrega prevista — unidade com planta na parede disponível para visita no decorado.', imagens: [foto('mirante-803-a')], situacao: 'Em obras', previsaoEntrega: 'Março/2027', valorCondominio: '890', valorIptu: '1800' },
    { imobiliariaId: imob.id, tipo: 'Apartamento', finalidade: 'Aluguel', titulo: 'Praia Grande Tower — Apto 1502', endereco: 'Av. Ana Costa, 340', cidade: 'Santos', estado: 'SP', preco: '980000', area: '96', quartos: 2, suites: 1, banheiros: 2, vagas: 1, amenidades: ['Piscina', 'Portaria 24h'], descricao: 'Vista mar, mobiliado, pronto para morar ou temporada.', imagens: [foto('praia-grande-1502-a'), foto('praia-grande-1502-b')], aceitaFinanciamento: false, valorCondominio: '650' },
    { imobiliariaId: imob.id, tipo: 'Apartamento', finalidade: 'Venda', titulo: 'Aurora — Garden 102', endereco: 'Rua Joaquim Antunes, 480', cidade: 'São Paulo', estado: 'SP', preco: '3100000', area: '165', quartos: 3, suites: 2, banheiros: 4, vagas: 3, amenidades: ['Piscina', 'Academia', 'Elevador', 'Varanda'], descricao: 'Lançamento — garden com jardim privativo de 80m², acesso direto à área de lazer.', imagens: [foto('aurora-garden-102-a')], situacao: 'Lançamento', previsaoEntrega: 'Dezembro/2027', valorCondominio: '2100', valorIptu: '7200' },
    { imobiliariaId: imob.id, tipo: 'Terreno', finalidade: 'Venda', titulo: 'Quinta do Bosque — Lote 27', endereco: 'Estrada da Rhodia, km 4', cidade: 'Campinas', estado: 'SP', preco: '740000', area: '620', quartos: 0, suites: 0, banheiros: 0, vagas: 0, amenidades: ['Portaria 24h'], descricao: 'Lote plano em condomínio fechado, pronto para construir.', imagens: [foto('quinta-bosque-27-a')], valorCondominio: '300', valorIptu: '1200' },
  ]);

  await db.insert(schema.linksUteis).values([
    { imobiliariaId: imob.id, categoria: 'Bancos parceiros', titulo: 'Simulador de financiamento — Caixa', url: 'caixa.gov.br/simulador' },
    { imobiliariaId: imob.id, categoria: 'Bancos parceiros', titulo: 'Simulador de financiamento — Itaú', url: 'itau.com.br/credito-imobiliario' },
    { imobiliariaId: imob.id, categoria: 'Documentos', titulo: 'Checklist de documentos para análise de crédito', url: 'docs.novaimob.com.br/checklist-credito' },
    { imobiliariaId: imob.id, categoria: 'Documentos', titulo: 'Modelo de proposta de compra', url: 'docs.novaimob.com.br/modelo-proposta' },
    { imobiliariaId: imob.id, categoria: 'Comercial', titulo: 'Tabela de comissões vigente', url: 'docs.novaimob.com.br/tabela-comissoes' },
    { imobiliariaId: imob.id, categoria: 'Comercial', titulo: 'Guia de objeções mais comuns', url: 'docs.novaimob.com.br/guia-objecoes' },
  ]);

  // videoUrl aqui é um vídeo de teste de verdade (gerado com ffmpeg, 5s de barras de cor + tom,
  // já subido pro MinIO local via /api/uploads) — só pra validar o player de ponta a ponta; os 2
  // últimos treinamentos ficam sem vídeo de propósito, pra mostrar o estado "sem vídeo ainda".
  // (A URL pública "Big Buck Bunny" do Google que eu tentei usar antes voltou 403 — não fica
  // reutilizando URL externa sem confirmar que responde.)
  const minioBase = (process.env.MINIO_PUBLIC_URL || 'http://localhost:59000/hinode-imoveis').replace(/\/$/, '');
  const videoAmostra = minioBase + '/e20b4ede-ee01-4a89-8edc-37fbe0df0670/cb4204c2-49a9-4ec2-ad7a-3f9b3e22f54f.mp4';
  await db.insert(schema.treinamentos).values([
    { imobiliariaId: imob.id, titulo: 'Como conduzir a primeira ligação com o lead', descricao: 'Roteiro de abertura, perguntas de qualificação e como agendar a visita já na primeira conversa.', duracaoTexto: '12 min', categoria: 'Atendimento', videoUrl: videoAmostra },
    { imobiliariaId: imob.id, titulo: 'Follow-up automático: como configurar sua primeira sequência', descricao: 'Passo a passo pra montar um fluxo de mensagens automáticas no módulo Follow-up.', duracaoTexto: '8 min', categoria: 'Ferramenta', videoUrl: videoAmostra },
    { imobiliariaId: imob.id, titulo: 'Objeções de preço: como responder sem desconto', descricao: 'Técnicas de valorização do imóvel para contornar objeção de preço sem sacrificar a comissão.', duracaoTexto: '15 min', categoria: 'Vendas' },
    { imobiliariaId: imob.id, titulo: 'Documentação para análise de crédito', descricao: 'Quais documentos pedir logo cedo pra não travar a análise do banco depois.', duracaoTexto: '10 min', categoria: 'Financeiro' },
  ]);

  const dono = perfisRows.find(p => p.role === 'dono')!;
  const diego = perfisRows.find(p => p.nome === 'Diego Antunes')!;
  await db.insert(schema.notificacoes).values([
    { perfilId: dono.id, tipo: 'lead', titulo: 'Novo lead atribuído', texto: 'Beatriz Aguiar entrou na roleta e foi atribuída a Diego Antunes.', lida: false },
    { perfilId: dono.id, tipo: 'credito', titulo: 'Análise de crédito parada há 4 dias', texto: 'Renata Palhares está em Análise de Crédito sem movimentação.', lida: false },
    { perfilId: dono.id, tipo: 'plantao', titulo: 'Corretor fora do horário', texto: 'Marcelo Braga está bloqueado e não pode entrar na roleta.', lida: true },
    { perfilId: diego.id, tipo: 'lead', titulo: 'Novo lead atribuído a você', texto: 'Beatriz Aguiar foi atribuída a você pela roleta.', lida: false },
    { perfilId: diego.id, tipo: 'tarefa', titulo: 'Visita agendada amanhã', texto: 'Confirme a visita com Tiago Meireles antes das 10h.', lida: false },
  ]);

  console.log('Seed concluído. Login de teste: camila.rocha@novaimob.com.br / 123456');
}

main().then(() => sql.end()).catch(async e => { console.error(e); await sql.end(); process.exit(1); });
