import { describe, expect, it } from 'vitest';
import { addSession, freshSave, parseSave } from './store';
import { MAX_SESSIONS, type SessionRecord } from './schema';

const session = (id: string, score: number): SessionRecord => ({
  id, ownerId: 'p1', game: 'boys', mode: 'shooter',
  startedAt: '2026-11-04T12:00:00.000Z', endedAt: '2026-11-04T12:00:30.000Z',
  score, reps: [], contentVersion: '0.0.0', syncedAt: null
});

describe('storage', () => {
  it('starts fresh on empty, corrupt, or unknown-version data', () => {
    expect(parseSave(null).sessions).toEqual([]);
    expect(parseSave('{not json').sessions).toEqual([]);
    expect(parseSave(JSON.stringify({ version: 99 })).profile.accountId).toBeNull();
  });

  it('round-trips and fills missing settings with defaults', () => {
    const s = freshSave();
    const raw = JSON.stringify({ ...s, settings: { game: 'girls' } });
    const back = parseSave(raw);
    expect(back.profile.localId).toBe(s.profile.localId);
    expect(back.settings.game).toBe('girls');
    expect(back.settings.reducedMotion).toBe('system');
  });

  it('keeps the best score per game and mode', () => {
    let d = freshSave();
    d = addSession(d, session('a', 12));
    d = addSession(d, session('b', 9));
    expect(d.bests['boys:shooter']?.score).toBe(12);
    d = addSession(d, session('c', 15));
    expect(d.bests['boys:shooter']?.sessionId).toBe('c');
  });

  it('caps session history', () => {
    let d = freshSave();
    for (let i = 0; i < MAX_SESSIONS + 5; i++) d = addSession(d, session(`s${i}`, i));
    expect(d.sessions).toHaveLength(MAX_SESSIONS);
    expect(d.sessions[0].id).toBe(`s${MAX_SESSIONS + 4}`);
  });
});
