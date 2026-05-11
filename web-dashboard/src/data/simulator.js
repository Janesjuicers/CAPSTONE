// JavaScript port of the core computational model from digital_twin_complete.m.
// The browser dashboard cannot run MATLAB or NI-DAQ directly, so this module keeps
// the existing simulation API while using a Pratt-truss FE model for dashboard data.

export const MAX_POINTS = 40;

const SAMPLE_RATE_HZ = 200;
const DEFAULT_POINTS = 20;
const FALLBACK_LOAD_N = 1000;
const LOAD_NODE = 4; // MATLAB node 4, 1-based.
const MIN_SOLVE_LOAD_N = 1;
const MAX_LOAD_N = 5000;
const MICROSTRAIN = 1e6;
const PA_TO_MPA = 1e6;
const N_TO_KN = 1000;
const M_TO_MM = 1000;
const ZERO_TOLERANCE = 1e-9;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function createTrussGeometry() {
  const span = 2.0;
  const height = 0.4;
  const nPanels = 5;
  const panelLength = span / nPanels;

  const bottomNodes = Array.from({ length: nPanels + 1 }, (_, index) => [index * panelLength, 0]);
  const topNodes = Array.from({ length: nPanels - 1 }, (_, index) => [(index + 1) * panelLength, height]);

  return {
    nodes: [...bottomNodes, ...topNodes],
    elements: [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [7, 8],
      [8, 9],
      [9, 10],
      [2, 7],
      [3, 8],
      [4, 9],
      [5, 10],
      [1, 7],
      [7, 3],
      [8, 4],
      [9, 5],
      [10, 6]
    ],
    labels: ['BC1', 'BC2', 'BC3', 'BC4', 'BC5', 'TC1', 'TC2', 'TC3', 'V1', 'V2', 'V3', 'V4', 'D1', 'D2', 'D3', 'D4', 'D5'],
    E: 69e9,
    A: 2.0e-4,
    fy: 270e6,
    fixedDofs: [1, 2, 12], // MATLAB 1-based DOFs: node 1 pin + node 6 vertical roller.
    span,
    height
  };
}

const TRUSS = createTrussGeometry();

function zeros(rows, cols = 1) {
  if (cols === 1) return Array.from({ length: rows }, () => 0);
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

function solveLinearSystem(matrix, rhs) {
  const n = rhs.length;
  const a = matrix.map((row, rowIndex) => [...row, rhs[rowIndex]]);

  for (let pivotIndex = 0; pivotIndex < n; pivotIndex += 1) {
    let maxRow = pivotIndex;
    for (let row = pivotIndex + 1; row < n; row += 1) {
      if (Math.abs(a[row][pivotIndex]) > Math.abs(a[maxRow][pivotIndex])) {
        maxRow = row;
      }
    }

    if (Math.abs(a[maxRow][pivotIndex]) < ZERO_TOLERANCE) {
      throw new Error('FE stiffness matrix is singular or ill-conditioned.');
    }

    if (maxRow !== pivotIndex) {
      [a[pivotIndex], a[maxRow]] = [a[maxRow], a[pivotIndex]];
    }

    for (let row = pivotIndex + 1; row < n; row += 1) {
      const factor = a[row][pivotIndex] / a[pivotIndex][pivotIndex];
      for (let col = pivotIndex; col <= n; col += 1) {
        a[row][col] -= factor * a[pivotIndex][col];
      }
    }
  }

  const solution = zeros(n);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = a[row][n];
    for (let col = row + 1; col < n; col += 1) {
      sum -= a[row][col] * solution[col];
    }
    solution[row] = sum / a[row][row];
  }

  return solution;
}

