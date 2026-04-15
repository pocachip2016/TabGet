import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// App.jsx VS_DATA 기반 초기 데이터
const MOCK_POLLS = [
  {
    category: "테크",
    themeTitle: "프리미엄 무선 이어폰 vs 최신형 스마트워치",
    productA: {
      name: "프리미엄 무선 이어폰",
      brand: "",
      features: [],
      imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800",
      videoUrl: "",
    },
    productB: {
      name: "최신형 스마트워치",
      brand: "",
      features: [],
      imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800",
      videoUrl: "",
    },
    baseVotesA: 12450,
    baseVotesB: 11820,
  },
  {
    category: "패션",
    themeTitle: "화이트 스니커즈 vs 어글리 슈즈",
    productA: {
      name: "화이트 스니커즈",
      brand: "",
      features: [],
      imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=800",
      videoUrl: "",
    },
    productB: {
      name: "어글리 슈즈",
      brand: "",
      features: [],
      imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800",
      videoUrl: "",
    },
    baseVotesA: 8900,
    baseVotesB: 9200,
  },
  {
    category: "음료",
    themeTitle: "아이스 아메리카노 vs 따뜻한 카페라떼",
    productA: {
      name: "아이스 아메리카노",
      brand: "",
      features: [],
      imageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=800",
      videoUrl: "",
    },
    productB: {
      name: "따뜻한 카페라떼",
      brand: "",
      features: [],
      imageUrl: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=800",
      videoUrl: "",
    },
    baseVotesA: 15600,
    baseVotesB: 14200,
  },
  {
    category: "게임",
    themeTitle: "고성능 게이밍 폰 vs 휴대용 게임 콘솔",
    productA: {
      name: "고성능 게이밍 폰",
      brand: "",
      features: [],
      imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=800",
      videoUrl: "",
    },
    productB: {
      name: "휴대용 게임 콘솔",
      brand: "",
      features: [],
      imageUrl: "https://images.unsplash.com/photo-1531525645387-7f14be1bdbbd?auto=format&fit=crop&q=80&w=800",
      videoUrl: "",
    },
    baseVotesA: 7800,
    baseVotesB: 8500,
  },
  {
    category: "자동차",
    themeTitle: "럭셔리 세단 vs 강력한 SUV",
    productA: {
      name: "럭셔리 세단",
      brand: "",
      features: [],
      imageUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=800",
      videoUrl: "",
    },
    productB: {
      name: "강력한 SUV",
      brand: "",
      features: [],
      imageUrl: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800",
      videoUrl: "",
    },
    baseVotesA: 21000,
    baseVotesB: 19500,
  },
];

async function main() {
  console.log("Seeding mock polls...");

  for (const poll of MOCK_POLLS) {
    // themeTitle 기준 중복 체크 → 이미 있으면 skip
    const exists = await prisma.poll.findFirst({
      where: { themeTitle: poll.themeTitle },
    });

    if (exists) {
      console.log(`  [skip] ${poll.themeTitle}`);
      continue;
    }

    const created = await prisma.poll.create({
      data: {
        category: poll.category,
        themeTitle: poll.themeTitle,
        productA: poll.productA,
        productB: poll.productB,
        baseVotesA: poll.baseVotesA,
        baseVotesB: poll.baseVotesB,
        status: "ACTIVE",
        scheduledAt: new Date(),
      },
    });

    console.log(`  [created] [${poll.category}] ${poll.themeTitle} → ${created.id}`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
