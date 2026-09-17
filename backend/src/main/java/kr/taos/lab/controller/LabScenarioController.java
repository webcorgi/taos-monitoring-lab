package kr.taos.lab.controller;

import kr.taos.lab.domain.TelemetryPayload;
import kr.taos.lab.service.MqttIngestService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/lab/scenarios")
public class LabScenarioController {
    private static final String DEVICE_ID = "ESS-LAB-02";

    private final MqttIngestService mqttIngestService;

    public LabScenarioController(MqttIngestService mqttIngestService) {
        this.mqttIngestService = mqttIngestService;
    }

    @PostMapping("/{scenario}")
    public ResponseEntity<?> run(@PathVariable String scenario) {
        try {
            List<TelemetryPayload> payloads = payloadsFor(scenario);
            payloads.forEach(mqttIngestService::publishTelemetry);

            return ResponseEntity.ok(Map.of(
                    "deviceId", DEVICE_ID,
                    "scenario", scenario,
                    "published", payloads.size(),
                    "message", messageFor(scenario)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    private List<TelemetryPayload> payloadsFor(String scenario) {
        Instant now = Instant.now();

        return switch (scenario) {
            case "baseline" -> baseline(now);
            case "normal" -> List.of(payload(815.0, 18.0, 72.0, 31.0, now));
            case "hot" -> List.of(payload(815.0, 18.0, 72.0, 85.0, now));
            case "voltage-drop" -> List.of(payload(690.0, 18.0, 72.0, 31.0, now));
            case "sensor-error" -> List.of(payload(815.0, 18.0, 72.0, 130.0, now));
            default -> throw new IllegalArgumentException("알 수 없는 실습 시나리오입니다: " + scenario);
        };
    }

    private List<TelemetryPayload> baseline(Instant now) {
        List<TelemetryPayload> payloads = new ArrayList<>();
        for (int i = 0; i < 25; i++) {
            double voltage = 812.0 + (i % 5) * 1.5;
            double current = 17.5 + (i % 4) * 0.4;
            double soc = 71.5 + (i % 6) * 0.2;
            double temperature = 29.5 + (i % 5) * 0.35;
            payloads.add(payload(
                    voltage,
                    current,
                    soc,
                    temperature,
                    now.minusSeconds(25L - i)
            ));
        }
        return payloads;
    }

    private TelemetryPayload payload(
            double voltage,
            double current,
            double soc,
            double temperature,
            Instant timestamp
    ) {
        return new TelemetryPayload(DEVICE_ID, voltage, current, soc, temperature, timestamp);
    }

    private String messageFor(String scenario) {
        return switch (scenario) {
            case "baseline" -> "ESS-LAB-02 기준 데이터 25개를 MQTT로 전송했습니다. AI는 다음 분석 주기부터 이 장비를 판단할 수 있습니다.";
            case "normal" -> "정상값 31℃를 MQTT로 전송했습니다.";
            case "hot" -> "고온값 85℃를 MQTT로 전송했습니다. Quality와 AI 판단이 어떻게 다른지 확인하세요.";
            case "voltage-drop" -> "전압 급락값 690V를 MQTT로 전송했습니다.";
            case "sensor-error" -> "센서 오류 예시 130℃를 MQTT로 전송했습니다. DB에는 저장되지만 OUT_OF_RANGE로 분류되어 AI 학습에서는 제외됩니다.";
            default -> "실습 데이터를 전송했습니다.";
        };
    }
}
