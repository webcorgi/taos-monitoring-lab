import json
import math
import os
import random
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

HOST = os.getenv("MQTT_HOST", "localhost")
PORT = int(os.getenv("MQTT_PORT", "1883"))
TOPIC = os.getenv("MQTT_TOPIC", "taos/lab/telemetry")
DEVICE_ID = os.getenv("DEVICE_ID", "ESS-LAB-01")
ANOMALY_EVERY = int(os.getenv("ANOMALY_EVERY", "15"))

random.seed(42)


def connect_with_retry():
    while True:
        try:
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="taos-lab-simulator")
            client.connect(HOST, PORT, 30)
            client.loop_start()
            return client
        except Exception as e:
            print(f"MQTT connect failed: {e}; retry in 2s")
            time.sleep(2)


def main():
    client = connect_with_retry()
    i = 0
    while True:
        i += 1
        phase = i / 5
        voltage = 820 + math.sin(phase) * 4 + random.uniform(-1, 1)
        current = 22 + math.sin(phase / 2) * 5 + random.uniform(-1, 1)
        soc = max(20, 85 - i * 0.03)
        temperature = 28 + math.sin(phase / 3) * 1.5 + random.uniform(-0.3, 0.3)

        is_anomaly = ANOMALY_EVERY > 0 and i % ANOMALY_EVERY == 0
        if is_anomaly:
            voltage -= 130
            temperature += 42

        payload = {
            "deviceId": DEVICE_ID,
            "voltage": round(voltage, 3),
            "current": round(current, 3),
            "soc": round(soc, 3),
            "temperature": round(temperature, 3),
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }

        info = client.publish(TOPIC, json.dumps(payload), qos=1)
        info.wait_for_publish()
        print(f"PUB anomaly={is_anomaly} {payload}")
        time.sleep(2)


if __name__ == "__main__":
    main()
