// Loads scenario JSON at build time. Production plays approved scenarios only (D21);
// dev, or a build with VITE_INCLUDE_DRAFTS=true, also plays drafts.
import type { Scenario } from './types';
import { withMirrors } from '../game/mirror';

const files = import.meta.glob<Scenario>('/scenarios/**/*.json', { eager: true, import: 'default' });

export const includeDrafts: boolean = import.meta.env.DEV || import.meta.env.VITE_INCLUDE_DRAFTS === 'true';

/** The boys art has right-handed shooters only, so boys goalie-mode lefties wait (D16 amendment). */
export const drawable = (s: Scenario) => !(s.game === 'boys' && s.mode === 'goalie' && s.shooterHand === 'left');

export function selectScenarios(all: Scenario[], drafts: boolean): Scenario[] {
  return withMirrors(all.filter(s => (drafts || s.status === 'approved') && drawable(s))).sort((a, b) => a.id.localeCompare(b.id));
}

export const allScenarios: Scenario[] = Object.values(files);
export const scenarios: Scenario[] = selectScenarios(allScenarios, includeDrafts);
export const scenarioById = new Map(scenarios.map(s => [s.id, s]));

/** Short hash of the scenario content, stamped on saved sessions. Set in vite.config.ts. */
export const contentVersion: string = __CONTENT_VERSION__;
