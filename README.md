# SafeWorkers (SAMVED)

**S**afe **A**ccess **M**anagement & **V**erification for **E**ntry **D**ecisions

A real-time safety management platform for urban sanitation workers performing hazardous manhole-entry operations. The system enforces PPE verification, monitors live gas sensor data, provides Hindi-language AI advisories, and gives supervisors and administrators situational awareness over field operations.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Demo Credentials](#demo-credentials)
- [Roles & Features](#roles--features)
  - [Worker Dashboard](#worker-dashboard)
  - [Supervisor Dashboard](#supervisor-dashboard)
  - [Admin Dashboard](#admin-dashboard)
- [AI & Innovation Features](#ai--innovation-features)
  - [Safety Co-Pilot](#safety-co-pilot)
  - [AI se Visleshan (AI Ward Analysis)](#ai-se-visleshan-ai-ward-analysis)
  - [Safe Route & Team Planning](#safe-route--team-planning)
- [Backend API](#backend-api)
- [Real-Time Socket Events](#real-time-socket-events)

---

## Overview

SafeWorkers addresses occupational safety for sewer and drainage workers — one of the most hazardous occupations in urban India. Workers enter confined manholes exposed to toxic gases (H₂S, CO, CH₄), oxygen-deficient atmospheres, and flood risks with limited communication.

The platform provides:

- **Mandatory pre-entry protocol** — PPE photo verification + live gas scan before any worker enters a manhole
- **Live sensor monitoring** — real-time H₂S, CO, O₂, CH₄, and water-level readings streamed to the supervisor map
- **Automated SOS** — timer-based auto-alert if a worker does not exit within the allotted window
- **Hindi-language AI advisories** — spoken aloud via the Web Speech API so workers with low literacy can still receive safety guidance
- **Admin analytics** — ward-level risk scoring, NaMaSTE-SSW compliance tracking, incident review, and deployment planning

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + Vite 7 |
| Routing | react-router-dom v7 |
| Real-time | Socket.IO v4 (client + server) |
| Maps | Leaflet + react-leaflet v5 |
| Charts | Recharts v3 |
| Icons | lucide-react v0.575 |
| Backend runtime | Node.js (CommonJS) |
| Backend framework | Express 4 |
| Dev server | nodemon v3 |

No external database or cloud services are required. All data is in-memory seed data intended for demonstration.

---

## Project Structure

```
SafeWorkers/
├── frontend/
│   └── src/
│       ├── App.jsx                  # Routing + role-based PrivateRoute guards
│       ├── context/
│       │   ├── AuthContext.jsx      # Login state + demo user store
│       │   └── ThemeContext.jsx
│       ├── hooks/
│       │   └── useSocket.js         # Socket.IO connection hook
│       ├── components/              # Landing page sections (Hero, Features, etc.)
│       └── pages/
│           ├── Login.jsx
│           ├── admin/
│           │   ├── AdminDashboard.jsx
│           │   └── AdminDashboard.css
│           ├── worker/
│           │   ├── WorkerDashboard.jsx
│           │   ├── SafetyDiary.jsx
│           │   └── *.css
│           └── supervisor/
│               ├── SupervisorDashboard.jsx
│               └── SupervisorDashboard.css
└── backend/
    ├── server.js                    # Express + Socket.IO entry point (port 3001)
    ├── routes/
    │   ├── workers.js
    │   ├── jobs.js
    │   └── alerts.js
    ├── controllers/
    │   └── safetyProfile.js
    ├── advisory/
    │   └── evaluateRisk.js          # Gas + weather risk classification
    ├── sensors/
    │   ├── engine.js                # 1-second sensor tick loop
    │   └── simulator.js             # Per-worker gas simulation
    ├── utils/
    │   └── evaluatePlan.js          # Route & workload safety checks
    └── data/                        # Seed data (workers, jobs, incidents)
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### 1. Start the backend

```bash
cd backend
npm install
npm run dev       # nodemon — auto-restarts on file changes
# Server listens on http://localhost:3001
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev       # Vite dev server with hot reload
# App available at http://localhost:5173
```

Open `http://localhost:5173` in your browser and log in with one of the demo accounts below.

---

## Demo Credentials

| Role | Username | Password |
|---|---|---|
| Worker | `ravi.kumar` | `worker123` |
| Supervisor | `priya.sharma` | `super123` |
| Admin | `arjun.das` | `admin2024` |

---

## Roles & Features

### Worker Dashboard

The worker view is fully Hindi-first and optimised for low-literacy field use.

- **Job card** — shows assigned job ID, address, zone, risk level, manhole depth, and weather warning
- **Pre-entry checklist** — two mandatory steps before entry is permitted:
  1. PPE photo capture (via device camera)
  2. Gas level swipe-to-scan
- **Live gas gauge** — real-time H₂S / CO / O₂ / CH₄ / water-level rings during manhole operations, streamed from the backend sensor engine
- **Entry timer** — 30-minute countdown ring; auto-SOS fires on expiry
- **Manual SOS** — long-press FAB button (1.5 s) dispatches an emergency alert to the supervisor
- **Hazard reports** — one-tap buttons for Gas Cloud, Water Flood, Broken Wall, Other
- **Safety Co-Pilot advisory** — a real-time Hindi risk advisory card computed locally and enriched by the backend; high-priority advisories are spoken aloud automatically via Text-to-Speech
- **Safety Diary** — personal safety score (0–100), earned badges, incident-free streak, and job history

### Supervisor Dashboard

- **Live map** — Leaflet map centred on Mumbai; every worker is a coloured pulsing pin (green = idle, amber = in manhole, red = SOS)
- **SOS modal** — full-screen alert with audio alarm, worker name, GPS coordinates, and actions (Acknowledge / Dispatch Emergency)
- **PPE approval queue** — review and approve or deny worker PPE verification before granting entry
- **Roster tab** — fatigue bar per worker (entries this shift / maximum allowed), battery %, signal strength; click a row to fly the map to that worker
- **Job dispatch** — drag workers onto jobs (or vice versa); the system blocks over-assignment when a worker's fatigue limit is reached, with a supervised override option
- **Evacuation** — clicking a worker's map popup sends an `evac_command` socket event directly to that worker's device

### Admin Dashboard

- **KPI row** — Total Entries, Incident Rate, Near-Misses, PPE + Gas Compliance
- **Charts** — Bar chart (entries + incidents by zone), Line chart (weekly incident trend), Heatmap (zone × ward incident intensity)
- **Audit Log** — full searchable and date-filterable entry/exit log; one-click CSV export
- **Worker Health** — safety scores, entry counts, medical checkup status, incident-free streaks
- **NaMaSTE-SSW Compliance** — Aadhaar, PM-JAY, training validity, and KYC status per worker
- **Incident Review** — incident type, live gas readings at time of event, supervisor-override usage flag
- **Sanipreneur Leaderboard** — safety performance ranking with subsidy eligibility markers
- **AI Decision Support** — ward-level AI analysis (see below)
- **Safe Route & Team Planning** — AI-assisted deployment validation (see below)

---

## AI & Innovation Features

### Safety Co-Pilot

The **Safety Co-Pilot** (सुरक्षा सह-पायलट) is a privacy-first, multi-layered risk advisory system.

**Advisory pipeline:**

1. **Local computation** — on dashboard load, `computeLocalAdvisory()` evaluates manhole depth (>3 m flag), recent site incidents, weather conditions (heavy rain, flood warning, heatwave), and live gas thresholds (H₂S ≥10 ppm, CO ≥200 ppm, O₂ <19.5%, CH₄ ≥25% LEL, water ≥30 cm). The result is a structured advisory with `low / medium / high` priority.

2. **Backend enrichment** — simultaneously, the worker's socket emits `request_advisory`. The server runs the same classification in `backend/advisory/evaluateRisk.js` and emits `live_safety_advisory` back.

3. **Hindi TTS** — if priority is `high`, the advisory is spoken aloud automatically via the browser Web Speech API (`lang: hi-IN`, `rate: 0.9`). Workers can also tap the speaker icon to replay at any time.

4. **Weather push alerts** — calling `POST /api/advisory/weather-alert` broadcasts a targeted Hindi warning to all connected workers.

> Advisory data contains only safety parameters. No location data is stored or transmitted by the advisory system.

---

### AI se Visleshan (AI Ward Analysis)

**"AI से विश्लेषण"** is the ward-level decision-support feature in the Admin Dashboard.

**How it works:**

1. The admin clicks **AI से विश्लेषण** on any of the 8 city wards (W1–W8).
2. A loading spinner appears for 1.5 seconds while the analysis is "computed".
3. The full Hindi advisory text types out character-by-character (streaming simulation at 20 ms/character) using the ward's pre-authored narrative from `AI_WARD_TEXT`.
4. A **sound icon** (🔊) appears next to the analysis header. The speech does **not** play automatically — it only starts when the admin explicitly clicks this icon.
5. Clicking the icon again while the speech is playing **stops it immediately** — the icon switches to a mute (🔇) state so the admin always knows the current audio status.

**Behaviour summary:**

| User action | Result |
|---|---|
| Click "AI से विश्लेषण" | Starts typing animation only — no audio |
| Click 🔊 (Volume icon) | Starts Hindi TTS narration of the ward advisory |
| Click 🔇 (Mute icon, shown while playing) | Stops TTS immediately |
| Analysis finishes naturally | Icon resets to 🔊, ready to replay |

Each ward analysis covers: high-risk job ratio, hazardous waste percentage, incident count, root-cause explanation, and specific actionable recommendations (e.g., deploying mechanized jetting machines, enforcing rotation limits, mandatory gas-calibration protocols).

---

### Safe Route & Team Planning

Before deploying workers each day, the admin can validate the day's assignments via the **Route Plan** tab.

The system checks three safety rules per worker:

| Rule | Threshold | Flag |
|---|---|---|
| High-risk overload | > 2 high-risk jobs per shift | `HIGH_RISK_OVERLOAD` |
| Route fatigue | Total route distance > 3.5 km | `ROUTE_FATIGUE` |
| Workload limit | > 3 total jobs per shift | `WORKLOAD_OVERRUN` |

Violations are returned as a structured issue list with Hindi messages. The admin can then reassign jobs (suggested swap partners are shown) before confirming the deployment. The check calls `POST /api/plan/evaluate` with a 2-second timeout; if the backend is unavailable, the same evaluation runs locally in the browser.

---

## Backend API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/workers` | All worker records |
| GET | `/api/workers/gas-check` | Pre-entry gas level check |
| GET | `/api/jobs` | Job listings |
| GET | `/api/alerts` | Alert history |
| GET | `/api/safety-profile/:workerId` | Worker Safety Diary data |
| POST | `/api/advisory/weather-alert` | Push weather advisory to all workers |
| POST | `/api/plan/evaluate` | Validate today's job assignments |

---

## Real-Time Socket Events

| Direction | Event | Description |
|---|---|---|
| Client → Server | `worker_enter_manhole` | Starts sensor simulation for a worker |
| Client → Server | `worker_exit_manhole` | Stops simulation, sets worker to IDLE |
| Client → Server | `sos_manual` | Worker triggers SOS |
| Client → Server | `hazard_report` | Worker reports a field hazard |
| Client → Server | `request_advisory` | Worker requests Safety Co-Pilot advisory |
| Client → Server | `get_safety_profile` | Worker requests their Safety Diary |
| Server → Client | `sensor_update` | Live gas + water-level readings (1 s interval) |
| Server → Client | `auto_alert` | Gas threshold crossed or SOS triggered |
| Server → Client | `live_safety_advisory` | Safety Co-Pilot advisory response |
| Server → Client | `safety_profile` | Safety Diary data response |
| Server → Client | `worker_status_change` | Worker status changed (broadcast to supervisors) |
| Server → Specific | `evac_command` | Supervisor-initiated evacuation for one worker |
