import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { uploadFile } from '../lib/storage.js';
import { paraOggOpus } from '../lib/audio.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB — suficiente pra foto/vídeo curto de imóvel
  fileFilter: (_req, file, cb) => {
    if (/^image\/|^video\/|^audio\/|^application\/pdf$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido — só imagem, vídeo, áudio ou PDF'));
  },
});

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

uploadsRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  let buffer = req.file.buffer;
  let mimetype = req.file.mimetype;
  let ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase();

  // Áudio gravado no navegador vem como webm/opus — o WhatsApp só aceita ogg/opus como nota de voz.
  if (/^audio\//.test(mimetype) && !/ogg/.test(mimetype)) {
    const ogg = await paraOggOpus(buffer).catch(() => null);
    if (ogg) { buffer = ogg; mimetype = 'audio/ogg; codecs=opus'; ext = 'ogg'; }
  }

  const key = req.auth!.imobiliariaId + '/' + randomUUID() + '.' + ext;
  try {
    const url = await uploadFile(key, buffer, mimetype);
    res.status(201).json({ url, nome: req.file.originalname });
  } catch {
    res.status(502).json({ error: 'Não foi possível enviar o arquivo — armazenamento indisponível' });
  }
});

// multer chama next(err) em vez de lançar — precisa de um error handler dedicado pra virar JSON.
uploadsRouter.use((err: Error, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => {
  res.status(400).json({ error: err.message || 'Falha no upload' });
});
