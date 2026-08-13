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
    body: "아직 문을 열지 않았습니다. 등록 좌석수·지역 분포·접속자 수는 실제 수치이고, 아래의 글·순위·지갑 내역은 화면이 채워졌을 때를 보여주는 예시입니다.",
    // 재생 중에는 위의 문장이 거짓이 됩니다 — 좌석수도 지역 분포도 실측이
    // 아니게 되므로, 배너 자체가 그 사이에만 다른 말을 해야 합니다.
    demoTag: "시뮬레이션",
    demoBody:
      "지금 화면의 좌석수·지역 분포는 재생 중인 시뮬레이션입니다. 실제 등록이 아닙니다. 정지하면 실제 수치로 돌아옵니다.",
    realLabel: "실제 수치",
    sampleLabel: "예시",
    countStale: "집계를 불러오지 못했습니다 — 아래 수치는 현재 값이 아닙니다.",
  },

  hero: {
    badge: "대한민국 테슬라 오너 성지",
    h1: "여기가 테슬람 성지다.",
    h1b: "달린 거리는 거짓말을 안 한다.",
    sub: "테슬라 계정 한 번만 연결하면 끝. 주행 중 60초마다 올라오는 오도미터가 당신의 km를 대신 증명하고, 그대로 DRV로 쌓입니다. 개발자 계정도, API 요금도 없습니다.",
    ctaPrimary: "Genesis 500 합류하기",
    // 등록을 아직 받지 않는 동안의 라벨. "합류하기"는 지금 할 수 없는 일을
    // 권하는 문구라, 버튼이 데려가는 곳과 말이 어긋납니다.
    ctaPrimaryClosed: "Genesis 500 알아보기",
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
    ctaClosed: "Genesis 500 알아보기",
    empty: "500석 전부 비어 있습니다",
    emptyFirst: "첫 자리는 #001",
    note: "선착순 500대. 이메일, 차량 정보, 직접 고른 광역권, 동의 기록을 보관합니다. 좌표와 차대번호는 받지 않습니다.",
  },

  demo: {
    play: "채워지는 과정 보기",
    stop: "정지하고 실제 수치로",
    // 재생 내내 떠 있는 문구입니다. 스크롤 도중 들어온 사람도 지금 보이는
    // 숫자가 무엇인지 알 수 있어야 합니다.
    flag: "시뮬레이션 재생 중 — 화면의 수치는 실제 등록이 아닙니다",
    hint: "500석이 차는 과정을 재생해 볼 수 있습니다. 정지하면 실제 수치로 돌아옵니다.",
  },

  density: {
    title: "지금, 어디에 몇 명",
    sub: "등록이 확정된 좌석의 지역 분포입니다. 좌표가 아니라 본인이 고른 광역권입니다.",
    empty: "아직 어느 권역에도 등록이 없습니다",
    emptySub: "첫 등록이 이 지도에 처음 켜지는 불이 됩니다.",
    // 지도를 실제 행정경계로 바꾸면서 이 문장이 거짓이 됐었습니다. "도식"은
    // 블롭 일곱 개를 그리던 시절의 변명이었고, 그림을 고친 커밋이 문장을
    // 그대로 두는 바람에 사이트가 자기 그림을 잘못 설명하고 있었습니다.
    note: "실제 행정경계를 일곱 권역으로 묶은 지도입니다. 다만 등록자는 좌표를 남기지 않으므로, 이 그림이 말할 수 있는 것은 권역별 인원수까지입니다. 리그는 아는 얼굴이 있어야 돌고 상환처는 생활권에 있어야 쓰이므로, 총계보다 이 분포가 중요합니다.",
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
