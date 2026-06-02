export const MAX_POINTS = 40;

const DEFAULT_POINTS = 22;
const SCENARIOS = [
  {
    id: 'baseline',
    label: 'Scenario 1: Normal Baseline',
    durationSec: 34,
    assumption: 'No significant live load; normal operating baseline.'
  },
  {
    id: 'load_event',
    label: 'Scenario 2: Two-Truck Service Load',
    durationSec: 34,
    assumption: 'Two representative heavy trucks crossing in sequence.'
  },
  {
    id: 'persistent_high',
    label: 'Scenario 3: Sustained High Strain',
    durationSec: 36,
    assumption: 'Sustained abnormal strain response.'
  },
  {
    id: 'tilt_drift',
    label: 'Scenario 4: Abutment / Wall Movement',
    durationSec: 36,
    assumption: 'Gradual abutment / soil / retaining wall movement.'
  }
];

export const THRESHOLD_GUIDE = [
  {
    metric: 'Critical strain',
    unit: 'με',
    green: '< 165',
    amber: '165–204 or ≥5s',
    red: '≥205 or ≥10s'
  },
  {
    metric: 'Support displacement above bearing',
    unit: 'mm',
    green: '< 0.900',
    amber: '0.900–1.119 or ≥5s',
    red: '≥1.120 or ≥9s'
  },
  {
    metric: 'Abutment / wall tilt',
    unit: '°',
    green: '< 0.220',
    amber: '0.220–0.339 or drift ≥0.009°/s',
    red: '≥0.340 or drift ≥0.025°/s'
  }
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

function bellPulse(progress, center, width) {
  return Math.exp(-Math.pow((progress - center) / width, 2));
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
  const localRipple = Math.sin(state.scenarioTick * 0.42) * 0.35;

  if (state.id === 'baseline') {
    return {
      loadEvent: 'none - stable operating baseline',
      strainLeft: 112 + natural * 0.22 + localRipple * 0.08,
      strainMidspan: 119 + stableNoise(globalTick, 6, 0.28),
      strainRight: 110 + stableNoise(globalTick, 11, 0.22) - localRipple * 0.06,
      supportDisplacement: 0.62 + stableNoise(globalTick, 3, 0.0035),
      abutmentTilt: 0.11 + stableNoise(globalTick, 8, 0.00045)
    };
  }

  if (state.id === 'load_event') {
    const firstLeft = bellPulse(state.progress, 0.24, 0.075);
    const firstMidspan = bellPulse(state.progress, 0.32, 0.085);
    const firstRight = bellPulse(state.progress, 0.41, 0.075);
    const secondLeft = bellPulse(state.progress, 0.54, 0.075);
    const secondMidspan = bellPulse(state.progress, 0.63, 0.085);
    const secondRight = bellPulse(state.progress, 0.72, 0.075);
    const leftInfluence = firstLeft * 0.92 + secondLeft;
    const midspanInfluence = firstMidspan * 0.94 + secondMidspan;
    const rightInfluence = firstRight * 0.9 + secondRight;
    const supportInfluence = firstRight * 0.55 + secondRight * 0.68 + firstMidspan * 0.18 + secondMidspan * 0.2;
    const recovery = state.progress > 0.79 ? Math.exp(-(state.progress - 0.79) * 14) * 0.018 : 0;
    return {
      loadEvent: 'normal two-truck crossing - left support responds first, midspan peaks highest, right support responds last, then recovers',
      strainLeft: 116 + leftInfluence * 18 + stableNoise(globalTick, 2, 0.28),
      strainMidspan: 122 + midspanInfluence * 34 + stableNoise(globalTick, 5, 0.32),
      strainRight: 115 + rightInfluence * 19 + stableNoise(globalTick, 9, 0.28),
      supportDisplacement: 0.65 + supportInfluence * 0.09 + recovery + stableNoise(globalTick, 4, 0.004),
      abutmentTilt: 0.112 + stableNoise(globalTick, 10, 0.00055)
    };
  }

  if (state.id === 'persistent_high') {
    const ramp = 1 - Math.exp(-state.scenarioTick / 5.5);
    const plateau = 0.96 + Math.sin(state.scenarioTick * 0.15) * 0.018;
    const hold = ramp * plateau;
    return {
      loadEvent: 'none - sustained abnormal strain response',
      strainLeft: 139 + hold * 26 + stableNoise(globalTick, 1, 0.55),
      strainMidspan: 166 + hold * 48 + stableNoise(globalTick, 4, 0.7),
      strainRight: 136 + hold * 22 + stableNoise(globalTick, 7, 0.55),
      supportDisplacement: 0.78 + hold * 0.16 + stableNoise(globalTick, 12, 0.006),
      abutmentTilt: 0.132 + stableNoise(globalTick, 14, 0.0008)
    };
  }

  const drift = state.progress;
  const driftCurve = drift * drift * (3 - 2 * drift);
  return {
    loadEvent: 'none - abutment / soil / retaining wall movement accumulating',
    strainLeft: 119 + driftCurve * 6 + stableNoise(globalTick, 2, 0.45),
    strainMidspan: 124 + driftCurve * 8 + Math.sin(state.scenarioTick * 0.16) * 0.7 + stableNoise(globalTick, 4, 0.45),
    strainRight: 120 + driftCurve * 5 + stableNoise(globalTick, 9, 0.45),
    supportDisplacement: 0.76 + driftCurve * 0.18 + stableNoise(globalTick, 6, 0.006),
    abutmentTilt: 0.18 + driftCurve * 0.21 + stableNoise(globalTick, 13, 0.001)
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


function describeStatusDriver(point, statusDrivers) {
  if (!point) return 'awaiting data';
  if (point.scenarioId === 'baseline') return 'normal baseline';
  if (point.scenarioId === 'load_event') return 'service load response';
  if (point.scenarioId === 'persistent_high') return 'midspan strain persistence';
  if (point.scenarioId === 'tilt_drift') return 'abutment tilt drift';

  const primaryDriver = statusDrivers?.[0];
  return primaryDriver?.label?.toLowerCase() ?? 'normal baseline';
}

function detectAnomalies(point) {
  if (point.scenarioId === 'load_event') {
    return [
      {
        code: 'NORMAL_LOAD_RESPONSE',
        message: 'Normal service-load response.',
        support: 'Two truck peaks pass and recover as expected.',
        severity: 24
      }
    ];
  }

  if (point.scenarioId === 'persistent_high') {
    return [
      {
        code: 'CONTINUOUS_HIGH',
        message: 'Sustained midspan strain.',
        support: 'Schedule inspection and verify the gauge.',
        severity: 76
      }
    ];
  }

  if (point.scenarioId === 'tilt_drift') {
    const severity = point.abutmentTilt >= 0.34 ? 90 : point.abutmentTilt >= 0.22 ? 76 : 58;
    return [
      {
        code: 'TILT_DRIFT',
        message: 'Abutment tilt is drifting upward.',
        support: 'Inspect the wall and bearing area.',
        severity
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
    candidates.find((candidate) => candidate.key === 'abutmentTilt').score += 160;
    candidates.find((candidate) => candidate.key === 'supportDisplacement').score += 15;
  }

  if (point.scenarioId === 'persistent_high') {
    candidates.find((candidate) => candidate.key === 'strainMidspan').score += 100;
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
    scenarioAssumption: scenario.assumption,
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
  const statusDriverLabel = describeStatusDriver(pointWithSeverity, statusDrivers);
  const dominantIssue = selectDominantIssue(pointWithSeverity, sensorStatuses);

  return {
    ...pointWithSeverity,
    sensorStatuses,
    statusDrivers,
    statusDriverLabel,
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
      currentAnomaly: 'Awaiting telemetry.',
      currentAnomalyDetail: 'No current simulation point is available.',
      statusDriverLabel: 'awaiting data'
    };
  }

  const topAnomaly = latestPoint.anomalies?.[0];
  const status = latestPoint.overallStatus ?? formatStatus('green');
  const currentAnomaly = topAnomaly?.message ?? 'No active anomaly pattern.';
  const currentAnomalyDetail = topAnomaly?.support ?? 'Readings remain within normal monitoring limits.';

  return {
    ...status,
    level: `${status.label} - ${status.action}`,
    text: currentAnomaly,
    currentAnomaly,
    currentAnomalyDetail,
    statusDriverLabel: latestPoint.statusDriverLabel ?? describeStatusDriver(latestPoint, latestPoint.statusDrivers)
  };
}
