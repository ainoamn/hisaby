import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const logger = new Logger('EnsureBhdSub');

let ready = false;

/**
 * Same pattern as Nasab `ensureBhdSubColumn` — SSO must not depend on a
 * separate migrate job having already run on Render.
 */
export async function ensureBhdSubColumn(
  prisma: PrismaClient,
): Promise<boolean> {
  if (ready) return true;
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bhd_sub" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "users_bhd_sub_key" ON "users"("bhd_sub")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "users_bhd_sub_idx" ON "users"("bhd_sub")`,
    );
    ready = true;
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate|already exists/i.test(msg)) {
      ready = true;
      return true;
    }
    logger.warn(`ensureBhdSubColumn: ${msg.slice(0, 200)}`);
    return false;
  }
}
