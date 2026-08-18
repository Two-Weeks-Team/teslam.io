# Session handoff — 2026-08-18

## §0 두 줄 요약

**파이프가 프로덕션에서 살아 있다.** 차량의 TLS 악수부터 `drv_ledger` 한 행까지
전 구간이 배포·검증됐고, 붙을 차량이 없을 뿐이다. 가입은 열려 있고 좌석 #1이 이미
찼다.

**다음 세션 1순위** — `developer.tesla.com` 앱 등록. 사람 손이 필요하고, 이것 하나가
남은 유일한 관문이다. 절차는 `docs/tesla-app-registration.md`.

---

## §1 한 작업

| 항목 | PR | 결과 |
| --- | --- | --- |
| Redis → D1 소비자 | #18 | 병합 · 프로덕션 배포 |
| 적립 원장 프로덕션 반영 | — | `0003`·`0004` 적용 |
| Genesis 가입 개방 | #17 | 병합 (충돌 해결 후) |
| 193 서버 502 진단 | — | 진단만, 미수정 |
| Tesla 등록 절차 문서 | #18 | `docs/tesla-app-registration.md` |
| 정정 · 정리 | #19 | 병합 · `verify.sh`가 소비자까지 검사 |

### 프로덕션 전환 순서 (재현용)

```text
1  d1 time-travel info          복원 지점 기록
2  d1 migrations apply --remote  0003 · 0004
3  secret put TELEMETRY_TOKEN    프리뷰와 다른 값
4  deploy --env=""               워커 76115e4e
5  consumer.env → api.teslam.io  193 재시작
```

**순서가 중요하다.** 새 크론이 `reading_locations`를 청소하므로 마이그레이션이
배포보다 먼저다. 반대로 했으면 그날 밤 03:17에 없는 테이블을 지우려다 실패했다.

---

## §2 나온 것

**파이프 전 구간 실측** — 193의 Redis에 연결되지 않은 VIN으로 발행:

```json
{"records":1,"received":1,"readings":0,"accruals":0,
 "skipped":{"unknown-vehicle":1}}
```

Redis → 소비자 → HTTPS → `api.teslam.io` → D1 조회까지 동작하면서 **프로덕션에
아무 행도 남기지 않았다.** 진짜 회원 1명이 있는 DB라 이 방식을 골랐다.

**Redis는 큐가 아니다.** `datastore/redis/redis.go`가 `Publish`를 쓴다. 구독자가
없으면 메시지는 사라지고, `reliable_ack: true`라 차량은 이미 전달됐다고 통보받은
뒤다. 오도미터는 *차이*로 적립하니 놓친 프레임은 다음 델타가 흡수하지만, **7일 초과
공백은 거부되고 좌표는 숨을 델타가 없다.**

**GitHub 부분 장애를 만나면 REST로 우회한다.** `gh pr create`는 GraphQL을 쓰고,
2026-08-18 00시경 그 계층만 503이었다. 같은 요청을 REST로 보내면 통과한다 — 다섯 번
재시도하는 대신 어느 계층이 죽었는지 먼저 확인하는 게 빠르다.

```sh
# pr.json — title · head · base · body 네 개가 있어야 한다
{"title":"제목","head":"chore/my-branch","base":"main","body":"본문"}

gh api --method POST repos/Two-Weeks-Team/teslam.io/pulls --input pr.json
```

어느 계층이 죽었는지 보는 법:

```sh
curl -s https://www.githubstatus.com/api/v2/components.json \
  | python3 -c "import json,sys; [print(c['name'], c['status']) \
      for c in json.load(sys.stdin)['components'] if c['status']!='operational']"
```

**`verify.sh`가 양쪽을 본다.** 인증서만 보던 것에 소비자 검사를 붙였다. "떠 있는가"가
아니라 "구독 중인가"를 묻는다 — 구독하지 않은 소비자는 모든 각도에서 건강해 보이면서
차가 보내는 신호를 전부 버린다.

---

## §3 이 세션이 반증한 것

