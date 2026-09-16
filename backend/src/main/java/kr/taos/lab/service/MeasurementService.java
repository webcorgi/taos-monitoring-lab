package kr.taos.lab.service;

import kr.taos.lab.domain.Measurement;
import kr.taos.lab.domain.TelemetryPayload;
import kr.taos.lab.mapper.MeasurementMapper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class MeasurementService {
    private final MeasurementMapper mapper;

    public MeasurementService(MeasurementMapper mapper) {
        this.mapper = mapper;
    }

    public boolean save(TelemetryPayload payload) {
        validateRequired(payload);
        String quality = qualityOf(payload);
        int inserted = mapper.insert(
                payload.deviceId(),
                payload.timestamp(),
                payload.voltage(),
                payload.current(),
                payload.soc(),
                payload.temperature(),
                quality
        );
        return inserted == 1;
    }

    public List<Measurement> recent(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return mapper.findRecent(safeLimit);
    }

    private void validateRequired(TelemetryPayload p) {
        if (p == null || p.deviceId() == null || p.deviceId().isBlank()) {
            throw new IllegalArgumentException("deviceId is required");
        }
        if (p.timestamp() == null) {
            throw new IllegalArgumentException("timestamp is required");
        }
        if (p.voltage() == null || p.current() == null || p.soc() == null || p.temperature() == null) {
            throw new IllegalArgumentException("measurement values are required");
        }
        if (p.timestamp().isAfter(Instant.now().plusSeconds(60))) {
            throw new IllegalArgumentException("timestamp is too far in the future");
        }
    }

    private String qualityOf(TelemetryPayload p) {
        boolean out = p.voltage() < 0 || p.voltage() > 1200
                || p.soc() < 0 || p.soc() > 100
                || p.temperature() < -40 || p.temperature() > 120;
        return out ? "OUT_OF_RANGE" : "GOOD";
    }
}
