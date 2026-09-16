package kr.taos.lab.controller;

import kr.taos.lab.domain.Measurement;
import kr.taos.lab.domain.TelemetryPayload;
import kr.taos.lab.service.MeasurementService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/measurements")
public class MeasurementController {
    private final MeasurementService service;

    public MeasurementController(MeasurementService service) {
        this.service = service;
    }

    @GetMapping
    public List<Measurement> recent(@RequestParam(defaultValue = "50") int limit) {
        return service.recent(limit);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody TelemetryPayload payload) {
        try {
            boolean inserted = service.save(payload);
            return ResponseEntity.ok(Map.of("inserted", inserted));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
