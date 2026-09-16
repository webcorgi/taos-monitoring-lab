import json
import os
import time

import numpy as np
import psycopg
from sklearn.ensemble import IsolationForest

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://taos:taos@localhost:5432/taos_lab")
POLL_SECONDS = int(os.getenv("POLL_SECONDS", "4"))
MODEL_VERSION = "LAB_IF_V1"
MIN_ROWS = 20


def rows_to_features(rows):
    """센서 원본 → AI가 보기 좋은 숫자 배열."""
    features = []
    previous = None
    for r in rows:
        voltage, current, soc, temperature = map(float, r[1:5])
        voltage_delta = 0.0 if previous is None else voltage - previous[0]
        temp_delta = 0.0 if previous is None else temperature - previous[1]
        features.append([voltage, current, soc, temperature, voltage_delta, temp_delta])
        previous = (voltage, temperature)
    return np.array(features, dtype=float)


def analyze_device(conn, device_id):
    rows = conn.execute(
        """
        SELECT observed_at, voltage, current, soc, temperature
        FROM measurement
        WHERE device_id = %s AND quality_status = 'GOOD'
        ORDER BY observed_at DESC
        LIMIT 60
        """,
        (device_id,),
    ).fetchall()

    if len(rows) < MIN_ROWS:
        return

    rows.reverse()  # 오래된 값 → 최신 값
    x = rows_to_features(rows)

    model = IsolationForest(
        n_estimators=100,
        contamination=0.08,
        random_state=42,
    )
    model.fit(x)

    latest = x[-1:]
    is_anomaly = bool(model.predict(latest)[0] == -1)
    # decision_function은 작을수록 이상. 보기 편하게 부호를 뒤집는다.
    anomaly_score = float(-model.decision_function(latest)[0])
    observed_at = rows[-1][0]

    feature_json = {
        "voltage": round(float(latest[0][0]), 3),
        "current": round(float(latest[0][1]), 3),
        "soc": round(float(latest[0][2]), 3),
        "temperature": round(float(latest[0][3]), 3),
        "voltage_delta": round(float(latest[0][4]), 3),
        "temperature_delta": round(float(latest[0][5]), 3),
        "sample_count": len(rows),
    }

    conn.execute(
        """
        INSERT INTO prediction
            (device_id, observed_at, model_version, is_anomaly, anomaly_score, features)
        VALUES (%s, %s, %s, %s, %s, %s::jsonb)
        ON CONFLICT (device_id, observed_at, model_version)
        DO UPDATE SET
            is_anomaly = EXCLUDED.is_anomaly,
            anomaly_score = EXCLUDED.anomaly_score,
            features = EXCLUDED.features,
            created_at = NOW()
        """,
        (device_id, observed_at, MODEL_VERSION, is_anomaly, anomaly_score, json.dumps(feature_json)),
    )
    conn.commit()
    print(f"AI device={device_id} anomaly={is_anomaly} score={anomaly_score:.4f} at={observed_at}")


def run_once():
    with psycopg.connect(DATABASE_URL) as conn:
        device_ids = [r[0] for r in conn.execute("SELECT DISTINCT device_id FROM measurement").fetchall()]
        for device_id in device_ids:
            analyze_device(conn, device_id)


def main():
    print("AI worker started")
    while True:
        try:
            run_once()
        except Exception as e:
            print(f"AI worker error: {type(e).__name__}: {e}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
