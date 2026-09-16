package kr.taos.lab.domain;

import java.time.Instant;

public record Prediction(
        Long id,
        String deviceId,
        Instant observedAt,
        String modelVersion,
        Boolean isAnomaly,
        Double anomalyScore,
        String features,
        Instant createdAt
) {}
