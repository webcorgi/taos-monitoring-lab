import { useEffect, useMemo, useState } from 'react';

function Metric({ label, value, unit }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value ?? '-'} <small>{unit}</small></strong>
    </div>
  );
}

function LineChart({ rows }) {
  const values = rows.slice().reverse().map((r) => r.temperature);
  if (values.length < 2) return <div className="empty">데이터 수집 중...</div>;

  const width = 700;
  const height = 190;
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const range = Math.max(max - min, 1);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [m, p] = await Promise.all([
          fetch('/api/measurements?limit=40'),
          fetch('/api/predictions/latest'),
        ]);
        if (!m.ok) throw new Error(`measurement HTTP ${m.status}`);
        setRows(await m.json());
        setPrediction(p.status === 204 ? null : await p.json());
        setError('');
      } catch (e) {
        setError(e.message);
      }
    };

    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, []);

  const latest = rows[0];
  const aiText = prediction ? (prediction.isAnomaly ? 'ANOMALY' : 'NORMAL') : 'LEARNING';
  const aiClass = prediction?.isAnomaly ? 'danger' : 'normal';
  const latestTime = useMemo(() => latest ? new Date(latest.observedAt).toLocaleString('ko-KR') : '-', [latest]);

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">TAOS MONITORING LAB</p>
          <h1>ESS Telemetry Dashboard</h1>
          <p className="muted">Sensor → MQTT → Spring → PostgreSQL → AI → React</p>
        </div>
        <div className={`ai ${aiClass}`}>
          <span>AI</span>
          <strong>{aiText}</strong>
          <small>{prediction ? `score ${prediction.anomalyScore.toFixed(4)}` : '20개 수집 후 시작'}</small>
        </div>
      </header>

      {error && <div className="error">API 오류: {error}</div>}

      <section className="metrics">
        <Metric label="Voltage" value={latest?.voltage?.toFixed(1)} unit="V" />
        <Metric label="Current" value={latest?.current?.toFixed(1)} unit="A" />
        <Metric label="SOC" value={latest?.soc?.toFixed(1)} unit="%" />
        <Metric label="Temperature" value={latest?.temperature?.toFixed(1)} unit="℃" />
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Temperature</h2>
          <span>{latest?.deviceId ?? '수집 대기'} · {latestTime}</span>
        </div>
        <LineChart rows={rows} />
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Recent telemetry</h2>
          <span>최근 10건</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th>Device</th><th>V</th><th>A</th><th>SOC</th><th>Temp</th><th>Quality</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.observedAt).toLocaleTimeString('ko-KR')}</td>
                  <td>{r.deviceId}</td>
                  <td>{r.voltage.toFixed(1)}</td>
                  <td>{r.current.toFixed(1)}</td>
                  <td>{r.soc.toFixed(1)}</td>
                  <td>{r.temperature.toFixed(1)}</td>
                  <td><span className={`quality ${r.qualityStatus === 'GOOD' ? '' : 'bad'}`}>{r.qualityStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
