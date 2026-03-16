// Mirror of SupervisorDashboard WORKERS_SEED — single source of truth for demo data
const workers = [
  { id: 1, name: 'Ravi Kumar',   badge: 'SW-041', status: 'SOS',        job: 'MH-2041', address: 'Rajiv Nagar, Lane 4',     entries: 3, maxEntries: 4, elapsed: 34, battery: 22, signal: 1, lat: 19.0760, lng: 72.8600 },
  { id: 2, name: 'Suresh Babu',  badge: 'SW-018', status: 'IN_MANHOLE', job: 'MH-1874', address: 'Gandhi Road, Block C',    entries: 2, maxEntries: 4, elapsed: 18, battery: 67, signal: 3, lat: 19.0880, lng: 72.8900 },
  { id: 3, name: 'Meena Devi',   badge: 'SW-029', status: 'DELAYED',    job: 'MH-0933', address: 'Nehru St, Sector 2',      entries: 4, maxEntries: 4, elapsed: 42, battery: 45, signal: 2, lat: 19.0700, lng: 72.8720 },
  { id: 4, name: 'Anwar Sheikh', badge: 'SW-055', status: 'IDLE',       job: '—',       address: 'Base Station',            entries: 1, maxEntries: 4, elapsed: 0,  battery: 89, signal: 4, lat: 19.0820, lng: 72.8550 },
  { id: 5, name: 'Kamla Singh',  badge: 'SW-007', status: 'IN_MANHOLE', job: 'MH-3310', address: 'Industrial Blvd, Unit 9', entries: 2, maxEntries: 4, elapsed: 9,  battery: 54, signal: 3, lat: 19.0950, lng: 72.8950 },
  { id: 6, name: 'Deepak Rao',   badge: 'SW-060', status: 'IDLE',       job: '—',       address: 'Base Station',            entries: 0, maxEntries: 4, elapsed: 0,  battery: 92, signal: 4, lat: 19.0640, lng: 72.8820 },
  { id: 7, name: 'Priti Gupta',  badge: 'SW-033', status: 'TRANSIT',    job: 'MH-4410', address: 'En route Lal Bazaar',     entries: 1, maxEntries: 4, elapsed: 0,  battery: 71, signal: 4, lat: 19.0760, lng: 72.9040 },
];

const jobs = [
  { id: 'MH-4420', address: 'Lal Bazaar, Gate 7',      zone: 'Zone C', risk: 'HIGH',   priority: 'Urgent', equipment: 'Breathing Apparatus, Gas Meter', depth: 4.8, recentIncidents: 2, weather: 'heavy_rain', lat: 19.0830, lng: 72.8810 },
  { id: 'MH-2215', address: 'Shivaji Colony, Main Rd', zone: 'Zone A', risk: 'MEDIUM', priority: 'Normal', equipment: 'Standard PPE, Safety Rope',      depth: 2.1, recentIncidents: 0, weather: 'clear',      lat: 19.0720, lng: 72.8630 },
  { id: 'MH-0078', address: 'Station Rd, Junction 3',  zone: 'Zone B', risk: 'LOW',    priority: 'Low',    equipment: 'Standard PPE',                   depth: 1.5, recentIncidents: 0, weather: 'clear',      lat: 19.0900, lng: 72.8700 },
  { id: 'MH-5501', address: 'Park Lane, Sector 9',     zone: 'Zone D', risk: 'MEDIUM', priority: 'Normal', equipment: 'Gas Meter, Standard PPE',         depth: 3.2, recentIncidents: 1, weather: 'cloudy',     lat: 19.0680, lng: 72.8920 },
];

module.exports = { workers, jobs };
