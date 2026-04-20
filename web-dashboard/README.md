# Bridge Health Dashboard (Local Prototype)

Interactive React dashboard prototype for simulated bridge structural health monitoring.

## Features
- Simulated live sensor streams (strain, stress, axial force, deflection)
- Live trend chart with rolling data history
- Bridge health risk assessment panel
- Member condition table and alert list
- Bridge schematic with condition highlighting
- Camera feed placeholder panel
- Start/stop simulation controls

## Run locally
```bash
cd web-dashboard
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Presentation tips
- Keep simulation running in live mode to demonstrate trend changes.
- Click **Stop Simulation** to freeze a snapshot and discuss readings.
- Resize the browser window to show responsive behaviour.