**이전 핸드오프가 프로덕션 D1에 `0003`이 적용됐다고 했는데 아니었다.**
`0003`·`0004` 둘 다 미적용이었다. 프리뷰는 `0002`부터 미적용이었다. 적립 원장
스키마는 이 세션 전까지 어느 원격 DB에도 없었다.

**이전 핸드오프와 README가 `kbeauty.market`을 502로 기록했는데 정상이다.**
193 *안에서* 측정했고, 그 호스트의 `/etc/hosts`가 `kbeauty.market`을 `127.0.0.1`로
고정해 두었다. 요청이 자기 nginx로 돌아와 죽은 포트(10004)를 물어 502가 났다.
바깥에서는 Vercel이 200을 준다. **살아 있는 사이트를 두 문서에서 고장났다고 기록했다.**

밖에서 잰 진짜 목록 — `api.fairthon.com`(2618) · `api.somm.dev`(2621) ·
`toolpilot.agit101.com`(3000). 셋 다 리스너 없음. 우리 것 아니고, 요청당 로그 한 줄이
전부다(닫힌 루프백 포트는 즉시 거부).

**"열린 PR 없음"도 틀렸다.** #17이 다른 세션에서 올라와 있었고, 내가 #18에서 같은
`vars` 블록을 건드려 충돌시켰다.

**내가 오늘 심은 버그 하나.** 손상 프레임을 "거부하되 저장"해서 그게 기준점이 되고,
이후 모든 정상 판독이 영구 거부되게 만들었다. 첫 실측에서 잡혔다 → `0cc8a31`.

**외부 리뷰가 원장 오류 두 건을 더 잡았다** → `1b5898f`. 지연 프레임 이중 지급(20마일에
481 DRV), 그리고 판독·원장 사이 중단 시 구간 영구 소실.

---

## §4 할 수 없었던 것

| 항목 | 막는 것 |
| --- | --- |
| **Tesla 앱 등록** | `developer.tesla.com` 계정 소유자. 다단계 인증 |
| **키쌍 생성** | `node scripts/tesla/keypair.mjs` 한 번이면 되지만, 개인키를 만들고 백업하는 건 사람 결정 |
| `content/ko/legal.ts:49` 개정 | **법률 문안** — 직접 고치지 않음 |
| 화이트페이퍼 개정 | PDF 원본 소유자 |
| 위치정보법 신고 | 법인 명의 행정 절차 |
| kbeauty 트래픽 수정 | 다른 레포. 스토어프론트 캐시 설정 문제 |
| 193 죽은 vhost 정리 | 진단만 하기로 결정됨 |

---

## §5 현재 상태

### Live

| | |
| --- | --- |
| `teslam.io` | 200 · 가입 **열림** |
| `api.teslam.io` | 워커 `76115e4e` |
| `/v1/genesis/stats` | `open:true` · `taken:1` · 좌석 #1 (수도권) |
| `/v1/telemetry/ingest` | 200 (토큰) · 401 (무·오토큰) |
| `telemetry.teslam.io:4443` | mTLS, 인증서 2026-11-15 만료 |
| 193 소비자 | 구독 중 · `api.teslam.io`로 발송 |
| 프로덕션 D1 | `0001`–`0004` · registrations 1 · 원장 0 |
| 프리뷰 D1 | `0001`–`0004` · 픽스처 정리됨 |

### Git

| | |
| --- | --- |
| `main` | `718bd86` |
| 열린 PR | **0** |
| 오늘 병합 | #18 (파이프) · #17 (가입 개방) · #19 (정정·정리) |
| 작업 트리 | clean |

### 메트릭

```text
사이트   20 files · 300 passed
워커      5 files ·  98 passed   (telemetry.test.ts 39개)
lint     0 errors · 0 warnings
게이트    pass
```

### 환경

```text
node v24.15.0 · pnpm 11.9.0 · wrangler 4.121.0
193  ssh 49.247.9.193 (Port 17141, user barahime, ~/.ssh/config에 등록)
     Ubuntu 20.04.6 · Docker 28.1.1 · 16코어 · load 3/16 · 디스크 58%
```

### 복원 지점

