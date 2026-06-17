const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const socCount = await prisma.carbon_soc.count();
  console.log('SOC row count:', socCount);
  if (socCount > 0) {
    const soc = await prisma.carbon_soc.findFirst();
    console.log('Sample SOC row:', soc);
  }

  const pqCount = await prisma.carbon_process_queue.count();
  console.log('Process Queue row count:', pqCount);
  if (pqCount > 0) {
    const pq = await prisma.carbon_process_queue.findFirst();
    console.log('Sample Process Queue row:', pq);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
