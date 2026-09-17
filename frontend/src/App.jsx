import React, { useEffect, useMemo, useState } from 'react';

const LAB_DEVICE_ID = 'ESS-LAB-02';

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

function ScenarioButton({ title, description, busy, onClick }) {
  return (
    <button className="scenario-button" type="button" disabled={busy} onClick={onClick}>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [labRows, setLabRows] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [labPrediction, setLabPrediction] = useState(null);
  const [error, setError] = useState('');
  const [scenarioBusy, setScenarioBusy] = useState('');
  const [scenarioMessage, setScenarioMessage] = useState('');
  const [scenarioError, setScenarioError] = useState('');

  const loadData = async () => {
    try {
      const [m, lm, p, lp] = await Promise.all([
        fetch('/api/measurements?limit=40'),
        fetch(`/api/measurements?limit=40&deviceId=${LAB_DEVICE_ID}`),
        fetch('/api/predictions/latest'),
        fetch(`/api/predictions/latest?deviceId=${LAB_DEVICE_ID}`),
      ]);
      if (!m.ok) throw new Error(`measurement HTTP ${m.status}`);
      if (!lm.ok) throw new Error(`lab measurement HTTP ${lm.status}`);

      setRows(await m.json());
      setLabRows(await lm.json());
      setPrediction(p.status === 204 ? null : await p.json());
      setLabPrediction(lp.status === 204 ? null : await lp.json());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 2000);
    return () => clearInterval(timer);
  }, []);

  const runScenario = async (scenario) => {
    setScenarioBusy(scenario);
    setScenarioMessage('');
    setScenarioError('');

    try {
      const response = await fetch(`/api/lab/scenarios/${scenario}`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setScenarioMessage(body.message);
      setTimeout(loadData, 600);
    } catch (e) {
      setScenarioError(e.message);
    } finally {
      setScenarioBusy('');
    }
  };

  const latest = rows[0];
  const labLatest = labRows[0];
  const aiText = prediction ? (prediction.isAnomaly ? 'ANOMALY' : 'NORMAL') : 'LEARNING';
  const aiClass = prediction?.isAnomaly ? 'danger' : 'normal';
  const labAiText = labPrediction ? (labPrediction.isAnomaly ? 'ANOMALY' : 'NORMAL') : 'LEARNING';
  const labAiClass = labPrediction?.isAnomaly ? 'danger' : 'normal';
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

      <section className="panel lab-panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">HANDS-ON LAB</p>
            <h2>실습 컨트롤 · {LAB_DEVICE_ID}</h2>
          </div>
          <span>명령어 대신 버튼으로 데이터 흐름 확인</span>
        </div>

        <div className="lab-flow">
          <span>버튼</span><b>→</b><span>Spring 테스트 API</span><b>→</b><span>MQTT</span><b>→</b><span>Spring 수신</span><b>→</b><span>DB</span><b>→</b><span>AI</span><b>→</b><span>화면</span>
        </div>

        <p className="lab-guide">
          먼저 <strong>① 기준 데이터 25개</strong>를 눌러 AI가 판단할 재료를 만든 뒤, 나머지 버튼을 하나씩 눌러 값·Quality·AI 결과가 어떻게 달라지는지 보세요.
        </p>

        <div className="scenario-grid">
          <ScenarioButton
            title="① 기준 데이터 25개"
            description="약 30℃의 평소 패턴을 한 번에 생성"
            busy={Boolean(scenarioBusy)}
            onClick={() => runScenario('baseline')}
          />
          <ScenarioButton
            title="② 정상값 31℃"
            description="평소와 비슷한 한 건을 MQTT로 전송"
            busy={Boolean(scenarioBusy)}
            onClick={() => runScenario('normal')}
          />
          <ScenarioButton
            title="③ 고온 85℃"
            description="범위 안이지만 평소와 크게 다른 값"
            busy={Boolean(scenarioBusy)}
            onClick={() => runScenario('hot')}
          />
          <ScenarioButton
            title="④ 전압 급락 690V"
            description="전압 변화량이 큰 상황 재현"
            busy={Boolean(scenarioBusy)}
            onClick={() => runScenario('voltage-drop')}
          />
          <ScenarioButton
            title="⑤ 센서 오류 130℃"
            description="OUT_OF_RANGE 처리와 AI 제외 확인"
            busy={Boolean(scenarioBusy)}
            onClick={() => runScenario('sensor-error')}
          />
        </div>

        {scenarioBusy && <div className="lab-status">MQTT로 테스트 데이터를 전송 중입니다...</div>}
        {scenarioMessage && <div className="lab-status success">{scenarioMessage}</div>}
        {scenarioError && <div className="lab-status failure">실습 전송 실패: {scenarioError}</div>}

        <div className="lab-observation">
          <div>
            <span>최근 실습값</span>
            <strong>{labLatest ? `${labLatest.temperature.toFixed(1)}℃ / ${labLatest.voltage.toFixed(1)}V` : '-'}</strong>
            <small>{labLatest ? new Date(labLatest.observedAt).toLocaleTimeString('ko-KR') : '아직 ESS-LAB-02 데이터 없음'}</small>
          </div>
          <div>
            <span>Quality</span>
            <strong className={labLatest?.qualityStatus === 'OUT_OF_RANGE' ? 'text-danger' : ''}>{labLatest?.qualityStatus ?? '-'}</strong>
            <small>물리 범위 검사</small>
          </div>
          <div className={`lab-ai ${labAiClass}`}>
            <span>ESS-LAB-02 AI</span>
            <strong>{labAiText}</strong>
            <small>{labPrediction ? `score ${labPrediction.anomalyScore.toFixed(4)}` : `${labRows.length}/20개 수집`}</small>
          </div>
        </div>

        <p className="lab-note">
          85℃는 현재 품질 규칙상 GOOD이지만 평소 패턴과 멀어 AI가 이상으로 판단할 수 있습니다. 반대로 130℃는 OUT_OF_RANGE라 AI 학습 대상에서 빠집니다. AI는 약 4초 주기로 분석하므로 결과가 바로 바뀌지 않을 수 있습니다.
        </p>
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
