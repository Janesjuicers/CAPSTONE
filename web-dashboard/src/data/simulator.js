// Utility functions used to generate simulated structural monitoring data.

export const MAX_POINTS = 40;

const BRIDGE_MEMBERS = [
  'Girder G1',
  'Girder G2',
  'Girder G3',
  'Deck D1',
  'Deck D2',
  'Pier P1',
  'Pier P2',
  'Bearing B1'
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function trend(base, variance) {
  return base + randomInRange(-variance, variance);
}

export function createInitialHistory(points = 20) {
  const now = Date.now();
  return Array.from({ length: points }, (_, index) => {
    const t = new Date(now - (points - index) * 1000);
    return {
      time: t.toLocaleTimeString([], { hour12: false }),
      strain: trend(410, 20),
      stress: trend(145, 10),
      axialForce: trend(940, 55),
      deflection: trend(13, 1.2)
    };
  });
}

export function nextDataPoint(previous) {
  const next = {
    time: new Date().toLocaleTimeString([], { hour12: false }),
    strain: clamp(trend(previous.strain, 18), 280, 620),
    stress: clamp(trend(previous.stress, 8), 85, 240),
    axialForce: clamp(trend(previous.axialForce, 50), 550, 1550),
    deflection: clamp(trend(previous.deflection, 1.5), 4, 30)
  };

  return next;
}

export function memberConditions(latestPoint) {
  const baseLoadFactor = latestPoint.stress / 200 + latestPoint.deflection / 30;

  return BRIDGE_MEMBERS.map((member, index) => {
    const localizedShift = randomInRange(-0.16, 0.24) + index * 0.02;
    const conditionScore = clamp(100 - (baseLoadFactor + localizedShift) * 28, 45, 99);

    const status =
      conditionScore >= 84
        ? 'Normal'
        : conditionScore >= 72
          ? 'Observe'
          : conditionScore >= 60
            ? 'Warning'
            : 'Critical';

    return {
      member,
      conditionScore: Number(conditionScore.toFixed(1)),
      status,
      strain: Number((latestPoint.strain + localizedShift * 40).toFixed(1)),
      stress: Number((latestPoint.stress + localizedShift * 22).toFixed(1)),
      deflection: Number((latestPoint.deflection + localizedShift * 1.7).toFixed(2))
    };
  });
}

export function evaluateRisk(latestPoint, members) {
  const conditionMin = Math.min(...members.map((m) => m.conditionScore));

  const riskIndex =
    latestPoint.stress * 0.27 +
    latestPoint.deflection * 1.8 +
    latestPoint.strain * 0.06 +
    (100 - conditionMin) * 0.9;

  if (riskIndex < 92) {
    return { level: 'Low', color: '#2dcf85', text: 'Bridge stable. No immediate action required.' };
  }

  if (riskIndex < 125) {
    return { level: 'Moderate', color: '#f7b731', text: 'Monitor load concentration and inspect selected members.' };
  }

  if (riskIndex < 150) {
    return { level: 'High', color: '#ff7b59', text: 'Deploy targeted inspection and activate caution advisory.' };
  }

  return { level: 'Critical', color: '#ff4d4f', text: 'Immediate response needed. Restrict heavy traffic.' };
}