```text
프로덕션 D1 (마이그레이션 직전)
000000f6-00000000-000050ca-e4feef958d677593cec50c3807a693fc
wrangler d1 time-travel restore teslam-genesis-production --bookmark=…
```

### 시크릿

`TELEMETRY_TOKEN`은 프로덕션·프리뷰가 **서로 다른 값**이고, 프로덕션 값은
Cloudflare와 193의 `consumer.env`(0600) 두 곳에만 있다. 대화에는 들어간 적 없다.

---

## §6 다음 세션 시작 프롬프트

```text
/handon

이전 세션 핸드오프: claudedocs/2026-08-18-session-handoff.md

읽고 다음 결정 사항에 답한 뒤 진행하세요:
1. Tesla 앱 등록을 지금 진행하시겠습니까? (developer.tesla.com, 사람 손)
   - 먼저 `node scripts/tesla/keypair.mjs`로 키쌍을 만들고 배포해야 합니다
   - 청구 한도가 기본 0이라 결제 수단 등록이 선행됩니다
2. 차량 연결(OAuth) 엔드포인트를 만들까요? 등록 전에도 코드는 쓸 수 있습니다
3. `content/ko/legal.ts:49`의 VIN 문구는 누가 언제 고칩니까?
   가입이 열려 있어 시한이 생겼습니다
4. league · quests · badges · wallet · garage · shop 중 다음은?
   프론트는 완성돼 있고 API가 전부 false입니다
```

---

## §7 핵심 자산 위치

| 경로 | 내용 |
| --- | --- |
| `cloudflare/lib/ingest.ts` | Redis 레코드 → 원장. 거부 규칙이 여기 |
| `cloudflare/lib/telemetry.ts` | protojson 파서. 문자열 숫자·NaN·null 처리 |
| `cloudflare/lib/accrual.ts` | 산술 · 마일→km · 서울 자정 상한 |
| `cloudflare/migrations/0003·0004` | 원장 스키마 · VIN 컬럼 |
| `cloudflare/telemetry.test.ts` | 39개, 실제 D1 대상 |
| `services/telemetry-consumer/` | 소비자 · Dockerfile |
| `deploy/fleet-telemetry/` | 수신기 · `verify.sh`(양쪽 검사) |
| `docs/tesla-app-registration.md` | 등록 절차, 공식 문서 기준 |
| `docs/reference/tesla-fleet-api/` | 공식 문서 12페이지 |
| `lib/tesla.ts` | 공개키 상수 (현재 `null`) |
| `scripts/tesla/keypair.mjs` | 키쌍 생성. 레포 안에 개인키 쓰기 거부 |

---

## §8 알려진 issue / open question

1. **차량이 없다.** Tesla 앱 등록이 유일한 관문
2. **`.well-known` 공개키가 404** — 키쌍 미생성. `lib/tesla.ts`가 `null`
3. **`content/ko/legal.ts:49`가 거짓이 될 예정** — "차대번호(VIN)는 어느 단계에서도
   받지 않는다"고 하는데 `0004`가 저장한다. 차량 연결이 열리는 순간 사실과 어긋난다
4. **좌표 수집은 꺼져 있다** — `COLLECT_LOCATION="false"`. 경로와 테스트는 있다
5. **화이트페이퍼가 코드보다 뒤처짐** — ₩67/₩33,360. `Location`은 신호 하나이므로
   복원 시 3신호(₩50.04)이지 4신호가 아니다
6. **손상된 *첫* 판독은 여전히 차량을 막는다** — 비교 대상이 없어서. 조치는 운영자가
   그 차량의 판독을 지우는 것이고, 징후는 `not-increasing` 카운트가 계속 오르는 것
7. **인증서 갱신 훅은 dry-run만 검증됨** — 실제 갱신은 2026-10월경
8. **193에 떠난 도메인 vhost 3개** — 오진의 원인이 된다. 정리 권장
9. **kbeauty 스토어프론트가 193을 초당 6요청으로 호출** — 다른 레포 건
10. **league · quests · badges · wallet · garage · shop** — API 전부 `false`.
    프론트는 완성돼 있어 원장이 채워지면 열 수 있다
