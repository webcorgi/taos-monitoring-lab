package kr.taos.lab.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.taos.lab.domain.TelemetryPayload;
import org.eclipse.paho.client.mqttv3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PreDestroy;

@Service
public class MqttIngestService {
    private static final Logger log = LoggerFactory.getLogger(MqttIngestService.class);

    private final MeasurementService measurementService;
    private final ObjectMapper objectMapper;
    private final String mqttUrl;
    private final String topic;
    private MqttClient client;

    public MqttIngestService(
            MeasurementService measurementService,
            ObjectMapper objectMapper,
            @Value("${lab.mqtt.url}") String mqttUrl,
            @Value("${lab.mqtt.topic}") String topic
    ) {
        this.measurementService = measurementService;
        this.objectMapper = objectMapper;
        this.mqttUrl = mqttUrl;
        this.topic = topic;
    }

    @Scheduled(fixedDelay = 5000, initialDelay = 1000)
    public synchronized void ensureConnected() {
        try {
            if (client != null && client.isConnected()) return;

            client = new MqttClient(mqttUrl, "spring-backend-" + MqttClient.generateClientId());
            MqttConnectOptions options = new MqttConnectOptions();
            options.setAutomaticReconnect(true);
            options.setCleanSession(true);
            options.setConnectionTimeout(5);

            client.setCallback(new MqttCallback() {
                @Override
                public void connectionLost(Throwable cause) {
                    log.warn("MQTT connection lost: {}", cause == null ? "unknown" : cause.getMessage());
                }

                @Override
                public void messageArrived(String incomingTopic, MqttMessage message) {
                    handleMessage(message);
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {
                    // Subscriber는 사용할 일이 없다.
                }
            });

            client.connect(options);
            client.subscribe(topic, 1);
            log.info("MQTT connected. url={}, topic={}", mqttUrl, topic);
        } catch (Exception e) {
            log.warn("MQTT connect failed. retry in 5s: {}", e.getMessage());
        }
    }

    private void handleMessage(MqttMessage message) {
        try {
            TelemetryPayload payload = objectMapper.readValue(message.getPayload(), TelemetryPayload.class);
            boolean inserted = measurementService.save(payload);
            log.info("telemetry device={} time={} inserted={}", payload.deviceId(), payload.timestamp(), inserted);
        } catch (Exception e) {
            log.warn("bad telemetry ignored: {}", e.getMessage());
        }
    }

    @PreDestroy
    public void close() {
        try {
            if (client != null && client.isConnected()) client.disconnect();
        } catch (Exception ignored) {
        }
    }
}
