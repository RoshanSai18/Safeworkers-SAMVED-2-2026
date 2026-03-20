# SafeWorkers (SAMVED)

**S**afe **A**ccess **M**anagement & **V**erification for **E**ntry **D**ecisions

SafeWorkers is a real-time safety platform for urban sanitation workers performing hazardous manhole-entry operations. It combines strict pre-entry gating, live gas telemetry, emergency alerting, role-specific dashboards, and AI-assisted decision support for workers, supervisors, and administrators.

---

## Table of Contents

- [Overview](#overview)
- [What Is Implemented](#what-is-implemented)
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
  - [AI Smart Assign + Counterfactual Simulation](#ai-smart-assign--counterfactual-simulation)
  - [RCA Assistant + Auto Incident Postmortem](#rca-assistant--auto-incident-postmortem)
  - [AI Ward Intelligence](#ai-ward-intelligence)
  - [Safe Route & Team Planning + Plan Co-Pilot](#safe-route--team-planning--plan-co-pilot)
  - [Emergency Evacuation Drill Mode](#emergency-evacuation-drill-mode)
- [Backend API](#backend-api)
- [Real-Time Socket Events](#real-time-socket-events)
- [Data & Persistence](#data--persistence)

---

## Overview

Sanitation workers in confined spaces face toxic gas exposure, oxygen deficiency, flood risk, and delayed rescue coordination. SafeWorkers addresses this with:

- **Mandatory pre-entry controls** (PPE + gas check before entry)
- **Live sensor monitoring** (H2S, CO, O2, CH4, WATER)
- **Emergency response tooling** (manual SOS, auto escalation, evacuation command)
- **Supervisor command center** (map, alerts, roster, dispatch, drills)
- **Admin governance layer** (analytics, compliance, incident review, planning)

---

## What Is Implemented

- Role-based route protection for Worker, Supervisor, and Admin dashboards
- Worker state-machine style flow (`DASHBOARD -> PRE_ENTRY -> CAMERA -> IN_MANHOLE -> EXITED`)
- Offline report queue and reconnect sync flow on worker device
- 1-second backend sensor tick loop with threshold-based auto alerts
- Explainable Hindi safety advisories with TTS support
- Supervisor AI Smart Assign recommendations and assignment what-if simulation
- Incident RCA assistant with bilingual report generation and similar-incident context
- Admin ward-level AI intelligence and plan optimization co-pilot
- **Emergency Evacuation Drill enhancements**:
  - drill history persistence (`backend/data/evacuationDrillHistory.json`)
  - pass/fail result badge logic
  - drill trend aggregation endpoint
  - supervisor UI badges and trends rendering

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + Vite 7 |
| Routing | react-router-dom v7 |
| Real-time | Socket.IO v4 (client + server) |
| Maps | Leaflet + react-leaflet v5 |
| Charts | Recharts v3 |
| Icons | lucide-react |
| Backend runtime | Node.js |
| Backend framework | Express 4 |
| AI SDK | @google/generative-ai |
| Dev server | nodemon |

---

## Project Structure

```text
SafeWorkers/
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   └── ThemeContext.jsx
│       ├── hooks/
│       │   └── useSocket.js
│       ├── components/
│       └── pages/
│           ├── Login.jsx
│           ├── admin/AdminDashboard.jsx
│           ├── supervisor/SupervisorDashboard.jsx
│           └── worker/
│               ├── WorkerDashboard.jsx
│               └── SafetyDiary.jsx
└── backend/
    ├── server.js
    ├── routes/
    │   ├── workers.js
    │   ├── jobs.js
    │   └── alerts.js
    ├── advisory/evaluateRisk.js
    ├── controllers/
    │   ├── safetyProfile.js
    │   ├── recommend.js
    │   ├── counterfactual.js
    │   ├── planCopilot.js
    │   ├── wardIntelligence.js
    │   ├── incidentPostmortem.js
    │   ├── rcaAssistant.js
    │   └── evacuationDrill.js
    ├── sensors/
    │   ├── thresholds.js
    │   ├── simulator.js
    │   └── engine.js
    ├── utils/evaluatePlan.js
    └── data/
        ├── seed.js
        ├── safetyDiary.js
        └── evacuationDrillHistory.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1) Start backend

```bash
cd backend
npm install
npm run dev
# http://localhost:3001
```

### 2) Start frontend

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

### 3) Optional AI setup

Set `GEMINI_API_KEY` in `backend/.env` to enable AI endpoints. Without it, multiple controllers return deterministic fallback outputs.

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

- Job context card (zone, risk, depth, weather)
- Pre-entry gate with PPE capture + gas check confirmation
- Live gas gauges (H2S, CO, O2, CH4, WATER)
- 30-minute in-manhole timer with auto-SOS at timeout
- Manual SOS with 1.5s long-press safety gesture
- Hazard reporting (Gas Cloud, Water Flood, Broken Wall, Other)
- Offline report queue + reconnect sync notification
- Safety Co-Pilot advisory card (local + backend enriched)
- Hindi TTS playback for critical advisories
- Safety Diary tab with score, badges, streaks, weekly coach

### Supervisor Dashboard

- Live map with worker markers and status colors
- Real-time alert stream (`SOS`, `AUTO_GAS`, `DRILL_SOS`, `DRILL_COMPLETE`, etc.)
- SOS modal and acknowledgement workflow
- PPE approval queue (authorize or deny)
- Roster with fatigue, battery, and signal indicators
- Dispatch board (drag/drop workers and jobs)
- AI Smart Assign recommendations
- Counterfactual assignment simulation (`/api/recommendations/simulate`)
- RCA assistant modal (`/api/incident/rca-assistant`)
- One-click emergency evacuation drill mode
- Drill completion with supervisor response timing
- Drill history with PASS/FAIL badges and trend cards

### Admin Dashboard

- KPI cards (entries, incident rate, near-misses, compliance)
- Zone analytics (bar chart), weekly trends (line chart), ward heatmap
- Audit log search/filter/export (CSV)
- Worker health monitoring panel
- NaMaSTE compliance matrix and outreach actions
- Incident review with contextual details and postmortem feed
- Sanipreneur leaderboard with subsidy/JLG workflow
- AI ward intelligence (`/api/ai/ward-intelligence`)
- Route planning safety check (`/api/plan/evaluate`)
- AI plan optimization panel (`/api/plan/copilot`)

---

## AI & Innovation Features

### Safety Co-Pilot

Pipeline:

1. Worker computes local advisory instantly (`computeLocalAdvisory`).
2. Worker emits `request_advisory` for backend evaluation.
3. Backend evaluates risk in `backend/advisory/evaluateRisk.js`.
4. Worker receives `live_safety_advisory` with explainability and Hindi guidance.

Risk sources include depth, recent incidents, weather, and live gas thresholds.

### AI Smart Assign + Counterfactual Simulation

- Supervisor requests assignment recommendations (`POST /api/recommendations`)
- Response considers worker status, fatigue, battery/signal, job risk/priority, and proximity
- Counterfactual endpoint simulates assignment impact before dispatch

### RCA Assistant + Auto Incident Postmortem

- Incident alerts can be expanded into guided RCA interviews
- Backend correlates similar incidents and generates structured bilingual reports
- Auto postmortem events are emitted via socket for admin/supervisor visibility

### AI Ward Intelligence

- Admin triggers ward-level analysis with evidence snapshot
- Backend computes risk index + recommendation narrative
- Frontend renders typed analysis and optional Hindi TTS playback

### Safe Route & Team Planning + Plan Co-Pilot

- Plan safety validator detects overload/fatigue/workload violations
- Local fallback logic runs if backend plan-check is unavailable
- AI plan co-pilot proposes prioritized corrective deployment actions

### Emergency Evacuation Drill Mode

- Start drill (`POST /api/drills/evacuation-run`)
- Complete drill with response time (`POST /api/drills/evacuation-complete`)
- Persisted history (`backend/data/evacuationDrillHistory.json`)
- Drill result badge (`PASS`/`FAIL`) with reason
- Trend metrics (`GET /api/drills/evacuation-trends`) surfaced in supervisor UI

---

## Backend API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/workers` | List workers |
| GET | `/api/workers/:id` | Get one worker |
| GET | `/api/workers/gas-check` | One-shot pre-entry gas readings |
| GET | `/api/jobs` | List jobs |
| GET | `/api/jobs/:id` | Get one job |
| GET | `/api/alerts` | Alert history |
| GET | `/api/safety-profile/:workerId` | Worker safety diary profile |
| POST | `/api/advisory/weather-alert` | Broadcast weather advisory |
| POST | `/api/plan/evaluate` | Evaluate deployment plan safety |
| POST | `/api/plan/copilot` | Generate AI plan optimization |
| POST | `/api/recommendations` | Generate AI assignment recommendations |
| POST | `/api/recommendations/simulate` | Run assignment what-if simulation |
| GET | `/api/drills/evacuation-history` | Drill history + trend payload |
| GET | `/api/drills/evacuation-trends` | Drill trends only |
| POST | `/api/drills/evacuation-run` | Start evacuation drill simulation |
| POST | `/api/drills/evacuation-complete` | Complete drill and score response |
| POST | `/api/incident/rca-assistant` | Generate RCA assistant report |
| POST | `/api/ai/ward-intelligence` | Generate ward-level AI analysis |

---

## Real-Time Socket Events

| Direction | Event | Description |
|---|---|---|
| Client -> Server | `worker_enter_manhole` | Mark worker in manhole / start telemetry context |
| Client -> Server | `worker_exit_manhole` | Mark worker exited / reset simulation state |
| Client -> Server | `sos_manual` | Worker manual SOS trigger |
| Client -> Server | `hazard_report` | Worker hazard event |
| Client -> Server | `request_advisory` | Request backend advisory |
| Client -> Server | `get_safety_profile` | Request diary profile |
| Client -> Server | `evac_command` | Supervisor evacuation command |
| Client -> Server | `worker_offline_reports_synced` | Worker reports offline queue sync summary |
| Server -> Client | `sensor_update` | 1-second live sensor update payload |
| Server -> Client | `auto_alert` | Alert broadcast (gas/SOS/drill/offline sync/etc.) |
| Server -> Client | `live_safety_advisory` | Explainable safety advisory |
| Server -> Client | `safety_profile` | Safety diary response payload |
| Server -> Client | `worker_status_change` | Worker status broadcast |
| Server -> Client | `evac_command` | Evacuation command delivery |
| Server -> Client | `auto_incident_postmortem` | Structured postmortem broadcast |

---

## Data & Persistence

- **In-memory demo data**: workers, jobs, alert list, incident history
- **Persistent drill storage**: `backend/data/evacuationDrillHistory.json`
- **Frontend session**: `sessionStorage` key `samved_user`
- **Frontend theme**: `localStorage` key `theme`
- **Worker offline queue**: `localStorage` key `samved_offline_reports_v1`

---

SafeWorkers is currently optimized for demonstration and jury evaluation, with production-ready modular boundaries for scaling into a fully persistent municipal safety platform.