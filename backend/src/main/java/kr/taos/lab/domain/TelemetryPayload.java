package kr.taos.lab.domain;

import java.time.Instant;

public record TelemetryPayload(
        String deviceId,
        Double voltage,
        Double current,
        Double soc,
        Double temperature,
        Instant timestamp
) {}
