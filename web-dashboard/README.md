# Bridge Health Dashboard (Local Prototype)

Interactive React dashboard prototype for concrete girder / beam bridge structural health monitoring.

## Features
- Simulated live critical channels: critical strain, support displacement above bearing, and abutment / retaining wall tilt.
- Anomaly interpretation aligned with supervisor guidance:
  - spike with no load/event,
  - continuously high reading,
  - tilt drift.
- Maintenance / inspection status colour coding.
- Live trend chart with rolling data history.
- Bridge schematic and reference site photo panel.
- Start/stop simulation controls.

## Run locally
```bash
cd web-dashboard
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).
