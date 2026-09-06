import bcrypt from 'bcryptjs';
import { eq, and, sql, isNotNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { adminsPlataforma, imobiliarias } from '../db/schema.js';

/** Cria o 1º admin da plataforma a partir de PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD
 *  se a tabela estiver vazia. Idempotente. */
export async function bootstrapAdminPlataforma() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase();
  const senha = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !senha) return;

  const [existe] = await db.select({ id: adminsPlataforma.id }).from(adminsPlataforma).limit(1);
  if (existe) return;

  const senhaHash = await bcrypt.hash(senha, 10);
  await db.insert(adminsPlataforma).values({
    nome: process.env.PLATFORM_ADMIN_NAME || 'Administrador',
    email,
    senhaHash,
  });
  console.log('Plataforma: admin inicial criado —', email);
}

/** Bloqueia automaticamente imobiliárias ativas cujo vencimento passou + a carência delas,
 *  marcando o motivo como 'inadimplencia'. Registrar um pagamento reativa. */
export async function varrerInadimplencia() {
  const hoje = new Date().toISOString().slice(0, 10);
  const bloqueadas = await db
    .update(imobiliarias)
    .set({ status: 'bloqueada', bloqueioMotivo: 'inadimplencia' })
    .where(and(
      eq(imobiliarias.status, 'ativa'),
      isNotNull(imobiliarias.proximoVencimento),
      sql`(${imobiliarias.proximoVencimento}::date + ${imobiliarias.diasCarencia} * interval '1 day') < ${hoje}::date`,
    ))
    .returning({ id: imobiliarias.id, nome: imobiliarias.nome });
  if (bloqueadas.length) {
    console.log('Plataforma: bloqueadas por inadimplência —', bloqueadas.map(b => b.nome).join(', '));
  }
  return bloqueadas.length;
}
