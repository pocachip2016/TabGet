// 과거 회차 당첨 결과 데이터 — 현재 메인 화면의 진행 중 polls(VS_DATA)와는 별개.
// 결과 페이지는 이 데이터를 기반으로 카드 그리드를 렌더링한다.

// round 시드로 deterministic A/B 선택 — 새로고침해도 동일 결과 유지.
function pickVotedSide(round) {
  return (round * 7919) % 2 === 0 ? 'A' : 'B';
}

const RAW = [
  {
    round: 1,
    drawDate: '2026-05-23',
    productA: {
      name: 'iPad Pro M4',
      imgUrl: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?auto=format&fit=crop&q=80&w=600',
      buyUrl: 'https://shopping.ktalpha.com/product/ipad-pro-m4',
      discountPct: 18,
    },
    productB: {
      name: 'Galaxy Tab S10 Ultra',
      imgUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80&w=600',
      buyUrl: 'https://shopping.ktalpha.com/product/galaxy-tab-s10-ultra',
      discountPct: 22,
    },
    votesA: 12450,
    votesB: 11820,
    winner: {
      region: '서울 관악구',
      name: '박XX',
      id: 8895,
      message: '진짜 당첨될 줄 몰랐어요!! 너무 행복해요 🎉',
    },
  },
  {
    round: 2,
    drawDate: '2026-05-22',
    productA: {
      name: 'Sony WH-1000XM5',
      imgUrl: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=600',
      buyUrl: 'https://shopping.ktalpha.com/product/sony-wh1000xm5',
      discountPct: 30,
    },
    productB: {
      name: 'Bose QC Ultra',
      imgUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=600',
      buyUrl: 'https://shopping.ktalpha.com/product/bose-qc-ultra',
      discountPct: 25,
    },
    votesA: 10300,
    votesB: 11200,
    winner: {
      region: '부산 해운대구',
      name: '김XX',
      id: 7203,
      message: '친구한테 자랑했더니 부러워해요 ㅋㅋ 감사합니다!',
    },
  },
  {
    round: 3,
    drawDate: '2026-05-21',
    productA: {
      name: 'iPhone 15 Pro Max',
      imgUrl: 'https://images.unsplash.com/photo-1592286927505-1def25115558?auto=format&fit=crop&q=80&w=600',
      buyUrl: 'https://shopping.ktalpha.com/product/iphone-15-pro-max',
      discountPct: 12,
    },
    productB: {
      name: 'Galaxy S24 Ultra',
      imgUrl: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&q=80&w=600',
      buyUrl: 'https://shopping.ktalpha.com/product/galaxy-s24-ultra',
      discountPct: 20,
    },
    votesA: 15800,
    votesB: 13400,
    winner: {
      region: '인천 연수구',
      name: '이XX',
      id: 4521,
      message: '이런 이벤트 처음인데 당첨되다니 대박 🙏',
    },
  },
  {
    round: 4,
    drawDate: '2026-05-20',
    productA: {
      name: 'MacBook Air M3',
      imgUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=600',
      buyUrl: 'https://shopping.ktalpha.com/product/macbook-air-m3',
      discountPct: 15,
    },
    productB: {
      name: 'LG gram 17',
      imgUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80&w=600',
      buyUrl: 'https://shopping.ktalpha.com/product/lg-gram-17',
      discountPct: 28,
    },
    votesA: 9700,
    votesB: 8400,
    winner: {
      region: '대전 유성구',
      name: '최XX',
      id: 6712,
      message: '배송도 빠르고 상품도 너무 좋아요! 또 참여할게요 💝',
    },
  },
  {
    round: 5,
    drawDate: '2026-05-19',
    productA: {
      name: 'Nintendo Switch OLED',
      imgUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=600',
      buyUrl: 'https://shopping.ktalpha.com/product/switch-oled',
      discountPct: 10,
    },
    productB: {
      name: 'Steam Deck OLED',
      imgUrl: 'https://sm.pcmag.com/t/pcmag_me/review/v/valve-stea/valve-steam-deck-oled_78cn.3840.jpg',
      buyUrl: 'https://shopping.ktalpha.com/product/steam-deck-oled',
      discountPct: 17,
    },
    votesA: 7400,
    votesB: 8900,
    winner: {
      region: '광주 광산구',
      name: '정XX',
      id: 9134,
      message: '반신반의했는데 진짜 당첨!! 믿고 참여하세요 👍',
    },
  },
];

export const WINNERS = RAW.map((w) => {
  const winnerSide = w.votesA >= w.votesB ? 'A' : 'B';
  const votedSide  = pickVotedSide(w.round);
  return {
    ...w,
    winnerSide,
    votedSide,
    totalVotes: w.votesA + w.votesB,
    voteMargin: Math.abs(w.votesA - w.votesB),
    wasMyPickWinner: votedSide === winnerSide,
  };
});
