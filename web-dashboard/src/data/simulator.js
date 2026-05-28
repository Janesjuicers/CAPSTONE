export const MAX_POINTS = 48;

const DEFAULT_POINTS = 24;
const SCENARIOS = [
  { id: 'baseline', label: 'Scenario 1: Normal Baseline', durationSec: 26 },
  { id: 'load_event', label: 'Scenario 2: Load Event (Normal Transient)', durationSec: 18 },
  { id: 'persistent_high', label: 'Scenario 3: Persistent High Reading', durationSec: 22 },
  { id: 'tilt_drift', label: 'Scenario 4: Tilt Drift', durationSec: 24 }
];

const LOOP_SECONDS = SCENARIOS.reduce((sum, scenario) => sum + scenario.durationSec, 0);

const TRAFFIC = {
  grey: { key: 'grey', label: 'Grey', action: 'Sensor fault / invalid reading', color: '#8d96a8', rank: 0 },
  green: { key: 'green', label: 'Green', action: 'Normal', color: '#2dcf85', rank: 1 },
  amber: { key: 'amber', label: 'Amber', action: 'Observe / schedule inspection', color: '#f7b731', rank: 2 },
  red: { key: 'red', label: 'Red', action: 'Urgent inspection / critical anomaly', color: '#ff4d4f', rank: 3 }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stableNoise(tick, phase = 0, magnitude = 1) {
  return (Math.sin((tick + phase) * 1.73) * 0.55 + Math.sin((tick + phase) * 0.41) * 0.45) * magnitude;
}

function getScenarioState(globalTick) {
  const loopTick = ((globalTick % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  let elapsed = 0;

  for (const scenario of SCENARIOS) {
    const end = elapsed + scenario.durationSec;
    if (loopTick < end) {
      const scenarioTick = loopTick - elapsed;
      const nextScenario = SCENARIOS[(SCENARIOS.findIndex((s) => s.id === scenario.id) + 1) % SCENARIOS.length];
      return {
        ...scenario,
        index: SCENARIOS.findIndex((s) => s.id === scenario.id),
        scenarioTick,
        remainingSec: end - loopTick - 1,
        nextScenarioLabel: nextScenario.label,
        nextScenarioInSec: end - loopTick,
        progress: scenario.durationSec <= 1 ? 1 : scenarioTick / (scenario.durationSec - 1)
      };
    }
    elapsed = end;
  }

  return { ...SCENARIOS[0], index: 0, scenarioTick: 0, remainingSec: SCENARIOS[0].durationSec, nextScenarioLabel: SCENARIOS[1].label, nextScenarioInSec: SCENARIOS[0].durationSec, progress: 0 };
}

function scenarioMetrics(state, globalTick) {
  const natural = stableNoise(globalTick, 1, 1);
  const localRipple = Math.sin(state.scenarioTick * 0.7) * 0.8;

  if (state.id === 'baseline') {
    return {
      loadEvent: 'none',
      strainLeft: 112 + natural * 1.2 + localRipple * 0.5,
      strainMidspan: 119 + stableNoise(globalTick, 6, 1.5),
      strainRight: 110 + stableNoise(globalTick, 11, 1.1) - localRipple * 0.35,
      supportDisplacement: 0.62 + stableNoise(globalTick, 3, 0.018),
      abutmentTilt: 0.11 + stableNoise(globalTick, 8, 0.002)
    };
  }

  if (state.id === 'load_event') {
    const approach = Math.sin(Math.PI * state.progress);
    const recoveryTail = state.progress > 0.58 ? Math.exp(-(state.scenarioTick - state.durationSec * 0.58) / 3.2) * 0.18 : 0;
    const vehiclePulse = Math.max(0, approach) + recoveryTail;
    return {
      loadEvent: 'vehicle crossing - expected recovery',
      strainLeft: 118 + vehiclePulse * 22 + stableNoise(globalTick, 2, 1.1),
      strainMidspan: 124 + vehiclePulse * 52 + stableNoise(globalTick, 5, 1.4),
      strainRight: 116 + vehiclePulse * 20 + stableNoise(globalTick, 9, 1),
      supportDisplacement: 0.66 + vehiclePulse * 0.2 + stableNoise(globalTick, 4, 0.012),
      abutmentTilt: 0.112 + stableNoise(globalTick, 10, 0.002)
    };
  }

  if (state.id === 'persistent_high') {
    const ramp = 1 - Math.exp(-state.scenarioTick / 4.2);
    const plateau = 0.92 + Math.sin(state.scenarioTick * 0.24) * 0.04;
    const hold = ramp * plateau;
    return {
      loadEvent: 'none - elevated reading persists',
      strainLeft: 153 + hold * 34 + stableNoise(globalTick, 1, 1.2),
      strainMidspan: 172 + hold * 44 + stableNoise(globalTick, 4, 1.4),
      strainRight: 149 + hold * 31 + stableNoise(globalTick, 7, 1.1),
      supportDisplacement: 0.82 + hold * 0.24 + stableNoise(globalTick, 12, 0.01),
      abutmentTilt: 0.13 + stableNoise(globalTick, 14, 0.002)
    };
  }

  const drift = state.progress;
  const driftCurve = drift * drift * (3 - 2 * drift);
  return {
    loadEvent: 'none - tilt drift accumulating',
    strainLeft: 124 + stableNoise(globalTick, 2, 1.3),
    strainMidspan: 132 + Math.sin(state.scenarioTick * 0.22) * 2.1 + stableNoise(globalTick, 4, 1.2),
    strainRight: 123 + stableNoise(globalTick, 9, 1.1),
    supportDisplacement: 0.78 + driftCurve * 0.22 + stableNoise(globalTick, 6, 0.012),
    abutmentTilt: 0.16 + driftCurve * 0.27 + stableNoise(globalTick, 13, 0.002)
  };
}

function formatStatus(statusKey) {
  return TRAFFIC[statusKey] ?? TRAFFIC.grey;
}

function statusFromReading(type, value, point) {
  if (!Number.isFinite(value)) return formatStatus('grey');

  if (type === 'strain') {
    if (value >= 205 || point.highStrainDurationSec >= 10) return formatStatus('red');
    if (value >= 165 || point.highStrainDurationSec >= 5) return formatStatus('amber');
    return formatStatus('green');
  }

  if (type === 'support') {
    if (value >= 1.12 || point.supportPersistenceSec >= 9) return formatStatus('red');
    if (value >= 0.9 || point.supportPersistenceSec >= 5) return formatStatus('amber');
    return formatStatus('green');
  }

  if (type === 'tilt') {
    if (value >= 0.34 || point.tiltDriftRate >= 0.025) return formatStatus('red');
    if (value >= 0.22 || point.tiltDriftRate >= 0.009) return formatStatus('amber');
    return formatStatus('green');
  }

  return formatStatus('grey');
}

function strongestStatus(statuses) {
  return statuses.reduce((strongest, current) => (current.rank > strongest.rank ? current : strongest), formatStatus('green'));
}

function buildSensorStatuses(point) {
  return {
    strainLeft: statusFromReading('strain', point.strainLeft, point),
    strainMidspan: statusFromReading('strain', point.strainMidspan, point),
    strainRight: statusFromReading('strain', point.strainRight, point),
    supportDisplacement: statusFromReading('support', point.supportDisplacement, point),
    abutmentTilt: statusFromReading('tilt', point.abutmentTilt, point)
  };
}

function buildStatusDrivers(point, sensorStatuses) {
  const drivers = [];

  if (point.highStrainDurationSec >= 5 || point.criticalStrain >= 165) {
    drivers.push({ label: 'Elevated strain duration', detail: `${point.highStrainDurationSec}s at or above watch threshold`, status: sensorStatuses.strainMidspan });
  }

  if (point.supportPersistenceSec >= 5 || point.supportDisplacement >= 0.9) {
    drivers.push({ label: 'Support displacement persistence', detail: `${point.supportPersistenceSec}s above bearing watch threshold`, status: sensorStatuses.supportDisplacement });
  }

  if (point.abutmentTilt >= 0.22 || point.tiltDriftRate >= 0.009) {
    drivers.push({ label: 'Tilt drift', detail: `${point.abutmentTilt.toFixed(3)}° tilt, ${point.tiltDriftRate.toFixed(3)}°/s drift`, status: sensorStatuses.abutmentTilt });
  }

  if (point.anomalySeverity >= 60) {
    drivers.push({ label: 'Anomaly severity', detail: `${point.anomalySeverity}/100 scenario severity score`, status: point.anomalySeverity >= 85 ? formatStatus('red') : formatStatus('amber') });
  }

  if (drivers.length === 0) {
    drivers.push({ label: 'No active rule driver', detail: 'Readings are within normal simulated monitoring ranges.', status: formatStatus('green') });
  }

  return drivers;
}

function detectAnomalies(point) {
  if (point.scenarioId === 'load_event') {
    return [
      {
        code: 'NORMAL_TRANSIENT',
        message: 'Vehicle crossing is producing a short strain/displacement rise that is recovering within the scenario window.',
        severity: 34
      }
    ];
  }

  if (point.scenarioId === 'persistent_high') {
    return [
      {
        code: 'CONTINUOUS_HIGH',
        message: 'Midspan strain remains elevated without a load event, so schedule inspection and verify sensor bonding/calibration.',
        severity: 76
      }
    ];
  }

  if (point.scenarioId === 'tilt_drift') {
    return [
      {
        code: 'TILT_DRIFT',
        message: 'Abutment / retaining wall tilt is the dominant abnormal signal and is drifting upward over time.',
        severity: 90
      }
    ];
  }

  return [];
}

function createBridgePoint(globalTick = 0, previousPoint) {
  const scenario = getScenarioState(globalTick);
  const metrics = scenarioMetrics(scenario, globalTick);
  const strainLeft = Number(metrics.strainLeft.toFixed(1));
  const strainMidspan = Number(metrics.strainMidspan.toFixed(1));
  const strainRight = Number(metrics.strainRight.toFixed(1));
  const criticalStrain = Number(Math.max(strainLeft, strainMidspan, strainRight).toFixed(1));
  const supportDisplacement = Number(metrics.supportDisplacement.toFixed(3));
  const abutmentTilt = Number(clamp(metrics.abutmentTilt, 0.06, 0.48).toFixed(3));
  const tiltDriftRate = Number(Math.max(0, abutmentTilt - (previousPoint?.abutmentTilt ?? abutmentTilt)).toFixed(3));

  const highStrain = criticalStrain >= 165;
  const supportHigh = supportDisplacement >= 0.9;
  const highStrainDurationSec = highStrain ? (previousPoint?.highStrainDurationSec ?? 0) + 1 : 0;
  const supportPersistenceSec = supportHigh ? (previousPoint?.supportPersistenceSec ?? 0) + 1 : 0;
  const highReadingDurationSec = highStrain || supportHigh || abutmentTilt >= 0.22 ? (previousPoint?.highReadingDurationSec ?? 0) + 1 : 0;

  const basePoint = {
    time: new Date(Date.now()).toLocaleTimeString([], { hour12: false }),
    globalTick,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    scenarioTick: scenario.scenarioTick,
    scenarioDurationSec: scenario.durationSec,
    scenarioRemainingSec: scenario.remainingSec,
    nextScenarioLabel: scenario.nextScenarioLabel,
    nextScenarioInSec: scenario.nextScenarioInSec,
    scenarioProgress: Number(scenario.progress.toFixed(2)),
    loadEvent: metrics.loadEvent,
    strainLeft,
    strainMidspan,
    strainRight,
    criticalStrain,
    criticalLocation: criticalStrain === strainMidspan ? 'Midspan strain gauge' : criticalStrain === strainLeft ? 'Left support strain gauge' : 'Right support strain gauge',
    supportDisplacement,
    abutmentTilt,
    tiltDriftRate,
    highStrainDurationSec,
    supportPersistenceSec,
    highReadingDurationSec
  };

  const anomalies = detectAnomalies(basePoint);
  const anomalySeverity = anomalies.length ? Math.max(...anomalies.map((a) => a.severity)) : 16;
  const pointWithSeverity = { ...basePoint, anomalies, anomalySeverity };
  const sensorStatuses = buildSensorStatuses(pointWithSeverity);
  const overallStatus = strongestStatus([...Object.values(sensorStatuses), anomalySeverity >= 85 ? formatStatus('red') : anomalySeverity >= 65 ? formatStatus('amber') : formatStatus('green')]);
  const statusDrivers = buildStatusDrivers(pointWithSeverity, sensorStatuses);

  return {
    ...pointWithSeverity,
    sensorStatuses,
    statusDrivers,
    overallStatus,
    maintenanceLevel: overallStatus.action,
    maintenanceColor: overallStatus.color
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
    return {
      ...formatStatus('grey'),
      level: 'Awaiting data',
      text: 'Awaiting simulation data.',
      currentAnomaly: 'No current telemetry point is available yet.'
    };
  }

  const topAnomaly = latestPoint.anomalies?.[0];
  const status = latestPoint.overallStatus ?? formatStatus('green');
  const currentAnomaly = topAnomaly?.message ?? 'No active anomaly pattern; simulated readings are within normal monitoring limits.';

  return {
    ...status,
    level: `${status.label} - ${status.action}`,
    text: currentAnomaly,
    currentAnomaly
  };
}
