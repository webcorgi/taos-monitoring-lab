import React, { useEffect, useMemo, useState } from 'react';

const LAB_DEVICE_ID = 'ESS-LAB-02';

const SCENARIOS = {
  baseline: {
    step: '①',
    title: '기준 데이터 25개',
    shortTitle: '기준 패턴 만들기',
    description: '약 30℃ / 815V의 평소 패턴을 한 번에 생성',
    expectation: 'AI가 판단할 기준 데이터를 확보합니다.',
  },
  normal: {
    step: '②',
    title: '정상값 31℃',
    shortTitle: '정상 데이터',
    description: '평소와 비슷한 한 건을 MQTT로 전송',
    expectation: 'Quality는 GOOD, AI도 보통 NORMAL 쪽입니다.',
  },
  hot: {
    step: '③',
    title: '고온 85℃',
    shortTitle: '고온 이상',
    description: '허용 범위 안이지만 평소와 크게 다른 값',
    expectation: 'Quality는 GOOD이어도 AI는 ANOMALY로 볼 수 있습니다.',
  },
  'voltage-drop': {
    step: '④',
    title: '전압 급락 690V',
    shortTitle: '전압 급락',
    description: '평소 810V대에서 갑자기 690V로 하락',
    expectation: 'Quality는 GOOD이어도 큰 변화량을 AI가 볼 수 있습니다.',
  },
  'sensor-error': {
    step: '⑤',
    title: '센서 오류 130℃',
    shortTitle: '범위 오류',
    description: '물리 허용 범위를 벗어난 값을 전송',
    expectation: 'OUT_OF_RANGE로 저장되고 AI 분석 대상에서는 제외됩니다.',
  },
};

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

function ScenarioButton({ scenarioKey, meta, active, busy, onClick }) {
  return (
    <button
      className={`scenario-button ${active ? 'active' : ''}`}
      type="button"
      disabled={busy}
      onClick={() => onClick(scenarioKey)}
    >
      <strong>{meta.step} {meta.title}</strong>
      <span>{meta.description}</span>
    </button>
  );
}

