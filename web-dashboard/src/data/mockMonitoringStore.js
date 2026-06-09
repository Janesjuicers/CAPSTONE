// Prototype-only mock monitoring store.
// This static frontend data represents records that a future database-backed
// SHM platform could provide. It intentionally uses no backend, API, cloud
// database, authentication provider, or environment variables.
export const mockMonitoringStore = {
  bridgeAsset: {
    assetId: 'SHM-BR-2047',
    name: 'Demonstration Concrete Girder Bridge',
    corridor: 'Urban arterial freight route',
    location: 'Victoria, Australia',
    owner: 'VicRoads concept operator',
    structureType: 'Single-span reinforced concrete girder bridge',
    spans: 1,
    deckLengthM: 28.4,
    yearBuilt: 1998,
    monitoringCommissioned: '2026-04-12',
    designNotes: 'Prototype asset profile for simulated bearing, girder strain, and abutment wall movement monitoring.'
  },
  sensorHistorySummary: {
    summaryWindow: 'Last 30 days',
    sampleCount: 129600,
    uptimePercent: 99.2,
    activeSensors: 5,
    channels: [
      { id: 'SG-L01', type: 'Strain gauge', location: 'Left support girder soffit', latestRange: '105–158 με', calibrationDue: '2026-07-15' },
      { id: 'SG-M02', type: 'Strain gauge', location: 'Midspan girder soffit', latestRange: '112–214 με', calibrationDue: '2026-07-15' },
      { id: 'SG-R03', type: 'Strain gauge', location: 'Right support girder soffit', latestRange: '103–156 με', calibrationDue: '2026-07-15' },
      { id: 'LD-B04', type: 'Linear displacement', location: 'Right bearing seat', latestRange: '0.59–0.96 mm', calibrationDue: '2026-08-02' },
      { id: 'TI-A05', type: 'Tilt inclinometer', location: 'Abutment retaining wall', latestRange: '0.10–0.39°', calibrationDue: '2026-08-02' }
    ],
    lastDataQualityReview: '2026-06-03',
    qualityNote: 'No missing channels in the latest review window; two short packet-loss intervals were auto-filled for dashboard continuity.'
  },
  anomalyEventLog: [
    {
      eventId: 'EVT-2026-061',
      timestamp: '2026-06-07 14:18',
      severity: 'amber',
      title: 'Midspan strain exceeded watch band during heavy vehicle crossing',
      sourceSensors: ['SG-M02', 'SG-L01', 'SG-R03'],
      status: 'Reviewed',
      action: 'Continue trend monitoring and compare against next freight peak.'
    },
    {
      eventId: 'EVT-2026-052',
      timestamp: '2026-05-29 08:42',
      severity: 'red',
      title: 'Sustained displacement persistence above bearing threshold',
      sourceSensors: ['LD-B04'],
      status: 'Inspection raised',
      action: 'Field crew requested bearing-seat visual inspection.'
    },
    {
      eventId: 'EVT-2026-047',
      timestamp: '2026-05-21 19:05',
      severity: 'green',
      title: 'Baseline recovery confirmed after rainfall and traffic surge',
      sourceSensors: ['TI-A05', 'LD-B04'],
      status: 'Closed',
      action: 'No maintenance action required.'
    }
  ],
  inspectionHistory: [
    {
      inspectionId: 'INSP-2026-018',
      date: '2026-06-01',
      type: 'Targeted bearing and abutment inspection',
      inspector: 'Mock field inspection team',
      finding: 'Minor debris at bearing shelf; no visible concrete spalling or exposed reinforcement.',
      recommendation: 'Clear debris during next routine maintenance window.'
    },
    {
      inspectionId: 'INSP-2026-011',
      date: '2026-04-18',
      type: 'SHM commissioning walkdown',
      inspector: 'Prototype instrumentation team',
      finding: 'Sensors verified against baseline load-test readings.',
      recommendation: 'Use first 60 days of readings to refine operational thresholds.'
    }
  ],
  maintenanceHistory: [
    {
      workOrder: 'WO-2026-034',
      date: '2026-06-05',
      activity: 'Bearing shelf clean-out and drainage check',
      contractor: 'Mock civil maintenance crew',
      result: 'Completed; monitoring remained online during works.',
      followUp: 'Review displacement trend after next heavy rainfall event.'
    },
    {
      workOrder: 'WO-2026-019',
      date: '2026-04-22',
      activity: 'Sensor cable protection and junction-box seal inspection',
      contractor: 'Prototype instrumentation team',
      result: 'Completed with no failed channels.',
      followUp: 'Re-check cable ties at next quarterly inspection.'
    }
  ]
};
