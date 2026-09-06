import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Cifra de tokens sensíveis (ex.: access_token do Facebook) em repouso — AES-256-GCM.
 *  A chave vem de INTEGRACOES_ENC_KEY (base64, 32 bytes):
 *    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" */
function getKey(): Buffer {
  const raw = process.env.INTEGRACOES_ENC_KEY;
  if (!raw) throw new Error('INTEGRACOES_ENC_KEY não configurada (veja server/.env)');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('INTEGRACOES_ENC_KEY precisa ter 32 bytes em base64');
  return key;
}

export interface CifraResultado { cifrado: string; iv: string; tag: string }

export function cifrar(texto: string): CifraResultado {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return { cifrado: cifrado.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function decifrar({ cifrado, iv, tag }: CifraResultado): string {
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, 'base64')), decipher.final()]).toString('utf8');
}
