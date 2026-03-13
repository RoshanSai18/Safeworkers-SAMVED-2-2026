// Mock safety diary data for demo workers.
// workerId 1 (Ravi Kumar) has a rich history for the hackathon demo.
// All other worker IDs fall back to a thin starter profile.

const TODAY     = new Date();
const daysAgo   = (n) => new Date(TODAY - n * 86_400_000).toISOString().split('T')[0];

const diaryData = {

  /* ── Ravi Kumar (demo worker — rich history) ─────────────────── */
  1: {
    joinDate: '2023-04-10',
    lastIncidentDate: null,   // null = never had a serious incident
    completedChecklists: 11,
    completedJobs: [
      { id: 'MH-2041', date: daysAgo(1),  risk: 'HIGH',   duration: 38, zone: 'Zone B', ppeOk: true,  gasOk: true  },
      { id: 'MH-1874', date: daysAgo(3),  risk: 'MEDIUM', duration: 25, zone: 'Zone C', ppeOk: true,  gasOk: true  },
      { id: 'MH-2200', date: daysAgo(5),  risk: 'HIGH',   duration: 42, zone: 'Zone F', ppeOk: true,  gasOk: true  },
      { id: 'MH-0933', date: daysAgo(8),  risk: 'HIGH',   duration: 31, zone: 'Zone A', ppeOk: true,  gasOk: true  },
      { id: 'MH-1100', date: daysAgo(12), risk: 'LOW',    duration: 18, zone: 'Zone B', ppeOk: true,  gasOk: true  },
      { id: 'MH-3310', date: daysAgo(17), risk: 'MEDIUM', duration: 22, zone: 'Zone D', ppeOk: true,  gasOk: true  },
      { id: 'MH-4420', date: daysAgo(22), risk: 'HIGH',   duration: 35, zone: 'Zone C', ppeOk: true,  gasOk: true  },
      { id: 'MH-0521', date: daysAgo(28), risk: 'MEDIUM', duration: 29, zone: 'Zone B', ppeOk: true,  gasOk: true  },
    ],
    hazardReports: [
      { id: 'haz-r01', date: daysAgo(5),  type: 'Gas Cloud',   job: 'MH-2200' },
      { id: 'haz-r02', date: daysAgo(12), type: 'Water Flood', job: 'MH-1100' },
      { id: 'haz-r03', date: daysAgo(28), type: 'Broken Wall', job: 'MH-0521' },
    ],
  },

  /* ── Suresh Babu (id 2) ──────────────────────────────────────── */
  2: {
    joinDate: '2022-11-15',
    lastIncidentDate: null,
    completedChecklists: 14,
    completedJobs: [
      { id: 'MH-1874', date: daysAgo(2),  risk: 'MEDIUM', duration: 22, zone: 'Zone C', ppeOk: true, gasOk: true },
      { id: 'MH-0090', date: daysAgo(7),  risk: 'HIGH',   duration: 37, zone: 'Zone C', ppeOk: true, gasOk: true },
      { id: 'MH-4402', date: daysAgo(14), risk: 'LOW',    duration: 20, zone: 'Zone A', ppeOk: true, gasOk: true },
    ],
    hazardReports: [
      { id: 'haz-s01', date: daysAgo(7), type: 'Gas Cloud', job: 'MH-0090' },
    ],
  },

  /* ── Meena Devi (id 3) ───────────────────────────────────────── */
  3: {
    joinDate: '2024-01-20',
    lastIncidentDate: daysAgo(23),   // had an incident recently
    completedChecklists: 6,
    completedJobs: [
      { id: 'MH-0933', date: daysAgo(4),  risk: 'MEDIUM', duration: 28, zone: 'Zone A', ppeOk: true,  gasOk: false },
      { id: 'MH-4402', date: daysAgo(10), risk: 'LOW',    duration: 16, zone: 'Zone A', ppeOk: true,  gasOk: true  },
    ],
    hazardReports: [],
  },
};

// Default thin starter profile for workers not in the map
const DEFAULT_PROFILE = {
  joinDate: daysAgo(90),
  lastIncidentDate: null,
  completedChecklists: 0,
  completedJobs:  [],
  hazardReports:  [],
};

function getWorkerDiaryData(workerId) {
  return diaryData[workerId] ?? { ...DEFAULT_PROFILE };
}

module.exports = { getWorkerDiaryData };
