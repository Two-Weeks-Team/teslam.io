/**
 * 등록 흐름의 문구.
 *
 * 이 화면은 사이트에서 유일하게 개인정보를 받는 곳입니다. 그래서 문구의 기준이
 * 하나 더 있습니다 — 받는 것과 **받지 않는 것**을 같은 크기로 적을 것. 위치와
 * 차대번호를 요구하지 않는다는 사실이 이 제품의 신뢰 근거인데, 정작 신청 화면이
 * 그걸 말하지 않으면 읽는 사람은 알 길이 없습니다.
 */

export type GenesisContent = {
  meta: { title: string; description: string };
  eyebrow: string;
  title: string;
  lede: string;
  seatsLabel: string;
  countStale: string;
  ofSeats: string;

  form: {
    emailLabel: string;
    emailHint: string;
    modelLabel: string;
    trimLabel: string;
    regionLabel: string;
    kmLabel: string;
    kmHint: string;
    choose: string;
    consentTerms: string;
    consentPrivacy: string;
    consentMarketing: string;
    consentMarketingHint: string;
    submit: string;
    submitting: string;
  };

  notCollected: { title: string; items: string[] };

  errors: {
    invalid: string;
    rateLimited: string;
    network: string;
    fieldMissing: string;
  };

  pending: { title: string; body: string; resend: string };
  already: { title: string; body: string };

  confirm: {
    meta: { title: string; description: string };
    working: string;
    seatTitle: string;
    seatLabel: string;
    seatOf: string;
    waitlistTitle: string;
    waitlistLabel: string;
    waitlistBody: string;
    nameplate: string;
    share: string;
    shareCopied: string;
    backHome: string;
    failedTitle: string;
    failedBody: string;
    notToken: string;
  };

  disclaimer: string;
};

export const genesis: GenesisContent = {
  meta: {
    title: "Genesis 500 등록 — teslam.io",
    description:
      "Genesis 500 1기 좌석 사전 등록. 이메일과 차량 정보만 받고 위치나 차대번호는 받지 않습니다.",
  },
  eyebrow: "0단계 — 사전 등록",
  title: "500대 중 한 자리",
  lede: "서비스는 아직 시작 전입니다. 지금 하는 것은 폐쇄 베타가 열릴 때 먼저 초대받을 순서를 잡는 것이고, 그 이상은 아무것도 약속하지 않습니다.",
  seatsLabel: "지금까지 확정된 좌석",
  countStale: "집계를 불러오지 못했습니다 — 아래 숫자는 현재 값이 아닙니다",
  ofSeats: "500석 중",

  form: {
    emailLabel: "이메일",
    emailHint: "확인 메일을 보냅니다. 답하지 않으면 좌석이 배정되지 않습니다.",
    modelLabel: "모델",
    trimLabel: "트림",
    regionLabel: "주로 타는 지역",
    kmLabel: "월 주행거리",
    kmHint: "대략이면 됩니다. 보상 모델을 실제 분포로 검증하는 데만 씁니다.",
    choose: "선택",
    consentTerms: "이용약관에 동의합니다",
    consentPrivacy: "개인정보 수집·이용에 동의합니다",
    consentMarketing: "서비스 소식을 메일로 받겠습니다",
    consentMarketingHint: "선택입니다. 동의하지 않아도 좌석은 그대로입니다.",
    submit: "좌석 신청",
    submitting: "보내는 중",
  },

  notCollected: {
    title: "받지 않는 것",
    items: [
      "위치 정보 — 좌표도, 경로도, 주행 기록도",
      "차대번호(VIN) — 차량 결속은 나중에 테슬라 공식 인증으로만",
      "전화번호·주소·생년월일",
      "결제 정보 — 사전 등록에는 어떤 대가도 없습니다",
    ],
  },

  errors: {
    invalid: "입력을 다시 확인해 주세요.",
    rateLimited: "잠시 후 다시 시도해 주세요. 짧은 시간에 너무 여러 번 보냈습니다.",
    network: "연결이 되지 않았습니다. 잠시 후 다시 시도해 주세요.",
    fieldMissing: "이 항목이 필요합니다",
  },

  pending: {
    title: "메일을 확인해 주세요",
    body: "확인 링크를 보냈습니다. 링크를 열면 좌석 번호가 배정됩니다. 아직은 좌석이 잡히지 않은 상태입니다.",
    resend: "메일이 오지 않았다면 같은 주소로 다시 신청하시면 새 링크를 보냅니다.",
  },

  already: {
    title: "이미 좌석이 있습니다",
    body: "이 주소로는 이미 확인이 끝났습니다. 좌석 번호를 잊으셨다면 hello@teslam.io 로 알려드립니다.",
  },

  confirm: {
    meta: {
      title: "좌석 확인 — teslam.io",
      description: "Genesis 500 좌석 배정 결과입니다.",
    },
    working: "확인하는 중",
    seatTitle: "좌석이 확정되었습니다",
    seatLabel: "좌석 번호",
    seatOf: "500석 중",
    waitlistTitle: "대기 순번을 받았습니다",
    waitlistLabel: "대기 번호",
    waitlistBody:
      "500석이 모두 찼습니다. 앞자리에서 취소가 나오면 순번대로 연락드립니다.",
    nameplate: "등록한 차량",
    share: "좌석 이미지 링크 복사",
    shareCopied: "복사했습니다",
    backHome: "보드로 가기",
    failedTitle: "링크가 작동하지 않습니다",
    failedBody:
      "이미 사용된 링크이거나 만료된 링크입니다. 같은 주소로 다시 신청하시면 새 링크를 보냅니다.",
    notToken: "확인 링크로 접근해 주세요.",
  },

  disclaimer:
    "DRV와 TSLM은 발행된 바 없습니다. 좌석은 금전적 가치를 가지지 않으며 양도·매매의 대상이 아닙니다. 사전 등록에 어떤 대가도 받지 않으며, 저희 이름으로 금전을 요구하는 연락은 저희가 보낸 것이 아닙니다.",
};
