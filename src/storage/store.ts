import {
  MAX_SESSIONS, STORAGE_KEY, STORAGE_VERSION,
  type SaveData, type SessionRecord, type BestKey
} from './schema';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function freshSave(now = new Date()): SaveData {
  return {
    version: STORAGE_VERSION,
    profile: { localId: newId(), accountId: null, createdAt: now.toISOString() },
    settings: { game: null, mode: 'shooter', reducedMotion: 'system', sound: true, haptics: true },
    sessions: [],
    bests: {}
  };
}

/** Reads and checks saved data. Anything unreadable or from an unknown version starts fresh. */
export function parseSave(raw: string | null): SaveData {
  if (!raw) return freshSave();
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== STORAGE_VERSION || !data.profile?.localId) return freshSave();
    const base = freshSave();
    return {
      version: STORAGE_VERSION,
      profile: data.profile,
      settings: { ...base.settings, ...data.settings },
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      bests: data.bests ?? {}
    };
  } catch {
    return freshSave();
  }
}

/** Storage can throw in private windows or when full. Never let that stop play. */
export function load(storage: Storage | undefined = globalThis.localStorage): SaveData {
  try {
    return parseSave(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return freshSave();
  }
}

export function save(data: SaveData, storage: Storage | undefined = globalThis.localStorage): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Adds a finished session, trims history, and updates the best score for that game and mode. */
export function addSession(data: SaveData, session: SessionRecord): SaveData {
  const sessions = [session, ...data.sessions].slice(0, MAX_SESSIONS);
  const key: BestKey = `${session.game}:${session.mode}`;
  const prev = data.bests[key];
  const bests = { ...data.bests };
  if (!prev || session.score > prev.score) {
    bests[key] = { score: session.score, sessionId: session.id, at: session.endedAt };
  }
  return { ...data, sessions, bests };
}
