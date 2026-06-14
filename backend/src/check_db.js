const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const campsCount = await prisma.lands_camps.count();
    const landsCount = await prisma.lands.count();
    const queueCount = await prisma.carbon_process_queue.count();
    const queueWithValCount = await prisma.carbon_process_queue.count({
      where: { carbon_process_queue_resultValue: { not: null } }
    });

    console.log('--- Database Stats ---');
    console.log(`lands_camps count: ${campsCount}`);
    console.log(`lands count: ${landsCount}`);
    console.log(`carbon_process_queue count: ${queueCount}`);
    console.log(`carbon_process_queue with resultValue count: ${queueWithValCount}`);

    console.log('\n--- Sample camps ---');
    const camps = await prisma.lands_camps.findMany({ take: 5 });
    console.log(camps);

    console.log('\n--- Sample lands (first 5) ---');
    const lands = await prisma.lands.findMany({ take: 5, include: { lands_camps: true } });
    console.log(lands.map(l => ({
      land_id: l.land_id,
      land_code: l.land_code,
      name: l.name,
      camp_name: l.lands_camps?.land_camp_name,
      area_size: l.area_size
    })));

    console.log('\n--- Sample carbon_process_queue ---');
    const queue = await prisma.carbon_process_queue.findMany({
      take: 5,
      where: { carbon_process_queue_resultValue: { not: null } }
    });
    console.log(queue);

  } catch (error) {
    console.error('Error querying db:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
