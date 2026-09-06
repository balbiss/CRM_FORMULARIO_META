import { spawn } from 'node:child_process';

/** Converte um áudio (ex.: webm/opus gravado no navegador) pra ogg/opus — o formato que o
 *  WhatsApp aceita como nota de voz. Usa o ffmpeg do container. Se falhar, devolve null e
 *  o chamador manda o original mesmo. */
export function paraOggOpus(entrada: Buffer): Promise<Buffer | null> {
  return new Promise(resolve => {
    const ff = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-c:a', 'libopus', '-b:a', '32k', '-ar', '48000', '-ac', '1',
      '-f', 'ogg', 'pipe:1',
    ]);
    const out: Buffer[] = [];
    ff.stdout.on('data', d => out.push(d));
    ff.on('error', () => resolve(null));
    ff.on('close', code => resolve(code === 0 && out.length ? Buffer.concat(out) : null));
    ff.stdin.on('error', () => {});
    ff.stdin.write(entrada);
    ff.stdin.end();
  });
}
