import { API_URL } from './api';

export async function uploadArquivo(file: File, token: string): Promise<{ url: string; nome: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(API_URL + '/api/uploads', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || 'Falha no upload');
  }
  return res.json();
}

export function tipoDeArquivo(mime: string): 'imagem' | 'video' | 'documento' | 'audio' {
  if (mime.startsWith('image/')) return 'imagem';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'documento';
}