function findWorstMember(truss, loadN = FALLBACK_LOAD_N, loadNode = LOAD_NODE, calFactor = 1) {
  const ndof = truss.nodes.length * 2;
  const stiffness = zeros(ndof, ndof);

  truss.elements.forEach(([nodeI, nodeJ]) => {
    const [xi, yi] = truss.nodes[nodeI - 1];
    const [xj, yj] = truss.nodes[nodeJ - 1];
    const length = Math.hypot(xj - xi, yj - yi);
    const c = (xj - xi) / length;
    const s = (yj - yi) / length;
    const factor = (truss.E * truss.A) / length;
    const local = [
      [c * c, c * s, -c * c, -c * s],
      [c * s, s * s, -c * s, -s * s],
      [-c * c, -c * s, c * c, c * s],
      [-c * s, -s * s, c * s, s * s]
    ].map((row) => row.map((value) => value * factor));
    const dofs = [2 * nodeI - 2, 2 * nodeI - 1, 2 * nodeJ - 2, 2 * nodeJ - 1];

    dofs.forEach((globalRow, localRow) => {
      dofs.forEach((globalCol, localCol) => {
        stiffness[globalRow][globalCol] += local[localRow][localCol];
      });
    });
  });

  const force = zeros(ndof);
  force[2 * loadNode - 1] = -loadN;
  const fixed = new Set(truss.fixedDofs.map((dof) => dof - 1));
  const free = Array.from({ length: ndof }, (_, index) => index).filter((index) => !fixed.has(index));
  const reducedK = free.map((row) => free.map((col) => stiffness[row][col]));
  const reducedF = free.map((row) => force[row]);
  const displacements = zeros(ndof);

  try {
    const freeDisplacements = solveLinearSystem(reducedK, reducedF);
    free.forEach((dof, index) => {
      displacements[dof] = freeDisplacements[index];
    });
  } catch {
    return createFallbackResults(truss, loadN, loadNode, calFactor);
  }

  const memberResults = truss.elements.map(([nodeI, nodeJ], index) => {
    const [xi, yi] = truss.nodes[nodeI - 1];
    const [xj, yj] = truss.nodes[nodeJ - 1];
    const length = Math.hypot(xj - xi, yj - yi);
    const c = (xj - xi) / length;
    const s = (yj - yi) / length;
    const u = [displacements[2 * nodeI - 2], displacements[2 * nodeI - 1], displacements[2 * nodeJ - 2], displacements[2 * nodeJ - 1]];
    const deltaLength = -c * u[0] - s * u[1] + c * u[2] + s * u[3];
    const axialForce = calFactor * ((truss.E * truss.A) / length) * deltaLength;
    const stress = axialForce / truss.A;
    const strain = deltaLength / length;
    const utilisation = Math.abs(stress) / truss.fy;

    return {
      index,
      label: truss.labels[index],
      axialForce,
      stress,
      strain,
      utilisation
    };
  });

  const worstMember = memberResults.reduce((worst, member) => (member.utilisation > worst.utilisation ? member : worst), memberResults[0]);

  return {
    displacements,
    members: memberResults,
    worstIdx: worstMember.index,
    worstLabel: worstMember.label,
    midDisp: displacements[2 * loadNode - 1],
    converged: true,
    loadN,
    calFactor
  };
}

function createFallbackResults(truss, loadN, loadNode, calFactor) {
  const loadScale = loadN / FALLBACK_LOAD_N;
  const signs = [1, 1, 1, 1, 1, -1, -1, -1, 0.25, 0.3, 0.3, 0.25, 0.7, 0.8, 0.8, 0.7, 0.6];
  const members = truss.labels.map((label, index) => {
    const axialForce = signs[index] * 750 * loadScale * calFactor;
    const stress = axialForce / truss.A;
    return {
      index,
      label,
      axialForce,
      stress,
      strain: stress / truss.E,
      utilisation: Math.abs(stress) / truss.fy
    };
  });
  const worstMember = members.reduce((worst, member) => (member.utilisation > worst.utilisation ? member : worst), members[0]);

  return {
    displacements: zeros(truss.nodes.length * 2),
    members,
    worstIdx: worstMember.index,
    worstLabel: worstMember.label,
    midDisp: -0.0025 * loadScale,
    converged: false,
    loadN,
    loadNode,
    calFactor
  };
}

const BASELINE_RESULTS = findWorstMember(TRUSS, FALLBACK_LOAD_N, LOAD_NODE, 1);
const GAUGE_MEMBER_INDEX = BASELINE_RESULTS.worstIdx;
const THEORETICAL_FORCE_PER_N = Math.abs(BASELINE_RESULTS.members[GAUGE_MEMBER_INDEX]?.axialForce ?? 0) / FALLBACK_LOAD_N;

function simulatedGaugeStrain(simTime) {
  const base = 2.5e-5;
  const vibration = 0.3e-5 * Math.sin(2 * Math.PI * 5 * simTime);
  const drift = 0.5e-5 * Math.sin(2 * Math.PI * 0.1 * simTime);
  const noise = randomInRange(-0.05e-5, 0.05e-5);
  return base + vibration + drift + noise;
}

function statusFromUtilisation(utilisation) {
  if (utilisation >= 0.8) return 'Critical';
  if (utilisation >= 0.5) return 'Warning';
  if (utilisation >= 0.3) return 'Observe';
  return 'Normal';
}

