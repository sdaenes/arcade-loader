const LS_KEY = 'al_manual_sessions';
let sessionCounter = 0;

export function loadPlacementSessions() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(sessions) {
  localStorage.setItem(LS_KEY, JSON.stringify(sessions));
}

export function savePlacementSession(name, data) {
  const session = {
    id: `${Date.now()}-${sessionCounter++}`,
    name,
    savedAt: new Date().toISOString(),
    data,
  };
  const sessions = loadPlacementSessions();
  sessions.push(session);
  persist(sessions);
  return session;
}

export function deletePlacementSession(id) {
  persist(loadPlacementSessions().filter(s => s.id !== id));
}
