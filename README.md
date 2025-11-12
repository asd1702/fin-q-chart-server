# fin-q-chart-server

## Chart Server Aggregation & API

### 환경 개요
`Candle1m` 테이블에 1분 봉이 저장되고, 새로운 1분 봉이 생성될 때마다 5분 / 15분 / 1시간 / 4시간 봉을 자동으로 집계하여 `CandleAgg` 테이블에 upsert 합니다 (timeframe = 분 단위: 5,15,60,240).

### WebSocket 이벤트
클라이언트는 서버 (`/ws`) 에 연결하면 아래 형태 메시지를 수신합니다.

```jsonc
{ "type": "tick", "symbol": "BTC/USD", "price": 100.12, "timestamp": 1731400000 }
{ "type": "candle", "timeframe": "1m", "candle": { "symbol": "BTC/USD", "startTime": 1731400000, "open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 1234 } }
{ "type": "candle", "timeframe": "5m", "candle": { "symbol": "BTC/USD", "timeframe": 5, "startTime": 1731399700, "open": 98, "high": 102, "low": 97.5, "close": 100.5, "volume": 5555 } }
```

`tick` 는 실시간 체결(가격) 갱신용이고, `candle` 메시지는 봉이 **완성되는 시점** 에 한 번 전송됩니다.

### REST API

1. 최근 봉 조회
```
GET /api/candles/:symbol/:timeframe?limit=500
```
 timeframes: `1m | 5m | 15m | 1h | 4h`

응답:
```jsonc
{
  "symbol": "BTC/USD",
  "timeframe": "15m",
  "data": [ { "time": 1731400000, "open": 100, "high": 103, "low": 99, "close": 101, "volume": 9999 } ]
}
```

2. 과거 집계(백필)
```
POST /api/aggregate/build
Body: { "symbol": "BTC/USD", "timeframe": "1h" }
```
선택적으로 `from`, `to` (epoch seconds 또는 ISO 문자열) 를 넣으면 범위 제한 가능. 넣지 않으면 해당 심볼의 1분 데이터 전체 범위를 대상으로.

응답:
```jsonc
{ "symbol": "BTC/USD", "timeframe": "1h", "created": 123 }
```

### 실행 방법
1. `.env` 파일에 `DATABASE_URL`, `TWELVE_DATA_API_KEY`, 필요시 `STREAM_SYMBOLS` 설정.
2. 마이그레이션:
```bash
npx prisma migrate dev --name init
```
3. 개발 서버:
```bash
npm run dev
```

### 서버 구조 요약
- `src/server.ts`: Express + WebSocket 서버, Twelve Data 실시간 수신, 봉 생성/브로드캐스트.
- `src/candleMaker.ts`: 1분 봉 실시간 조립.
- `src/aggregation.ts`: 상위 타임프레임 집계 (증분 + 백필).
- `src/timeframes.ts`: 타임프레임 유틸.
- `prisma/schema.prisma`: `Candle1m`, `CandleAgg` 모델.

### 향후 개선 아이디어
- SQL 윈도우/그룹 쿼리를 활용한 대량 집계 성능 향상.
- 심볼별 구독 관리 (클라이언트 -> 특정 심볼만 수신).
- Redis Pub/Sub 또는 Kafka 로 확장.
- 중복 및 지연/결측 데이터 정정(repair) 파이프라인.
- 단위/통화 변환 및 지수(나스닥/S&P/Dow) 실시간 feed 확장.
- 인증(JWT) 및 속도 제한.
- 에러/지연 모니터링 (Prometheus metrics + Grafana dashboard).
