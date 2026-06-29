import {
  loadSessions,
  saveSession,
  deleteSession,
  exportSessionsJSON,
  importSessionsJSON,
} from '../sessions';

const MOCK_DATA = {
  cabinets: [{ id: 'c1', name: 'Test', width: 0.65, height: 1.75, depth: 0.75, quantity: 1, canTilt: false, color: '#fff' }],
  trucks: [{ id: 't1', name: 'Camion', width: 2.4, height: 2.5, depth: 7.0 }],
  errorMargin: 5,
  manualPlacements: {},
};

beforeEach(() => {
  localStorage.clear();
});

test('loadSessions returns empty array when nothing saved', () => {
  expect(loadSessions()).toEqual([]);
});

test('saveSession persists a session and returns it', () => {
  const session = saveSession('Ma session', MOCK_DATA);
  expect(session.name).toBe('Ma session');
  expect(session.id).toBeDefined();
  expect(session.savedAt).toBeDefined();
  expect(session.data).toEqual(MOCK_DATA);

  const sessions = loadSessions();
  expect(sessions).toHaveLength(1);
  expect(sessions[0].name).toBe('Ma session');
});

test('saveSession appends to existing sessions', () => {
  saveSession('Session A', MOCK_DATA);
  saveSession('Session B', MOCK_DATA);
  expect(loadSessions()).toHaveLength(2);
});

test('deleteSession removes the correct session', () => {
  const s1 = saveSession('A', MOCK_DATA);
  const s2 = saveSession('B', MOCK_DATA);
  deleteSession(s1.id);
  const remaining = loadSessions();
  expect(remaining).toHaveLength(1);
  expect(remaining[0].id).toBe(s2.id);
});

test('deleteSession with unknown id does nothing', () => {
  saveSession('A', MOCK_DATA);
  deleteSession('nonexistent-id');
  expect(loadSessions()).toHaveLength(1);
});

test('exportSessionsJSON returns valid JSON array', () => {
  saveSession('Export test', MOCK_DATA);
  const json = exportSessionsJSON();
  const parsed = JSON.parse(json);
  expect(Array.isArray(parsed)).toBe(true);
  expect(parsed[0].name).toBe('Export test');
});

test('importSessionsJSON merges sessions without duplicates', () => {
  const s1 = saveSession('Existing', MOCK_DATA);
  const toImport = JSON.stringify([
    { id: s1.id, name: 'Existing', savedAt: s1.savedAt, data: MOCK_DATA },
    { id: 'new-id-999', name: 'Nouveau', savedAt: new Date().toISOString(), data: MOCK_DATA },
  ]);
  const result = importSessionsJSON(toImport);
  expect(result.imported).toBe(1);
  expect(result.skipped).toBe(1);
  expect(loadSessions()).toHaveLength(2);
});

test('importSessionsJSON returns 0/0 for empty array', () => {
  const result = importSessionsJSON('[]');
  expect(result.imported).toBe(0);
  expect(result.skipped).toBe(0);
});

test('importSessionsJSON throws on invalid JSON', () => {
  expect(() => importSessionsJSON('not-json')).toThrow();
});
