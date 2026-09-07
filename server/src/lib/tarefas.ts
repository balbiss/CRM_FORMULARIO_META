import { and, eq, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tarefas, notificacoes } from '../db/schema.js';
import { enviarPush } from './push.js';
import type { Server as SocketServer } from 'socket.io';

/** Varre tarefas que venceram e ainda não foram avisadas — notifica o corretor responsável
 *  (notificação no CRM + push pra quando estiver fora) e marca como avisada. */
export async function varrerTarefasVencidas(io: SocketServer): Promise<number> {
  const vencidas = await db.select().from(tarefas).where(and(
    eq(tarefas.concluida, false),
    eq(tarefas.avisada, false),
    lte(tarefas.venceEm, new Date()),
  ));
  for (const t of vencidas) {
    await db.update(tarefas).set({ avisada: true }).where(eq(tarefas.id, t.id));
    if (t.corretorId) {
      await db.insert(notificacoes).values({
        perfilId: t.corretorId, tipo: 'tarefa', titulo: 'Tarefa venceu', texto: t.titulo, lida: false,
      });
      enviarPush(t.corretorId, {
        title: 'Tarefa venceu', body: t.titulo, url: '/agenda', tag: 'tarefa-' + t.id,
      }).catch(() => {});
    }
    io.to('imobiliaria:' + t.imobiliariaId).emit('tarefa:venceu', { id: t.id, titulo: t.titulo, corretorId: t.corretorId });
  }
  return vencidas.length;
}
