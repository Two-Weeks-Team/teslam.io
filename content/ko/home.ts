/**
 * The community front page — Korean is the source of truth for the shape.
 *
 * Deliberately not `as const`, so `content/en/home.ts` can satisfy
 * `HomeContent` with English values while a missing key stays a compile error.
 *
 * The board content itself lives in `data/community.json` and is sample data.
 * `preview` below is the copy that says so on the page; it is not decoration
 * and must not be removed while the numbers are invented.
 */
export const home = {
  meta: {
    title: "teslam.io — 대한민국 테슬라 오너 성지",
    description:
      "달린 거리가 그대로 쌓이는 테슬라 오너 커뮤니티. 전비 리그, 인증샷, 소프트웨어 떡밥, 그리고 주행 보상 DRV. Genesis 500 모집 중.",
  },

  nav: {
    skip: "본문으로 건너뛰기",
    localeLabel: "EN",
    localeHref: "/en",
    cta: "Genesis 500",
    model: "운영 모델",
    online: "접속",
    people: "명",
  },

  preview: {
    tag: "서비스 준비 중",
    body: "아직 문을 열지 않았습니다. 아래 글·순위·적립 내역은 화면이 채워졌을 때를 보여주는 예시이며, 실제 활동이 아닙니다.",
  },

  hero: {
    badge: "대한민국 테슬라 오너 성지",
    h1: "여기가 테슬람 성지다.",
    h1b: "달린 거리는 거짓말을 안 한다.",
    sub: "테슬라 계정 한 번만 연결하면 끝. 주행 중 60초마다 올라오는 오도미터가 당신의 km를 대신 증명하고, 그대로 DRV로 쌓입니다. 개발자 계정도, API 요금도 없습니다.",
    ctaPrimary: "Genesis 500 합류하기",
    ctaSecondary: "어떻게 쌓이나요?",
  },

  genesis: {
    title: "Genesis 500 — 1기 정원",
    seatTaken: "찬 자리",
    seatLeft: "남은 자리",
    yours: "당신 자리",
    seatGridLabel: "500석 중 채워진 좌석 현황",
    perks: [
      "기본 적립 1.5배 · 영구 적용",
      "Genesis 1기 프로필 마크",
      "토크노믹스 변경 투표권",
    ],
    cta: "지금 자리 잡기",
    note: "선착순 500대. 등록은 외부 폼에서 진행되며 이 사이트는 개인정보를 저장하지 않습니다.",
  },

  league: {
    eyebrow: "전비 리그",
    title: "이번 주, 당신은 몇 위입니까",
    sub: "GPS 아니고 오도미터로 검증된 기록만 올라갑니다.",
    weekLabel: "주차",
    closesIn: "마감까지",
    days: "일",
    cols: {
      pos: "순위",
      driver: "드라이버",
      region: "지역",
      eff: "전비",
      km: "주행",
      drv: "DRV",
      streak: "연속",
    },
    omitted: "명 생략",
    yourRow: "당신 자리 — ??",
    yourRowNote: "연결하면 여기에 이름이 박힙니다",
    all: "전체 순위 보기",
    unit: "km/kWh",
    dayUnit: "일",
  },

  feed: {
    eyebrow: "게시판",
    title: "지금 올라온 글",
    tabs: { hot: "인기", latest: "최신", shots: "인증샷", quest: "퀘스트" },
    pinned: "공지",
    staff: "운영",
    newPosts: "새 글",
    lastHour: "최근 1시간",
    more: "글 더 보기",
    views: "조회",
    comments: "댓글",
  },

  side: {
    boards: "게시판",
    regions: "지역방",
    ranking: "랭킹",
    rankingItems: ["주간 효율", "주간 주행", "명예의 전당"],
  },

  wallet: {
    title: "내 DRV 지갑",
    balance: "사용 가능 잔액",
    worth: "실물 교환가 약",
    todayCap: "오늘 적립",
    capNote: "하루 상한 50km까지. 나머지는 내일의 나에게.",
    ledgerTitle: "적립 내역",
    ledgerNote: "오도미터로 검증된 구간만 기록됩니다",
    shopTitle: "바꿀 수 있는 것",
    shopNote: "교환하면 DRV는 소각되고, 제휴사 수수료가 API 비용을 냅니다.",
    tslmTitle: "DRV 묶어두기",
    tslmNote:
      "DRV를 30일 묶으면 TSLM이 나옵니다. TSLM은 1억 개 고정이고, 광고 집행권과 투표권이 붙습니다.",
    connect: "테슬라 계정 연결하기",
  },

  live: { title: "실시간", auto: "자동 갱신" },

  footer: {
    line: "달린 만큼 쌓이는 테슬라 오너 커뮤니티.",
    contactLabel: "문의",
    repoLabel: "이 사이트의 소스",
    modelLabel: "운영 모델과 비용 구조",
    snapshot: "데이터 기준일",
    disclaimerTrademark:
      "teslam.io는 Tesla, Inc.와 제휴하거나 후원받는 관계가 아닌 독립 커뮤니티 프로젝트입니다. Tesla, Supercharger는 Tesla, Inc.의 상표입니다.",
    disclaimerFinancial:
      "DRV와 TSLM은 아직 발행되지 않았습니다. 이 페이지의 수치는 운영 모델의 계산 또는 예시이며 투자 권유나 수익 보장이 아닙니다.",
    rights: "teslam.io",
  },
};

export type HomeContent = typeof home;