function buildDashboardPoint({ timestamp = Date.now(), simTime = 0, previousCalFactor = 1 } = {}) {
  const gaugeStrain = simulatedGaugeStrain(simTime);
  const measuredForce = TRUSS.E * TRUSS.A * gaugeStrain;
  const estimatedLoad = THEORETICAL_FORCE_PER_N > ZERO_TOLERANCE ? clamp(Math.abs(measuredForce) / THEORETICAL_FORCE_PER_N, 0, MAX_LOAD_N) : FALLBACK_LOAD_N;
  const baselineGaugeForce = BASELINE_RESULTS.members[GAUGE_MEMBER_INDEX]?.axialForce ?? 0;
  const rawCalFactor = Math.abs(baselineGaugeForce) > ZERO_TOLERANCE ? measuredForce / baselineGaugeForce : previousCalFactor;
  const calFactor = clamp(0.9 * previousCalFactor + 0.1 * rawCalFactor, 0.5, 2);
  const results = findWorstMember(TRUSS, Math.max(estimatedLoad, MIN_SOLVE_LOAD_N), LOAD_NODE, calFactor);
  const gaugeMember = results.members[GAUGE_MEMBER_INDEX] ?? results.members[results.worstIdx];
  const worstMember = results.members[results.worstIdx];

  return {
    time: new Date(timestamp).toLocaleTimeString([], { hour12: false }),
    timestamp,
    simTime,
    calFactor,
    estimatedLoad: Number(estimatedLoad.toFixed(1)),
    loadN: Number(results.loadN.toFixed(1)),
    midSpanDisplacement: Number((results.midDisp * M_TO_MM).toFixed(3)),
    deflection: Number(Math.abs(results.midDisp * M_TO_MM).toFixed(2)),
    worstMember: results.worstLabel,
    worstMemberIndex: results.worstIdx,
    utilisation: Number(worstMember.utilisation.toFixed(4)),
    strain: Number((gaugeMember.strain * MICROSTRAIN).toFixed(1)),
    stress: Number((gaugeMember.stress / PA_TO_MPA).toFixed(2)),
    axialForce: Number((gaugeMember.axialForce / N_TO_KN).toFixed(3)),
    converged: results.converged,
    gaugeMember: gaugeMember.label,
    members: results.members.map((member) => ({
      member: member.label,
      memberIndex: member.index,
      strain: Number((member.strain * MICROSTRAIN).toFixed(2)),
      stress: Number((member.stress / PA_TO_MPA).toFixed(3)),
      axialForce: Number((member.axialForce / N_TO_KN).toFixed(4)),
      utilisation: Number(member.utilisation.toFixed(5)),
      conditionScore: Number(clamp(100 - member.utilisation * 100, 0, 100).toFixed(1)),
      status: statusFromUtilisation(member.utilisation),
      deflection: Number(Math.abs(results.midDisp * M_TO_MM).toFixed(3))
    }))
  };
}

export function createInitialHistory(points = DEFAULT_POINTS) {
  const now = Date.now();
  let previousCalFactor = 1;

  return Array.from({ length: points }, (_, index) => {
    const point = buildDashboardPoint({
      timestamp: now - (points - index) * 1000,
      simTime: index / SAMPLE_RATE_HZ,
      previousCalFactor
    });
    previousCalFactor = point.calFactor;
    return point;
  });
}

export function nextDataPoint(previous) {
  return buildDashboardPoint({
    timestamp: Date.now(),
    simTime: (previous?.simTime ?? 0) + 1 / SAMPLE_RATE_HZ,
    previousCalFactor: previous?.calFactor ?? 1
  });
}

export function memberConditions(latestPoint) {
  if (Array.isArray(latestPoint?.members) && latestPoint.members.length > 0) {
    return latestPoint.members;
  }

  // Fallback for legacy or malformed points so the dashboard can still render.
  return buildDashboardPoint().members;
}

export function evaluateRisk(latestPoint, members) {
  const maxUtilisation = Math.max(...members.map((member) => member.utilisation ?? 0));
  const worstMember = latestPoint?.worstMember ?? members.find((member) => member.utilisation === maxUtilisation)?.member ?? 'unknown member';
  const estimatedLoad = latestPoint?.estimatedLoad ?? 0;

  if (maxUtilisation < 0.3) {
    return {
      level: 'Low',
      color: '#2dcf85',
      text: `Worst member ${worstMember} is below 30% utilisation. Estimated load: ${estimatedLoad.toFixed?.(0) ?? estimatedLoad} N.`
    };
  }

  if (maxUtilisation < 0.5) {
    return {
      level: 'Moderate',
      color: '#f7b731',
      text: `Monitor ${worstMember}; utilisation is trending above the observation threshold.`
    };
  }

  if (maxUtilisation < 0.8) {
    return {
      level: 'High',
      color: '#ff7b59',
      text: `Inspect ${worstMember}; FE utilisation is above 50%.`
    };
  }

  return {
    level: 'Critical',
    color: '#ff4d4f',
    text: `Immediate response required. ${worstMember} exceeds 80% utilisation.`
  };
}
