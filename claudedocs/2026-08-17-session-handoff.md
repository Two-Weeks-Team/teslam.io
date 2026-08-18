# Session handoff — 2026-08-17

> **⚠️ 이 문서는 2026-08-18에 대체되었습니다 — `2026-08-18-session-handoff.md`.**
> 그 문서 §3이 여기 있는 틀린 전제 셋을 정정합니다:
> 프로덕션 D1에 `0003`이 적용됐다는 것(아니었다), `kbeauty.market`이 502라는 것
> (정상이다 — 193 안에서 잰 값이었다), 열린 PR이 없다는 것(#17이 있었다).

## §0 두 줄 요약

**차량 데이터를 받을 파이프의 양 끝이 생겼다.** 193 서버에 Fleet Telemetry 수신기가
실인증서로 떠서 Tesla 공식 검사를 통과했고, D1에 적립 원장이 생겨 재생·역행·과다
적립을 데이터베이스가 거부한다. 사이에 있어야 할 소비자와, 붙을 차량이 아직 없다.

**다음 세션 1순위** — Redis → D1 소비자. Tesla 계정 상태와 무관하게 가짜 신호로
끝까지 검증할 수 있는 유일한 남은 조각이다.

---

## §1 진행한 작업 (시간순)

### Phase A — 체인 스파이크 마무리 (PR #15, 병합)

DRV 인출 구조를 Stellar Testnet과 Base Sepolia 양쪽에서 실제로 돌려 검증했다.
합의된 세 조건: 적립은 오프체인, 인출은 비수탁, 사용자 비용 0원.

| | Stellar | Base Sepolia |
| --- | --- | --- |
| reader | 18,000 DRV · **0 XLM** | 18,000 DRV · **0 ETH** |
| 총량 봉인 | 발행계정 서명 가중치 0 | `mint` 함수 부재 |
| 비용 | 0.0001200 XLM / 7건 | 0.0000052 ETH / 4건 |
| 소유할 컨트랙트 | **0줄** | 1,577B + 1,429B |
| 사용자 서명 | 필요 | **불필요** |

외부 리뷰 9건 반영. 마지막 2건이 **조용히 도달 불가능한 종류**였다 —
`status.mjs`가 자산 코드만 대조해(Stellar에서 자산은 `(코드, 발행자)` 쌍) 남의
잔액을 우리 라벨로 표시할 수 있었고, 두 플로우가 부동소수를 자릿수 고정 없이 금액으로
변환하고 있었다(Stellar은 거부, `parseUnits`는 조용히 반올림).

공유용 실측 보고서: <https://claude.ai/code/artifact/f75dc9c8-cd9f-4146-8b47-3f9c3af7d587>

### Phase B — Tesla Fleet API 공식 문서 캡처 (PR #16, 병합)

`developer.tesla.com`이 HTTP 페처에 403을 반환해 에이전트도 CI도 읽을 수 없다.
실제 크롬으로 12페이지를 캡처해 `docs/reference/tesla-fleet-api/`에 저장하고,
재수집 스크립트(`capture.mjs`)를 붙였다. diff가 곧 Tesla의 변경 내역이 된다.

문서가 확정한 것 넷:

- **`Odometer`는 `Vehicle State`**, `vehicle_location` 스코프 불필요
- **`vehicle_location`이 2024년 말 분리됨** — 예전엔 딸려왔다
- **`Odometer`는 마일** — 모델은 km
- **스트리밍 $0.00667/차량·시간 vs 폴링 $0.12** (18배). 전자는 1÷149,925 USD/신호로
  `signalsPerUsd: 150000`과 사실상 일치 — **모델은 처음부터 옳았다**

> ⚠️ 제가 이 세션 중반에 "비용 모델이 75배 틀렸다"고 보고했는데 **그건 제가 틀린
> 것**이다. 스트리밍 요금으로 계산된 모델에 폴링 요금을 대입했다.

### Phase C — 좌표 제거 → 되살리기로 결정

문서 확인 후 `data/model.json`의 신호를 4개→2개로 줄였다(좌표 제외).
`tests/shared-data.test.ts`가 자기 은퇴 지시를 품고 있었고 그대로 뒤집혔다.

**그 뒤 사용자가 "위경도를 받아야지"로 방향을 정정.** 순서는
**설계만 선반영, 수집은 신고 후**로 합의.

여기서 **모델이 원래부터 틀렸던 것**을 발견: Fleet Telemetry의 `Location`은
위·경도를 담은 **신호 하나**다. 둘로 세고 있었다.

| | 신호 | 대당/월 | 500석/월 |
| --- | --- | --- | --- |
| 현재 (속도+오도) | 2 | ₩33.36 | ₩16,680 |
| **좌표 복원** | **3** | **₩50.04** | **₩25,020** |
| 구 모델 (위+경+속+오도) | 4 | ₩66.72 | ₩33,360 |

### Phase D — 적립 원장 (`b45f8b2`)

`0003_accrual.sql` — `vehicles` · `odometer_readings` · `drv_ledger` ·
`reading_locations`. 규칙을 코드가 아니라 **제약**에 뒀다.

로컬 D1에 실제로 공격했다:

```text
① 같은 순간 재기록 (재생)   거부됨  UNIQUE
② 같은 구간 재적립         거부됨  UNIQUE
③ 음수 거리               거부됨  CHECK
④ 음수 DRV                거부됨  CHECK
⑤ 없는 차량에 적립         거부됨  FOREIGN KEY
                          원장 잔여: 정당한 1건
```

> **첫 시도는 아무것도 검증하지 못했다.** 픽스처 INSERT가 실패해 두 테이블이 비어
> 있었고 다섯 공격이 전부 "통과"했는데 대상이 없었다. 잡아낸 건 행 수를 센 것.

`cloudflare/lib/accrual.ts` — 마일→km는 들어올 때 한 번만, 일일 상한은 서울 자정
기준이고 그 날짜를 행에 저장. 테스트 19개 중 **9개가 거부 케이스**.

### Phase E — Fleet Telemetry 수신기 (`8e59101`, `fc0f001`)

Tesla 문서: *"mTLS connections are terminated on the Fleet Telemetry service"* →
**기존 nginx 뒤에 둘 수 없다.** 443은 nginx가 11개 도메인에 쓰므로 4443 + 자체 인증서.

연기 테스트(localhost 바인딩)가 설정 결함 셋을 잡았다:

1. **`command:` 오버라이드가 이미지의 올바른 `Cmd`를 통째로 대체** → Docker가
   `-config`를 실행 파일로 취급 → `executable file not found in $PATH`
2. **Redis 디스패처가 `publish_vin_topics` 없이 패닉** — 모두 받고 하나도 발행하지
   않는 대신 아예 안 뜬다
3. **distroless UID 65532** — `0600` 개인키를 못 읽음 → `chown` (모드 확대 아님)

이후 DNS·인증서:

- 사용자가 Cloudflare에 `telemetry.teslam.io` A → `49.247.9.193`, **DNS only** 생성
- **wrangler로는 불가** — OAuth 스코프 22개에 `dns` 0건, `wrangler dns` 명령 없음
- **남의 프로덕션을 안 건드리는 방식**: ACME 전용 nginx 블록 파일 하나만 추가하고
  webroot로 발급. 추가 전 `default_server` 지정 여부를 **먼저** 확인
- 502 둘(`api.fairthon.com` 2618, `kbeauty.market` 10004)은 **원래 죽은 업스트림**임을
  포트까지 확인. *"원래 그랬을 것"* 은 남의 웹서버를 만진 뒤 할 말이 아니라서

> **`verify.sh`가 성공을 실패로 읽었다.** `openssl s_client`는 *정상* Fleet Telemetry
> 서버에 대해 0이 아닌 코드로 끝난다 — 인증서 받고, 체인 검증하고, 그다음
> `certificate required`로 거절. 서버가 mTLS를 하는데 클라이언트 인증서 없이 갔으니
> 당연하다. 이제 종료 코드를 무시하고 출력을 읽으며, **거절을 찾는다**.

---

## §2 현재 상태

### Branch

| Branch | 상태 |
| --- | --- |
| `main` | PR #15, #16 병합됨. 프로덕션 배포됨 |
| `feat/fleet-telemetry-receiver` | **push됨, PR 미제출**. 커밋 3개 (`8e59101`, `b45f8b2`, `fc0f001`) |

Open PR: **없음**

### Live

| | |
| --- | --- |
| <https://teslam.io> | 200 |
| `api.teslam.io/v1/capabilities` | `seats:true board:true` · 나머지 6개 `false` · `posts:0` |
| `telemetry.teslam.io:4443` | 수신기 running, mTLS 강제 |
| 인증서 | Let's Encrypt, **2026-11-15 만료**, 배포 훅 dry-run 통과 |
| Tesla 공식 검사 | `The server certificate is valid.` ✓ |

### 메트릭

```text
테스트   19 files · 293 passed
게이트   pass (lint · types · build · tests)
D1       0001 registrations · 0002 board · 0003 accrual
```

### 환경

```text
node v24.15.0 · pnpm 11.9.0 · wrangler 4.121.0
193 서버  Ubuntu 20.04.6 · Docker 28.1.1 · sudo 무암호
          ssh 49.247.9.193 (Port 17141, user barahime, ~/.ssh/config에 등록)
```

---

## §3 다음 세션에서 할 수 있는 것

### 즉시 가능 (외부 의존 없음)

1. **Redis → D1 소비자** ← 1순위
   수신기가 `teslam_*_{vin}` 채널로 발행한다. 소비자가 꺼내
   `odometer_readings`에 넣고 `accrue()`로 `drv_ledger`에 쓴다.
   **가짜 신호를 Redis에 직접 넣어 끝까지 검증 가능** — Tesla 계정도 차량도 불필요.

2. **`feat/fleet-telemetry-receiver` PR 제출**
   커밋 3개가 push만 되어 있다. 소비자까지 넣고 하나로 올릴지, 지금 올릴지는 선택.

3. **좌표 설계 선반영 마무리**
   `reading_locations` 테이블은 있으나 쓰기 경로가 없다. 소비자에 플래그로
   준비만 해두고 `data/model.json`은 그대로 둘 수 있다.

4. **마일→km 통합 테스트**
   `accrual.ts`에 변환은 있으나 실제 Tesla 페이로드 형태로 통과시키는 테스트가 없다.

### 사용자 입력 필요

1. **Tesla 개발자 앱 등록** — `developer.tesla.com` 사람 손. 앱 생성 →
   키쌍 → 공개키를 `https://teslam.io/.well-known/appspecific/com.tesla.3p.public-key.pem`
   에 게시 → 파트너 토큰 → `register`. **이게 없으면 차량이 붙지 않는다**
1. **위치정보법 신고** — 좌표 수집 개시 전 방송통신위원회 위치기반서비스사업 신고
1. **개인정보처리방침 개정** — 현재 *"어느 단계에서도 … 받지 않기 때문입니다"*.
   좌표를 받는 순간 거짓이 된다
1. **화이트페이퍼 개정** — PDF가 아직 ₩67 / ₩33,360.
   `data/whitepaper-params.json`의 `pendingRevision`이 강제 중

---

## §4 할 수 없는 것 (외부 변수)

| 항목 | 막는 것 |
| --- | --- |
| Tesla 앱 등록 | developer.tesla.com 계정 소유자만. 다단계 인증 필요 |
| 위치정보법 신고 | 법인 명의 행정 절차 |
| 규제 검토 | **미국 변호사** 예정 (미국법인). 시점 미정 |
| 화이트페이퍼 개정 | PDF 원본 소유자 |
| 메일 발송 | Google Workspace 설정 → `REGISTRATION_OPEN` 전환 |
| Cloudflare DNS 추가 편집 | wrangler 토큰은 `zone:read`. 대시보드 또는 별도 API 토큰 |

**미국법인이지만 한국법이 사라지지 않는다** — 한국어 UI, 원화 페그, 국내 가맹점
교환으로 한국 시장을 명확히 겨냥하므로 양쪽 검토가 필요하다.

---

## §5 추가로 필요한 것

### 사용자 확인

- **CDP API 키** — `scripts/chain/.env.local`에 살아 있다. 스파이크 진행 중이라
  **폐기하지 않기로** 확인됨 (2026-08-15)
- **체인 미결정** — Stellar / Base 둘 다 성립. 규제 검토 결과가 정해야 함
- **좌표 복원 시점** — 신고·방침 개정 완료 후

### 환경 점검

- 193 서버 여유: 메모리 17Gi / 디스크 150G
- 193에 컨테이너 15개 + 남의 도메인 11개가 돈다. **건드릴 때 주의**
- CORSAIR 외장 드라이브에 `teslaLogin` · `teslamate` · `fleet-telemetry`
  아카이브 (2024-09~10). 참조용, 공식 문서 기준으로 구현할 것

---

## §6 다음 세션 시작 프롬프트

```text
/handon

이전 세션 핸드오프: claudedocs/2026-08-17-session-handoff.md

읽고 다음 결정 사항에 답한 뒤 진행하세요:
1. Redis → D1 소비자를 지금 만들까요? (가짜 신호로 끝까지 검증 가능)
2. feat/fleet-telemetry-receiver PR을 지금 올릴까요, 소비자까지 넣고 올릴까요?
3. Tesla 개발자 앱 등록을 진행하실 수 있나요? (developer.tesla.com 사람 손)
4. 좌표 수집은 위치정보법 신고 후로 유지하나요?
```

---

## §7 핵심 자산 위치

| 경로 | 내용 |
| --- | --- |
| `cloudflare/migrations/0003_accrual.sql` | 적립 원장 스키마. 제약이 규칙 |
| `cloudflare/lib/accrual.ts` | 산술 · 마일→km · 서울 자정 상한 |
| `tests/accrual.test.ts` | 19개, 9개가 거부 케이스 |
| `deploy/fleet-telemetry/` | 수신기 compose · config · verify.sh · README |
| `deploy/fleet-telemetry/ops/` | nginx ACME 블록 · certbot 배포 훅 |
| `docs/reference/tesla-fleet-api/` | 공식 문서 12페이지 + `capture.mjs` |
| `scripts/chain/` | Stellar · Base 검증 스크립트 (PR #15 병합됨) |
| `data/model.json` | 모든 게시 수치의 유일한 입력 |
| `data/whitepaper-params.json` | 화이트페이퍼 전사 + `pendingRevision` |
| `~/teslam-fleet-telemetry/` (193) | 서버측 배포 디렉터리 |

---

## §8 알려진 issue / open question

1. **수신기는 준비됐고 붙을 차량이 없다.** Tesla 앱 등록이 관문
2. **Redis → D1 소비자 부재.** 수신기는 큐를 채우는 게 전부
3. **`reading_locations`에 쓰기 경로 없음** — 의도적. 신고 전까지 유지
4. **화이트페이퍼가 코드보다 뒤처짐** — `pendingRevision`이 강제 중.
   테스트는 통과하지만 PDF는 여전히 옛 수치
5. **`Location`은 신호 하나** — 모델이 위·경도를 둘로 세던 게 처음부터 오류.
   복원 시 3신호(₩50.04)이지 4신호(₩67)가 아니다
6. **193의 502 둘** — `api.fairthon.com`(2618) · `kbeauty.market`(10004).
   우리 것이 아니고 원래 죽어 있었음. 서버 주인에게 알릴 가치 있음
7. **인증서 갱신 훅은 dry-run만 검증됨.** 실제 갱신은 2026-10월경
8. **league · quests · badges · wallet · garage · shop** — API가 전부 `false`.
   프론트는 완성돼 있어 소비자와 원장이 붙으면 열 수 있음
