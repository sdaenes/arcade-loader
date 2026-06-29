import {
  loadPlacementSessions,
  savePlacementSession,
  deletePlacementSession,
} from '../placementSessions';

const MOCK_DATA = {
  truck1: [{ id: 'mp_1', cabId: 'c1', name: 'Borne', color: '#00f5ff', x: 0.2, z: 0.5, width: 0.65, height: 1.75, depth: 0.75, rotation: 0 }],
  truck2: [],
};

beforeEach(() => { localStorage.clear(); });

test('loadPlacementSessions returns empty array when nothing saved', () => {
  expect(loadPlacementSessions()).toEqual([]);
});

test('savePlacementSession persists and returns the session', () => {
  const s = savePlacementSession('Plan Lyon', MOCK_DATA);
  expect(s.name).toBe('Plan Lyon');
  expect(s.id).toBeDefined();
  expect(s.savedAt).toBeDefined();
  expect(s.data).toEqual(MOCK_DATA);
  const sessions = loadPlacementSessions();
  expect(sessions).toHaveLength(1);
  expect(sessions[0].name).toBe('Plan Lyon');
});

test('savePlacementSession appends to existing sessions', () => {
  savePlacementSession('A', MOCK_DATA);
  savePlacementSession('B', MOCK_DATA);
  expect(loadPlacementSessions()).toHaveLength(2);
});

test('deletePlacementSession removes the correct session', () => {
  const s1 = savePlacementSession('A', MOCK_DATA);
  const s2 = savePlacementSession('B', MOCK_DATA);
  deletePlacementSession(s1.id);
  const remaining = loadPlacementSessions();
  expect(remaining).toHaveLength(1);
  expect(remaining[0].id).toBe(s2.id);
});

test('deletePlacementSession with unknown id does nothing', () => {
  savePlacementSession('A', MOCK_DATA);
  deletePlacementSession('nonexistent');
  expect(loadPlacementSessions()).toHaveLength(1);
});
