CREATE TABLE measurement (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    voltage DOUBLE PRECISION NOT NULL,
    current DOUBLE PRECISION NOT NULL,
    soc DOUBLE PRECISION NOT NULL,
    temperature DOUBLE PRECISION NOT NULL,
    quality_status VARCHAR(32) NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_measurement_device_time UNIQUE (device_id, observed_at)
);

CREATE INDEX idx_measurement_device_time
    ON measurement (device_id, observed_at DESC);

CREATE TABLE prediction (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    is_anomaly BOOLEAN NOT NULL,
    anomaly_score DOUBLE PRECISION NOT NULL,
    features JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prediction UNIQUE (device_id, observed_at, model_version)
);

CREATE INDEX idx_prediction_device_time
    ON prediction (device_id, observed_at DESC);
