import prisma from "@/lib/prisma";

export class LockManager {
  static async acquire(key: string, ttlMs = 30_000): Promise<boolean> {
    await prisma.mcxExecutionLock.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    try {
      await prisma.mcxExecutionLock.create({ data: { key, expiresAt: new Date(Date.now() + ttlMs) } });
      return true;
    } catch {
      return false;
    }
  }

  static async release(key: string) {
    await prisma.mcxExecutionLock.delete({ where: { key } }).catch(() => undefined);
  }
}
