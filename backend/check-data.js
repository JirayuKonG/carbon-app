const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const queues = await p.carbon_process_queue.findMany({
    where: { carbon_process_queue_resultValue: { not: null } },
    include: { units: true },
    take: 5,
  });
  
  console.log('=== Queue with resultValue ===');
  queues.forEach(q => {
    console.log({
      id: q.carbon_process_queue_id,
      log_act_detail_id: q.log_act_detail_id,
      resultValue: q.carbon_process_queue_resultValue?.toString(),
      unit_id: q.unit_id_resultValue,
      unit_name: q.units?.unit_name,
      unit_initial: q.units?.unit_initial,
    });
  });

  const lad = await p.log_activities_detail.findMany({
    take: 3,
    include: {
      activities_header: { select: { activities_header_startDate: true, activities_header_create_at: true } }
    }
  });
  console.log('\n=== LAD + activities_header ===');
  lad.forEach(l => {
    console.log({
      id: l.log_act_detail_id,
      startDate: l.activities_header.activities_header_startDate,
      createAt: l.activities_header.activities_header_create_at,
    });
  });
}

main().catch(console.error).finally(() => p.$disconnect());
