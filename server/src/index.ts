import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';
import { authRouter } from './routes/auth.js';
import { leadsRouter } from './routes/leads.js';
import { colunasRouter } from './routes/colunas.js';
import { filasRouter } from './routes/filas.js';
import { perfisRouter } from './routes/perfis.js';
import { templatesRouter } from './routes/templates.js';
import { imoveisRouter } from './routes/imoveis.js';
import { uploadsRouter } from './routes/uploads.js';
import { linksUteisRouter } from './routes/linksUteis.js';
import { treinamentosRouter } from './routes/treinamentos.js';
import { notificacoesRouter } from './routes/notificacoes.js';
import { mensagensRouter } from './routes/mensagens.js';
import { captacaoRouter } from './routes/captacao.js';
import { tagsRouter } from './routes/tags.js';
import { configRouter } from './routes/config.js';
import { verifyToken } from './lib/jwt.js';
import { ensureBucket } from './lib/storage.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/colunas', colunasRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/imoveis', imoveisRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/links-uteis', linksUteisRouter);
app.use('/api/treinamentos', treinamentosRouter);
app.use('/api/notificacoes', notificacoesRouter);
app.use('/api/config', configRouter);

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:5173' } });

// Cada socket entra na "sala" da própria imobiliária — todo broadcast de dado usa esse escopo.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token ausente'));
  try {
    socket.data.claims = verifyToken(token);
    next();
  } catch {
    next(new Error('Token inválido'));
  }
});
io.on('connection', socket => {
  socket.join('imobiliaria:' + socket.data.claims.imobiliariaId);
});

app.use('/api/leads', leadsRouter(io));
app.use('/api/filas', filasRouter(io));
app.use('/api/perfis', perfisRouter(io));
app.use('/api/mensagens', mensagensRouter(io));
app.use('/api/captacao', captacaoRouter(io));
app.use('/api/tags', tagsRouter(io));

const port = Number(process.env.PORT) || 3001;
ensureBucket()
  .catch(err => console.error('MinIO: não foi possível preparar o bucket —', err.message))
  .finally(() => httpServer.listen(port, () => console.log('NOVA backend rodando em http://localhost:' + port)));
