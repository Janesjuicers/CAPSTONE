export const MAX_POINTS = 34;

const DEFAULT_POINTS = 22;
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
  amber: { key: 'amber', label: 'Amber', action: 'Observe only / verify persistence', color: '#f7b731', rank: 2 },
  red: { key: 'red', label: 'Red', action: 'Urgent inspection / critical anomaly', color: '#ff4d4f', rank: 3 }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stableNoise(tick, phase = 0, magnitude = 1) {
  return (Math.sin((tick + phase) * 1.19) * 0.42 + Math.sin((tick + phase) * 0.47) * 0.38 + Math.sin((tick + phase) * 2.11) * 0.2) * magnitude;
}

function smoothPulse(progress, risePoint = 0.34, fallPoint = 0.72) {
  const rise = clamp(progress / risePoint, 0, 1);
  const fall = clamp((1 - progress) / (1 - fallPoint), 0, 1);
  const shapedRise = rise * rise * (3 - 2 * rise);
  const shapedFall = fall * fall * (3 - 2 * fall);
  return Math.min(shapedRise, shapedFall);
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
    const vehiclePulse = smoothPulse(state.progress, 0.32, 0.7);
    const recoveryTail = state.progress > 0.7 ? Math.exp(-(state.scenarioTick - state.durationSec * 0.7) / 2.5) * 0.08 : 0;
    const transient = vehiclePulse + recoveryTail;
    return {
      loadEvent: 'normal load response - transient response with expected recovery',
      strainLeft: 117 + transient * 17 + stableNoise(globalTick, 2, 0.9),
      strainMidspan: 123 + transient * 35 + stableNoise(globalTick, 5, 1.0),
      strainRight: 116 + transient * 16 + stableNoise(globalTick, 9, 0.9),
      supportDisplacement: 0.65 + transient * 0.12 + stableNoise(globalTick, 4, 0.01),
      abutmentTilt: 0.112 + stableNoise(globalTick, 10, 0.0016)
    };
  }

  if (state.id === 'persistent_high') {
    const ramp = 1 - Math.exp(-state.scenarioTick / 3.8);
    const plateau = 0.94 + Math.sin(state.scenarioTick * 0.18) * 0.025;
    const hold = ramp * plateau;
    return {
      loadEvent: 'none - elevated strain reading persists',
      strainLeft: 150 + hold * 30 + stableNoise(globalTick, 1, 0.9),
      strainMidspan: 169 + hold * 43 + stableNoise(globalTick, 4, 1.0),
      strainRight: 147 + hold * 28 + stableNoise(globalTick, 7, 0.9),
      supportDisplacement: 0.8 + hold * 0.2 + stableNoise(globalTick, 12, 0.009),
      abutmentTilt: 0.13 + stableNoise(globalTick, 14, 0.0016)
    };
  }

  const drift = state.progress;
  const driftCurve = drift * drift * (3 - 2 * drift);
  return {
    loadEvent: 'none - wall tilt drift accumulating',
    strainLeft: 121 + stableNoise(globalTick, 2, 0.8),
    strainMidspan: 127 + Math.sin(state.scenarioTick * 0.18) * 1.2 + stableNoise(globalTick, 4, 0.8),
    strainRight: 121 + stableNoise(globalTick, 9, 0.8),
    supportDisplacement: 0.74 + driftCurve * 0.17 + stableNoise(globalTick, 6, 0.009),
    abutmentTilt: 0.165 + driftCurve * 0.285 + stableNoise(globalTick, 13, 0.0018)
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
    drivers.push({ label: 'Elevated strain duration', detail: `${point.highStrainDurationSec}s at or above watch threshold`, status: sensorStatuses[point.criticalSensorKey] });
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
        code: 'NORMAL_LOAD_RESPONSE',
        message: 'Normal load response: a short transient response is recovering as expected after the simulated vehicle crossing.',
        severity: 24
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

function selectCriticalStrainLocation(strainLeft, strainMidspan, strainRight) {
  const locations = [
    { key: 'strainLeft', value: strainLeft, label: 'Left support strain gauge' },
    { key: 'strainMidspan', value: strainMidspan, label: 'Midspan strain gauge' },
    { key: 'strainRight', value: strainRight, label: 'Right support strain gauge' }
  ];

  return locations.reduce((highest, current) => (current.value > highest.value ? current : highest), locations[0]);
}

function selectDominantIssue(point, sensorStatuses) {
  const candidates = [
    { key: 'strainLeft', label: 'Left support strain', score: sensorStatuses.strainLeft.rank * 100 + Math.max(0, point.strainLeft - 120) },
    { key: 'strainMidspan', label: 'Midspan strain', score: sensorStatuses.strainMidspan.rank * 100 + Math.max(0, point.strainMidspan - 120) },
    { key: 'strainRight', label: 'Right support strain', score: sensorStatuses.strainRight.rank * 100 + Math.max(0, point.strainRight - 120) },
    { key: 'supportDisplacement', label: 'Support displacement', score: sensorStatuses.supportDisplacement.rank * 100 + Math.max(0, point.supportDisplacement - 0.65) * 120 },
    { key: 'abutmentTilt', label: 'Wall tilt', score: sensorStatuses.abutmentTilt.rank * 100 + Math.max(0, point.abutmentTilt - 0.11) * 520 }
  ];

  if (point.scenarioId === 'tilt_drift') {
    candidates.find((candidate) => candidate.key === 'abutmentTilt').score += 90;
    candidates.find((candidate) => candidate.key === 'supportDisplacement').score += 20;
  }

  if (point.scenarioId === 'persistent_high') {
    candidates.find((candidate) => candidate.key === point.criticalSensorKey).score += 80;
  }

  if (point.scenarioId === 'baseline' || point.scenarioId === 'load_event') {
    candidates.find((candidate) => candidate.key === point.criticalSensorKey).score += 30;
  }

  return candidates.reduce((dominant, current) => (current.score > dominant.score ? current : dominant), candidates[0]);
}

function createBridgePoint(globalTick = 0, previousPoint) {
  const scenario = getScenarioState(globalTick);
  const previousInScenario = previousPoint?.scenarioId === scenario.id ? previousPoint : undefined;
  const metrics = scenarioMetrics(scenario, globalTick);
  const strainLeft = Number(metrics.strainLeft.toFixed(1));
  const strainMidspan = Number(metrics.strainMidspan.toFixed(1));
  const strainRight = Number(metrics.strainRight.toFixed(1));
  const critical = selectCriticalStrainLocation(strainLeft, strainMidspan, strainRight);
  const criticalStrain = Number(critical.value.toFixed(1));
  const supportDisplacement = Number(metrics.supportDisplacement.toFixed(3));
  const abutmentTilt = Number(clamp(metrics.abutmentTilt, 0.06, 0.48).toFixed(3));
  const tiltDriftRate = Number(Math.max(0, abutmentTilt - (previousInScenario?.abutmentTilt ?? abutmentTilt)).toFixed(3));

  const highStrain = criticalStrain >= 165;
  const supportHigh = supportDisplacement >= 0.9;
  const highStrainDurationSec = highStrain ? (previousInScenario?.highStrainDurationSec ?? 0) + 1 : 0;
  const supportPersistenceSec = supportHigh ? (previousInScenario?.supportPersistenceSec ?? 0) + 1 : 0;
  const highReadingDurationSec = highStrain || supportHigh || abutmentTilt >= 0.22 ? (previousInScenario?.highReadingDurationSec ?? 0) + 1 : 0;

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
    criticalSensorKey: critical.key,
    criticalLocation: critical.label,
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
  const dominantIssue = selectDominantIssue(pointWithSeverity, sensorStatuses);

  return {
    ...pointWithSeverity,
    sensorStatuses,
    statusDrivers,
    dominantSensorKey: dominantIssue.key,
    dominantIssueLabel: dominantIssue.label,
    overallStatus,
    maintenanceLevel: overallStatus.action,
    maintenanceColor: overallStatus.color
  };
}

export function createInitialHistory(points = DEFAULT_POINTS, startTick = DEFAULT_POINTS - 1) {
  let previousPoint;
  return Array.from({ length: points }, (_, i) => {
    const tick = Math.max(0, startTick - (points - 1 - i));
    const point = createBridgePoint(tick, previousPoint);
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
