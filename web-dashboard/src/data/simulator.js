export const MAX_POINTS = 40;

const SAMPLE_RATE_HZ = 200;
const DEFAULT_POINTS = 20;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function baseLoadProfile(simTime) {
  const rushHour = 0.65 + 0.25 * Math.sin(simTime * 0.18);
  const shortBursts = 0.18 * Math.sin(simTime * 1.8);
  const noise = randomInRange(-0.06, 0.06);
  return clamp(rushHour + shortBursts + noise, 0.25, 1.2);
}

function maintenanceStatusFromSeverity(severity) {
  if (severity >= 85) return { level: 'Urgent Inspection', color: '#ff4d4f' };
  if (severity >= 65) return { level: 'Schedule Inspection', color: '#ff7b59' };
  if (severity >= 40) return { level: 'Monitor Closely', color: '#f7b731' };
  return { level: 'Routine Monitoring', color: '#2dcf85' };
}

function detectAnomalies({ point, previousPoint }) {
  const anomalies = [];

  const strainJump = previousPoint ? point.criticalStrain - previousPoint.criticalStrain : 0;
  const noLoadEvent = point.loadEvent === 'none';

  if (Math.abs(strainJump) > 35 && noLoadEvent) {
    anomalies.push({
      code: 'SPIKE_NO_EVENT',
      message: 'Spike with no load/event: possible permanent deflection or local damage.',
      severity: 78
    });
  }

  if (point.highReadingDurationSec >= 12) {
    anomalies.push({
      code: 'CONTINUOUS_HIGH',
      message: 'Continuously high reading: possible detached sensor or structural issue.',
      severity: 72
    });
  }

  if (point.tiltDriftRate >= 0.012) {
    anomalies.push({
      code: 'TILT_DRIFT',
      message: 'Tilt drift detected: possible abutment/soil movement.',
      severity: 88
    });
  }

  return anomalies;
}

function createBridgePoint({ timestamp = Date.now(), simTime = 0, previousPoint } = {}) {
  const loadLevel = baseLoadProfile(simTime);

  const loadEvent = Math.random() < 0.12 ? 'vehicle crossing' : 'none';
  const eventBoost = loadEvent === 'vehicle crossing' ? randomInRange(0.12, 0.42) : 0;
  const effectiveLoad = clamp(loadLevel + eventBoost, 0.2, 1.45);

  const criticalStrain = Number((95 + effectiveLoad * 110 + randomInRange(-6, 6)).toFixed(1));
  const midSpanDisplacement = Number((0.9 + effectiveLoad * 2.3 + randomInRange(-0.08, 0.08)).toFixed(3));
  const supportDisplacement = Number((0.25 + effectiveLoad * 1.2 + randomInRange(-0.05, 0.05)).toFixed(3));

  const previousTilt = previousPoint?.abutmentTilt ?? 0.08;
  const tiltDrift = randomInRange(-0.002, 0.004) + (Math.random() < 0.08 ? randomInRange(0.004, 0.012) : 0);
  const abutmentTilt = Number(clamp(previousTilt + tiltDrift, 0.03, 0.46).toFixed(3));
  const tiltDriftRate = Number(Math.max(0, abutmentTilt - previousTilt).toFixed(3));

  const highStrain = criticalStrain >= 185;
  const highSupportDisp = supportDisplacement >= 1.55;
  const highTilt = abutmentTilt >= 0.32;

  const previousDuration = previousPoint?.highReadingDurationSec ?? 0;
  const highReadingDurationSec = highStrain || highSupportDisp || highTilt ? previousDuration + 1 : 0;

  const rawSeverity =
    (criticalStrain - 90) * 0.42 +
    supportDisplacement * 18 +
    midSpanDisplacement * 10 +
    abutmentTilt * 95 +
    (highReadingDurationSec >= 12 ? 14 : 0);

  const point = {
    time: new Date(timestamp).toLocaleTimeString([], { hour12: false }),
    timestamp,
    simTime,
    loadEvent,
    criticalStrain,
    midSpanDisplacement,
    supportDisplacement,
    abutmentTilt,
    tiltDriftRate,
    highReadingDurationSec,
    anomalySeverity: clamp(Math.round(rawSeverity), 5, 99)
  };

  const anomalies = detectAnomalies({ point, previousPoint });
  const anomalySeverity = anomalies.length > 0 ? Math.max(...anomalies.map((a) => a.severity), point.anomalySeverity) : point.anomalySeverity;
  const maintenance = maintenanceStatusFromSeverity(anomalySeverity);

  return {
    ...point,
    anomalySeverity,
    anomalies,
    maintenanceLevel: maintenance.level,
    maintenanceColor: maintenance.color
  };
}

export function createInitialHistory(points = DEFAULT_POINTS) {
  const now = Date.now();
  let previousPoint;

  return Array.from({ length: points }, (_, index) => {
    const point = createBridgePoint({
      timestamp: now - (points - index) * 1000,
      simTime: index / SAMPLE_RATE_HZ,
      previousPoint
    });
    previousPoint = point;
    return point;
  });
}

export function nextDataPoint(previous) {
  return createBridgePoint({
    timestamp: Date.now(),
    simTime: (previous?.simTime ?? 0) + 1 / SAMPLE_RATE_HZ,
    previousPoint: previous
  });
}

export function evaluateStatus(latestPoint) {
  const anomalies = latestPoint?.anomalies ?? [];

  if (anomalies.length === 0) {
    return {
      level: 'Normal Trend',
      color: '#2dcf85',
      text: 'No active anomaly pattern detected in the latest interval.'
    };
  }

  const top = anomalies.reduce((max, current) => (current.severity > max.severity ? current : max), anomalies[0]);

  if (top.severity >= 85) {
    return {
      level: 'Critical',
      color: '#ff4d4f',
      text: top.message
    };
  }

  if (top.severity >= 65) {
    return {
      level: 'High',
      color: '#ff7b59',
      text: top.message
    };
  }

  return {
    level: 'Moderate',
    color: '#f7b731',
    text: top.message
  };
}
