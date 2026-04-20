import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.match.count();
  const notified = await prisma.match.count({ where: { notifiedAt: { not: null } } });
  const pending = await prisma.match.count({ where: { notifiedAt: null } });

  console.log('Matches gesamt:', total);
  console.log('Gesendet:', notified);
  console.log('Ausstehend:', pending);

  const sample = await prisma.match.findFirst({
    where: { notifiedAt: { not: null } },
    include: { listing: { select: { title: true, price: true } } },
  });
  if (sample) console.log('Beispiel gesendet:', sample.listing.title, sample.notifiedAt);
}

main().catch(console.error).finally(() => prisma.$disconnect());
