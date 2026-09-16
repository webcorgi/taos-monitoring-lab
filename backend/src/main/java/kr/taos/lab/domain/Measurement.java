package kr.taos.lab.domain;

import java.time.Instant;

public record Measurement(
        Long id,
        String deviceId,
        Instant observedAt,
        Double voltage,
        Double current,
        Double soc,
        Double temperature,
        String qualityStatus,
        Instant ingestedAt
) {}
