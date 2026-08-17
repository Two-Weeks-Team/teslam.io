#!/bin/sh
# 갱신된 인증서를 수신기에 반영한다.
#
# 이게 없으면 90일 뒤 조용히 만료되고, 차량은 붙지 않는데 컨테이너는
# 정상으로 보인다 — 안에서 보면 완벽히 건강한 서버다.
set -e
[ "$RENEWED_LINEAGE" = "/etc/letsencrypt/live/telemetry.teslam.io" ] || exit 0
D=/home/barahime/teslam-fleet-telemetry
cp "$RENEWED_LINEAGE/fullchain.pem" "$D/tls/fullchain.pem"
cp "$RENEWED_LINEAGE/privkey.pem"   "$D/tls/privkey.pem"
chown 65532:65532 "$D/tls/privkey.pem"; chmod 600 "$D/tls/privkey.pem"
chown barahime:barahime "$D/tls/fullchain.pem"; chmod 644 "$D/tls/fullchain.pem"
cd "$D" && docker compose restart fleet-telemetry
