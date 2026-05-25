import { Trophy, Calendar, Users, TrendingUp, ShoppingBag, ExternalLink } from 'lucide-react';

const BRAND = '#E30B5C';

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ResultCard({ winner, isTV = false, onBuyClick }) {
  const sz = (phone, tv) => isTV ? tv : phone;

  const winningProduct = winner.winnerSide === 'A' ? winner.productA : winner.productB;
  const myVotedProduct = winner.votedSide  === 'A' ? winner.productA : winner.productB;
  const w = winner.winner;

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden flex flex-col">
      {/* 상단: 포스터 + 당첨자 */}
      <div className="flex">
        {/* 좌측 포스터 */}
        <div className={`relative shrink-0 ${sz('w-[110px] h-[140px]', 'w-[180px] h-[230px]')}`}>
          <img
            src={winningProduct.imgUrl}
            alt={winningProduct.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
          {/* WIN 뱃지 */}
          <div
            className={`absolute top-2 left-2 flex items-center gap-1 ${sz('px-1.5 py-0.5', 'px-2.5 py-1')} rounded-full shadow-lg`}
            style={{ background: `linear-gradient(135deg, ${BRAND}, #c4084e)` }}
          >
            <Trophy size={sz(9, 14)} className="text-white" />
            <span className={`${sz('text-[9px]', 'text-xs')} font-black text-white tracking-wider`}>WIN</span>
          </div>
          {/* 상품명 (포스터 하단) */}
          <p className={`absolute bottom-1.5 left-2 right-2 text-white font-bold ${sz('text-[9px]', 'text-sm')} leading-tight drop-shadow-lg truncate`}>
            {winningProduct.name}
          </p>
        </div>

        {/* 우측 당첨자 정보 */}
        <div className={`relative flex-1 min-w-0 flex flex-col justify-center overflow-hidden ${sz('px-3 py-2 gap-1.5', 'px-4 py-3 gap-2')}`}>
          {/* 흐린 배경 레이어 */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url(/TabGet/img/unsplash-1549465220.jpg)', filter: 'blur(6px)', transform: 'scale(1.1)' }}
          />
          <div className="absolute inset-0 bg-black/25" />

          {/* 콘텐츠 */}
          {/* 회차 배지 */}
          <span
            className={`relative self-start ${sz('text-[9px] px-1.5 py-0.5', 'text-xs px-2 py-1')} rounded-full font-black tracking-wider text-white`}
            style={{ background: `linear-gradient(135deg, ${BRAND}, #c4084e)` }}
          >
            🎉 {winner.round}회차 당첨
          </span>
          {/* 이름 + 지역 */}
          <div className="relative flex flex-col gap-0.5">
            <span className={`text-white font-black drop-shadow ${sz('text-[13px]', 'text-lg')} leading-none`}>{w.name}</span>
            <span className={`text-white/65 ${sz('text-[9px]', 'text-xs')} tracking-wide`}>{w.region} · ★{w.id}</span>
          </div>
          {/* 소감 */}
          <p className={`relative text-white/90 ${sz('text-[9px]', 'text-xs')} leading-snug italic line-clamp-3 border-l-2 pl-2`}
            style={{ borderColor: `${BRAND}90` }}>
            {w.message}
          </p>
        </div>
      </div>

      {/* 통계 */}
      <div className={`flex items-center justify-around border-t border-white/10 ${sz('px-2 py-1.5', 'px-4 py-2.5')}`}>
        <div className="flex items-center gap-1 text-white/60">
          <Calendar size={sz(10, 14)} />
          <span className={sz('text-[9px]', 'text-xs')}>{formatDate(winner.drawDate)}</span>
        </div>
        <div className="flex items-center gap-1 text-white/60">
          <Users size={sz(10, 14)} />
          <span className={sz('text-[9px]', 'text-xs')}>{winner.totalVotes.toLocaleString()}명</span>
        </div>
        <div className="flex items-center gap-1" style={{ color: BRAND }}>
          <TrendingUp size={sz(10, 14)} />
          <span className={`${sz('text-[9px]', 'text-xs')} font-bold`}>+{winner.voteMargin.toLocaleString()}표</span>
        </div>
      </div>

      {/* 내 투표 상품 구매 링크 */}
      <button
        onClick={() => onBuyClick?.(myVotedProduct)}
        className={`group w-full flex items-center gap-2 border-t border-white/10 ${sz('px-2.5 py-2', 'px-4 py-3')} hover:bg-white/5 transition-colors text-left`}
      >
        <div className={`relative shrink-0 ${sz('w-9 h-9', 'w-12 h-12')} rounded-lg overflow-hidden bg-white/10`}>
          <img src={myVotedProduct.imgUrl} alt={myVotedProduct.name} className="absolute inset-0 w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`${sz('text-[9px]', 'text-xs')} text-white/50 font-semibold tracking-wide`}>
            {winner.wasMyPickWinner ? '🎉 내가 픽한 상품이 1등!' : '💪 내가 응원한 상품'}
          </p>
          <p className={`${sz('text-[11px]', 'text-sm')} text-white font-bold truncate`}>
            {myVotedProduct.name}
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span
            className={`${sz('text-[10px] px-1.5 py-0.5', 'text-sm px-2.5 py-1')} rounded-md font-black text-white shadow`}
            style={{ background: `linear-gradient(135deg, ${BRAND}, #c4084e)` }}
          >
            -{myVotedProduct.discountPct}%
          </span>
          <div className="flex items-center gap-0.5 text-white/40 group-hover:text-white/80 mt-0.5">
            <ShoppingBag size={sz(9, 12)} />
            <ExternalLink size={sz(8, 11)} />
          </div>
        </div>
      </button>

    </div>
  );
}
