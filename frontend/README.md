# SAMVED — Safety and Monitoring System for Sanitation Workers

**SAMVED** is a real-time safety, monitoring, and emergency response system built for the Solapur Municipal Corporation (SMC) to protect sanitation workers from hazardous working conditions in manholes and sewer lines.

---

## How SAMVED Addresses the Problem

### 1. High Risk Due to Manual Exposure

- Worker dashboard has an **Enter/Exit Manhole gate** — logs every entry digitally and enforces the `maxEntries` limit per day
- Supervisor sees every worker's real-time location on the **Leaflet map** with live status badges
- Admin's **Audit Log** tab tracks all gate events with timestamps

### 2. Health and Life Safety Hazards

- **4-gas real-time monitoring**: H₂S (toxic), CO (toxic), O₂ (suffocation), CH₄ (explosive) — all with OSHA/NIOSH thresholds
- **GasGauge UI** pulses amber on warning, flashes red on danger, with audio chimes
- Worker gets a **full-screen evacuation overlay** instantly when gas goes critical
- **SOS button** lets the worker manually trigger an emergency from inside the manhole

### 3. Lack of Real-Time Monitoring and Emergency Response

- Backend **sensor engine** ticks every 1 second, broadcasting live readings via Socket.IO to all connected clients
- **Supervisor dashboard** receives auto-alerts with gas type, value, and worker name — no polling needed
- Supervisor can push an **Evacuate command** directly to the worker's device in one click
- **Admin dashboard** shows incident history with gas readings captured at the time of incident (e.g. INC-007)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Socket.IO Client, Leaflet |
| Backend | Node.js, Express, Socket.IO, nodemon |
| Real-time | WebSocket (Socket.IO) |
| Maps | Leaflet.js |

---

## Running the Project

**Backend** (Terminal 1):
```bash
cd backend
npm install
npm run dev
```

**Frontend** (Terminal 2):
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Login Credentials

| Role | Username | Password |
|---|---|---|
| Worker | `suresh.babu` | `worker2024` |
| Supervisor | `priya.sharma` | `super2024` |
| Admin | `arjun.das` | `admin2024` |
