import { prisma } from '../db/prisma'; // 경로 확인 (src/db/prisma.ts)

async function reset() {
  console.log('🗑️ DB 데이터 전체 삭제 시작...');
  
  // 집계 데이터 먼저 삭제 (참조 관계가 있을 수 있으므로)
  const deletedAgg = await prisma.candleAgg.deleteMany();
  console.log(`   - CandleAgg (집계봉): ${deletedAgg.count}개 삭제 완료`);

  // 1분봉 데이터 삭제
  const deleted1m = await prisma.candle1m.deleteMany();
  console.log(`   - Candle1m (1분봉): ${deleted1m.count}개 삭제 완료`);

  console.log('✨ DB가 깨끗하게 비워졌습니다.');
}

reset()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });