import { prisma } from "./prisma";

export async function ensureCreditAccount(userId: string) {
  const existing = await prisma.creditAccount.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.creditAccount.create({ data: { userId, balance: 0 } });
}