function Stage({ label, detail, status = 'pending' }) {
  const symbol = status === 'done' ? '✓' : status === 'working' ? '…' : status === 'skipped' ? '−' : '·';
  return (
    <div className={`flow-stage ${status}`}>
      <i>{symbol}</i>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function parseFeatures(prediction) {
  if (!prediction?.features) return null;
  try {
    return typeof prediction.features === 'string'
      ? JSON.parse(prediction.features)
      : prediction.features;
  } catch {
    return null;
  }
}

function signed(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '-';
  const n = Number(value);
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;
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
  const [activeScenario, setActiveScenario] = useState('');
  const [scenarioStartedAt, setScenarioStartedAt] = useState(0);

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
    const timer = setInterval(loadData, 1500);
    return () => clearInterval(timer);
  }, []);

  const runScenario = async (scenario) => {
    setActiveScenario(scenario);
    setScenarioStartedAt(Date.now());
    setScenarioBusy(scenario);
    setScenarioMessage('');
    setScenarioError('');

    try {
      const response = await fetch(`/api/lab/scenarios/${scenario}`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setScenarioMessage(body.message);
      setTimeout(loadData, 300);
      setTimeout(loadData, 1200);
      setTimeout(loadData, 4500);
    } catch (e) {
      setScenarioError(e.message);
    } finally {
      setScenarioBusy('');
    }
  };

  const latest = rows[0];
  const labLatest = labRows[0];
  const labPrevious = labRows[1];
  const aiText = prediction ? (prediction.isAnomaly ? 'ANOMALY' : 'NORMAL') : 'LEARNING';
  const aiClass = prediction?.isAnomaly ? 'danger' : 'normal';
  const latestTime = useMemo(() => latest ? new Date(latest.observedAt).toLocaleString('ko-KR') : '-', [latest]);

  const activeMeta = activeScenario ? SCENARIOS[activeScenario] : null;
  const labFeatures = parseFeatures(labPrediction);
  const latestObservedMs = labLatest ? new Date(labLatest.observedAt).getTime() : 0;
  const predictionObservedMs = labPrediction ? new Date(labPrediction.observedAt).getTime() : 0;
  const dbArrived = Boolean(activeScenario && labLatest && latestObservedMs >= scenarioStartedAt - 3000);
  const mqttPublished = Boolean(activeScenario && scenarioMessage);
  const sensorExcluded = activeScenario === 'sensor-error' && dbArrived && labLatest?.qualityStatus === 'OUT_OF_RANGE';
  const aiCaughtUp = Boolean(
    dbArrived
    && !sensorExcluded
    && labPrediction
    && Math.abs(predictionObservedMs - latestObservedMs) < 1500
  );
  const rawTempDelta = labLatest && labPrevious ? labLatest.temperature - labPrevious.temperature : null;
  const rawVoltageDelta = labLatest && labPrevious ? labLatest.voltage - labPrevious.voltage : null;

  let resultTone = 'waiting';
  let resultTitle = '실습 버튼을 눌러보세요';
  let resultDescription = '버튼을 누르면 데이터가 MQTT부터 DB와 AI까지 실제 경로를 따라갑니다.';

  if (activeMeta) {
    if (scenarioError) {
      resultTone = 'danger';
      resultTitle = `${activeMeta.shortTitle} 전송 실패`;
      resultDescription = scenarioError;
    } else if (!dbArrived) {
      resultTone = 'working';
      resultTitle = `${activeMeta.shortTitle} · 전달 중`;
      resultDescription = scenarioMessage || 'Spring 테스트 API에서 MQTT로 데이터를 발행하고 있습니다.';
    } else if (sensorExcluded) {
      resultTone = 'warning';
      resultTitle = '130℃ → OUT_OF_RANGE → AI 제외';
      resultDescription = 'DB에는 저장됐지만 물리 범위를 벗어나 AI가 이 행을 학습하거나 판단하지 않습니다.';
    } else if (!aiCaughtUp) {
      resultTone = 'working';
      resultTitle = `${labLatest.temperature.toFixed(1)}℃ 저장 완료 · AI 분석 대기`;
      resultDescription = `Quality ${labLatest.qualityStatus}. AI Worker가 다음 분석 주기에서 이 데이터를 확인합니다.`;
    } else if (labPrediction.isAnomaly) {
      resultTone = 'danger';
      resultTitle = `${labLatest.temperature.toFixed(1)}℃ → AI ANOMALY`;
      resultDescription = `Quality는 ${labLatest.qualityStatus}이지만 평소 패턴과 달라 AI가 이상으로 분류했습니다.`;
    } else {
      resultTone = 'success';
      resultTitle = `${labLatest.temperature.toFixed(1)}℃ → AI NORMAL`;
      resultDescription = `Quality ${labLatest.qualityStatus}, AI도 현재 데이터를 정상 패턴으로 분류했습니다.`;
    }
  }

  const qualityMeaning = !labLatest
    ? '데이터 없음'
    : labLatest.qualityStatus === 'OUT_OF_RANGE'
      ? '물리 범위를 벗어난 값'
      : '정해둔 물리 범위 안의 값';

  const aiMeaning = sensorExcluded
    ? '품질 오류라 이번 행은 AI에서 제외'
    : !labPrediction
      ? '20개 이상 모이면 AI 판단 시작'
      : aiCaughtUp
        ? (labPrediction.isAnomaly ? '평소 패턴과 다름' : '평소 패턴과 비슷함')
        : '최신 데이터 분석 대기 중';

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">TAOS MONITORING LAB</p>
          <h1>ESS Telemetry Dashboard</h1>
          <p className="muted">Sensor → MQTT → Spring → PostgreSQL → AI → React</p>
        </div>
        <div className={`ai ${aiClass}`}>
          <span>전체 최신 AI</span>
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
          <span>버튼을 누른 뒤 아래 결과판만 보면 됩니다</span>
        </div>

        <div className="scenario-grid">
          {Object.entries(SCENARIOS).map(([key, meta]) => (
            <ScenarioButton
              key={key}
              scenarioKey={key}
              meta={meta}
              active={activeScenario === key}
              busy={Boolean(scenarioBusy)}
              onClick={runScenario}
            />
          ))}
        </div>

        {activeMeta && (
          <div className="expectation">
            <b>{activeMeta.step} 예상:</b> {activeMeta.expectation}
          </div>
        )}

        <div className={`result-banner ${resultTone}`}>
          <div className="result-icon">
            {resultTone === 'success' ? '✓' : resultTone === 'danger' ? '!' : resultTone === 'warning' ? '!' : resultTone === 'working' ? '…' : '▶'}
          </div>
          <div>
            <span>지금 일어난 일</span>
            <strong>{resultTitle}</strong>
            <p>{resultDescription}</p>
          </div>
        </div>

        <div className="pipeline-title">
          <strong>실제 데이터 흐름</strong>
          <span>완료된 단계가 순서대로 켜집니다.</span>
        </div>
        <div className="pipeline-grid">
          <Stage label="버튼" detail="시나리오 실행" status={activeScenario ? 'done' : 'pending'} />
          <Stage label="MQTT" detail="Broker에 publish" status={mqttPublished ? 'done' : activeScenario ? 'working' : 'pending'} />
          <Stage label="Spring" detail="subscribe + JSON 처리" status={dbArrived ? 'done' : mqttPublished ? 'working' : 'pending'} />
          <Stage label="PostgreSQL" detail="measurement 저장" status={dbArrived ? 'done' : 'pending'} />
          <Stage
            label="AI Worker"
            detail={sensorExcluded ? '품질 오류라 제외' : aiCaughtUp ? '최신값 분석 완료' : '분석 주기 대기'}
            status={sensorExcluded ? 'skipped' : aiCaughtUp ? 'done' : dbArrived ? 'working' : 'pending'}
          />
          <Stage label="React" detail="화면 재조회/반영" status={dbArrived ? 'done' : 'pending'} />
        </div>

        <div className="compare-grid">
          <div className="compare-card raw">
            <span className="compare-label">① 들어온 원본값</span>
            <strong>{labLatest ? `${labLatest.temperature.toFixed(1)}℃` : '-'}</strong>
            <p>{labLatest ? `${labLatest.voltage.toFixed(1)}V · ${labLatest.current.toFixed(1)}A · SOC ${labLatest.soc.toFixed(1)}%` : '아직 데이터 없음'}</p>
            <div className="delta-row">
              <span>직전 대비 온도 <b>{signed(rawTempDelta)}℃</b></span>
              <span>직전 대비 전압 <b>{signed(rawVoltageDelta)}V</b></span>
            </div>
          </div>

          <div className={`compare-card quality-card ${labLatest?.qualityStatus === 'OUT_OF_RANGE' ? 'bad' : 'good'}`}>
            <span className="compare-label">② 규칙 검사 · Quality</span>
            <strong>{labLatest?.qualityStatus ?? '-'}</strong>
            <p>{qualityMeaning}</p>
            <small>현재 규칙: 온도 -40~120℃, 전압 0~1200V, SOC 0~100%</small>
          </div>

          <div className={`compare-card ai-card ${sensorExcluded ? 'skipped' : aiCaughtUp && labPrediction?.isAnomaly ? 'bad' : aiCaughtUp ? 'good' : ''}`}>
            <span className="compare-label">③ 패턴 검사 · AI</span>
            <strong>{sensorExcluded ? 'EXCLUDED' : !labPrediction ? 'LEARNING' : aiCaughtUp ? (labPrediction.isAnomaly ? 'ANOMALY' : 'NORMAL') : 'ANALYZING'}</strong>
            <p>{aiMeaning}</p>
            <small>
              {sensorExcluded
                ? 'OUT_OF_RANGE 행은 AI 입력에서 제외'
                : labPrediction && aiCaughtUp
                  ? `score ${labPrediction.anomalyScore.toFixed(4)} · sample ${labFeatures?.sample_count ?? '-'}개`
                  : 'AI는 약 4초 주기로 DB를 확인'}
            </small>
          </div>
        </div>

        {aiCaughtUp && labFeatures && (
          <div className="ai-feature-strip">
            <span>AI가 실제로 본 변화량</span>
            <b>temperature_delta {signed(labFeatures.temperature_delta)}℃</b>
            <b>voltage_delta {signed(labFeatures.voltage_delta)}V</b>
            <small>값 자체뿐 아니라 직전 값과 얼마나 달라졌는지도 Feature로 사용합니다.</small>
          </div>
        )}

        {scenarioError && <div className="lab-status failure">실습 전송 실패: {scenarioError}</div>}

        <div className="lab-table-title">
          <strong>{LAB_DEVICE_ID} 최근 실습 데이터</strong>
          <span>다른 장비 데이터에 묻히지 않도록 이 장비만 표시</span>
        </div>
        <div className="table-wrap lab-table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th>V</th><th>Temp</th><th>ΔTemp</th><th>Quality</th></tr>
            </thead>
            <tbody>
              {labRows.slice(0, 6).map((r, index) => {
                const older = labRows[index + 1];
                const delta = older ? r.temperature - older.temperature : null;
                return (
                  <tr key={r.id} className={index === 0 ? 'latest-lab-row' : ''}>
                    <td>{new Date(r.observedAt).toLocaleTimeString('ko-KR')}</td>
                    <td>{r.voltage.toFixed(1)}</td>
                    <td><b>{r.temperature.toFixed(1)}℃</b></td>
                    <td className={Math.abs(delta ?? 0) >= 10 ? 'text-danger' : ''}>{signed(delta)}℃</td>
                    <td><span className={`quality ${r.qualityStatus === 'GOOD' ? '' : 'bad'}`}>{r.qualityStatus}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="lab-note">
          핵심: <b>Quality</b>는 사람이 정한 물리 범위 검사이고, <b>AI</b>는 평소 데이터 패턴과 다른지를 보는 검사입니다. 그래서 85℃나 690V가 Quality는 GOOD인데 AI는 ANOMALY일 수 있습니다.
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
          <span>전체 장비 최근 10건</span>
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
