const LS_KEY = 'al_sessions';
let sessionCounter = 0;

export function loadSessions() {
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

export function saveSession(name, data) {
  const session = {
    id: `${Date.now()}-${sessionCounter++}`,
    name,
    savedAt: new Date().toISOString(),
    data,
  };
  const sessions = loadSessions();
  sessions.push(session);
  persist(sessions);
  return session;
}

export function deleteSession(id) {
  const sessions = loadSessions().filter(s => s.id !== id);
  persist(sessions);
}

export function exportSessionsJSON() {
  return JSON.stringify(loadSessions(), null, 2);
}

export function importSessionsJSON(jsonString) {
  const incoming = JSON.parse(jsonString);
  if (!Array.isArray(incoming)) throw new Error('Not an array');
  const existing = loadSessions();
  const existingIds = new Set(existing.map(s => s.id));
  let imported = 0;
  let skipped = 0;
  for (const s of incoming) {
    if (!s || typeof s.id !== 'string') { skipped++; continue; }
    if (existingIds.has(s.id)) {
      skipped++;
    } else {
      existing.push(s);
      existingIds.add(s.id);
      imported++;
    }
  }
  persist(existing);
  return { imported, skipped };
}
