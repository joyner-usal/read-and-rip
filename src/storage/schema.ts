// Device-only storage for v1. Shaped so a future account system can sync it:
// every record has a stable id, an owner, timestamps, and a syncedAt field.
import type { Game, Mode } from '../scenarios/types';

export const STORAGE_KEY = 'readandrip:v1';
export const STORAGE_VERSION = 1;
export const MAX_SESSIONS = 50;

export type MotionSetting = 'system' | 'on' | 'off';

export interface Profile {
  /** Random id made on first launch. Becomes the local alias once accounts exist. */
  localId: string;
  /** Null in v1. Filled when the player links an account. */
  accountId: string | null;
  createdAt: string;
}

export interface Settings {
  game: Game | null;
  mode: Mode;
  reducedMotion: MotionSetting;
  sound: boolean;
  haptics: boolean;
}

export interface RepResult {
  scenarioId: string;
  tappedZone: string | null;
  outcome: 'best' | 'good' | 'miss' | 'early' | 'timeout';
  responseMs: number | null;
  points: number;
}

export interface SessionRecord {
  id: string;
  ownerId: string;
  game: Game;
  mode: Mode;
  startedAt: string;
  endedAt: string;
  score: number;
  reps: RepResult[];
  /** Scenario content version, so old scores stay comparable. */
  contentVersion: string;
  /** Null until uploaded to an account. */
  syncedAt: string | null;
}

export type BestKey = `${Game}:${Mode}`;

export interface BestScore {
  score: number;
  sessionId: string;
  at: string;
}

export interface SaveData {
  version: typeof STORAGE_VERSION;
  profile: Profile;
  settings: Settings;
  sessions: SessionRecord[];
  bests: Partial<Record<BestKey, BestScore>>;
}
