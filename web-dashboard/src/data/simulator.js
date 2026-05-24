export const MAX_POINTS = 40;

const DEFAULT_POINTS = 20;
const SCENARIOS = [
  { id: 'baseline', label: 'Scenario 1: Normal Baseline', durationSec: 24 },
  { id: 'load_event', label: 'Scenario 2: Load Event (Normal Transient)', durationSec: 14 },
  { id: 'persistent_high', label: 'Scenario 3: Persistent High Reading', durationSec: 18 },
  { id: 'tilt_drift', label: 'Scenario 4: Tilt Drift', durationSec: 22 }
];

const LOOP_SECONDS = SCENARIOS.reduce((sum, scenario) => sum + scenario.durationSec, 0);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getScenarioState(globalTick) {
  const loopTick = ((globalTick % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  let elapsed = 0;

  for (const scenario of SCENARIOS) {
    const end = elapsed + scenario.durationSec;
    if (loopTick < end) {
      const scenarioTick = loopTick - elapsed;
      return {
        ...scenario,
        index: SCENARIOS.findIndex((s) => s.id === scenario.id),
        scenarioTick,
        progress: scenario.durationSec <= 1 ? 1 : scenarioTick / (scenario.durationSec - 1)
      };
    }
    elapsed = end;
  }

  return { ...SCENARIOS[0], index: 0, scenarioTick: 0, progress: 0 };
}

function scenarioMetrics(state) {
  const cyc = Math.sin(state.scenarioTick * 0.5);

  if (state.id === 'baseline') {
    return {
      loadEvent: 'none',
      criticalStrain: 118 + cyc * 1.8,
      supportDisplacement: 0.64 + Math.sin(state.scenarioTick * 0.32) * 0.02,
      abutmentTilt: 0.11 + Math.sin(state.scenarioTick * 0.22) * 0.002
    };
  }

  if (state.id === 'load_event') {
    const spike = Math.sin(Math.PI * state.progress);
    return {
      loadEvent: 'vehicle crossing',
      criticalStrain: 122 + spike * 44,
      supportDisplacement: 0.67 + spike * 0.19,
      abutmentTilt: 0.112 + Math.sin(state.scenarioTick * 0.26) * 0.002
    };
  }

  if (state.id === 'persistent_high') {
    const hold = 1 - Math.exp(-state.scenarioTick / 3.2);
    return {
      loadEvent: 'none',
      criticalStrain: 170 + hold * 32,
      supportDisplacement: 0.84 + hold * 0.1,
      abutmentTilt: 0.118 + Math.sin(state.scenarioTick * 0.16) * 0.002
    };
  }

  const drift = state.progress;
  return {
    loadEvent: 'none',
    criticalStrain: 130 + Math.sin(state.scenarioTick * 0.24) * 3,
    supportDisplacement: 0.88 + drift * 0.26,
    abutmentTilt: 0.15 + drift * 0.24
  };
}

function maintenanceStatus(level) {
  if (level === 'urgent') return { level: 'Urgent Inspection', color: '#ff4d4f' };
  if (level === 'scheduled') return { level: 'Schedule Inspection', color: '#ff7b59' };
  if (level === 'observe') return { level: 'Observe Trend', color: '#f7b731' };
  return { level: 'Routine Monitoring', color: '#2dcf85' };
}

function detectAnomalies(point) {
  if (point.scenarioId === 'persistent_high') {
    return [
      {
        code: 'CONTINUOUS_HIGH',
        message: 'Persistent high strain exceeds expected transient response. Check sensor integrity and structural condition.',
        severity: 78
      }
    ];
  }

  if (point.scenarioId === 'tilt_drift') {
    return [
      {
        code: 'TILT_DRIFT',
        message: 'Tilt drift trend indicates possible abutment or retained-soil movement; prioritize geotechnical review.',
        severity: 88
      }
    ];
  }

  return [];
}

function createBridgePoint(globalTick = 0, previousPoint) {
  const scenario = getScenarioState(globalTick);
  const metrics = scenarioMetrics(scenario);
  const criticalStrain = Number(metrics.criticalStrain.toFixed(1));
  const supportDisplacement = Number(metrics.supportDisplacement.toFixed(3));
  const abutmentTilt = Number(clamp(metrics.abutmentTilt, 0.06, 0.46).toFixed(3));
  const tiltDriftRate = Number(Math.max(0, abutmentTilt - (previousPoint?.abutmentTilt ?? abutmentTilt)).toFixed(3));

  const high = criticalStrain >= 185 || supportDisplacement >= 1.0 || abutmentTilt >= 0.28;
  const highReadingDurationSec = high ? (previousPoint?.highReadingDurationSec ?? 0) + 1 : 0;

  const point = {
    time: new Date(Date.now()).toLocaleTimeString([], { hour12: false }),
    globalTick,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    scenarioTick: scenario.scenarioTick,
    scenarioProgress: Number(scenario.progress.toFixed(2)),
    loadEvent: metrics.loadEvent,
    criticalStrain,
    supportDisplacement,
    abutmentTilt,
    tiltDriftRate,
    highReadingDurationSec
  };

  const anomalies = detectAnomalies(point);
  const severity = anomalies.length ? Math.max(...anomalies.map((a) => a.severity)) : 18;
  const maintenanceBand = point.scenarioId === 'baseline' ? 'routine' : point.scenarioId === 'load_event' ? 'observe' : point.scenarioId === 'persistent_high' ? 'scheduled' : 'urgent';
  const maintenance = maintenanceStatus(maintenanceBand);

  return {
    ...point,
    anomalySeverity: severity,
    anomalies,
    maintenanceLevel: maintenance.level,
    maintenanceColor: maintenance.color
  };
}

export function createInitialHistory(points = DEFAULT_POINTS, startTick = 0) {
  let previousPoint;
  return Array.from({ length: points }, (_, i) => {
    const tick = startTick - (points - 1 - i);
    const point = createBridgePoint(Math.max(0, tick), previousPoint);
    previousPoint = point;
    return point;
  });
}

export function nextDataPoint(previous) {
  return createBridgePoint((previous?.globalTick ?? 0) + 1, previous);
}

export function scenarioCatalog() {
  return SCENARIOS;
}

export function jumpToScenario(previous, scenarioIndex) {
  const bounded = clamp(scenarioIndex, 0, SCENARIOS.length - 1);
  const startTick = SCENARIOS.slice(0, bounded).reduce((sum, s) => sum + s.durationSec, 0);
  return createBridgePoint(startTick, previous);
}

export function evaluateStatus(latestPoint) {
  if (!latestPoint) {
    return { level: 'Normal Trend', color: '#2dcf85', text: 'Awaiting simulation data.' };
  }

  if (latestPoint.scenarioId === 'load_event') {
    return {
      level: 'Normal Load Response',
      color: '#2dcf85',
      text: 'Short-duration strain and displacement increase matches expected live-load transient behavior.'
    };
  }

  const anomalies = latestPoint.anomalies ?? [];
  if (anomalies.length === 0) {
    return { level: 'Normal Trend', color: '#2dcf85', text: 'Baseline readings are stable with no active anomaly pattern.' };
  }

  const top = anomalies[0];
  return {
    level: top.severity >= 85 ? 'Critical' : 'High',
    color: top.severity >= 85 ? '#ff4d4f' : '#ff7b59',
    text: top.message
  };
}
