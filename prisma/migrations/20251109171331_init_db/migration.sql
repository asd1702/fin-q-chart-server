-- CreateTable
CREATE TABLE "Candle1m" (
    "time" TIMESTAMPTZ NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Candle1m_pkey" PRIMARY KEY ("time","symbol")
);
