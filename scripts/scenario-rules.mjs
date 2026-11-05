// Checks a JSON Schema can't express. Shared by the CLI validator and the unit tests.
// Each check returns { errors: string[], warnings: string[] }.

export const SHOOTER_CUES = new Set(['goalie-off-angle', 'goalie-stick-high', 'goalie-stick-low', 'goalie-weight-shift', 'goalie-low-stance', 'goalie-early-drop']);
export const GOALIE_CUES = new Set(['hands-high', 'hands-low', 'hip-turn', 'shoulder-dip', 'release-sidearm', 'release-overhand', 'release-underhand', 'stick-fake', 'head-fake']);
export const DASHES = /[\u2013\u2014]|--/;
/** Words that may stop being true when a scenario is flipped left to right (D16). */
export const SIDE_WORDS = /\b(left|right|strong hand|weak hand|hash(es)?|wings?|near side|far side)\b/i;

/** True when a scenario gets a mirrored copy in play (D16 and its amendment). */
export const mirrored = s => s.mirror !== false && s.mirrorReady !== false;

/**
 * @param {object} s   a scenario that already passed the JSON Schema
 * @param {{ folder?: string, fileBase?: string, strict?: boolean }} ctx
 */
export function crossChecks(s, ctx = {}) {
  const errors = [];
  const warnings = [];
  if (ctx.folder !== undefined && ctx.folder !== s.game) errors.push(`game is "${s.game}" but the file is in scenarios/${ctx.folder}/`);
  if (ctx.fileBase !== undefined && ctx.fileBase !== s.id) errors.push(`file name should match id ("${s.id}.json")`);
  if (!s.id.startsWith(`${s.game}-${s.mode}-`)) errors.push(`id should start with "${s.game}-${s.mode}-"`);
  if (s.id.endsWith('-m')) errors.push('id must not end in "-m"; that suffix is for mirrored copies');
  if (s.goodZones.includes(s.bestZone)) errors.push('bestZone must not also be in goodZones');
  if (s.mode === 'shooter' && !SHOOTER_CUES.has(s.cueType)) errors.push(`cueType "${s.cueType}" reads the shooter; shooter mode reads the goalie`);
  if (s.mode === 'goalie' && !GOALIE_CUES.has(s.cueType)) errors.push(`cueType "${s.cueType}" reads the goalie; goalie mode reads the shooter`);

  // Fake timing fields must match the mode (D15).
  const goalieFake = s.fake && s.mode === 'goalie';
  const shooterFake = s.fake && s.mode === 'shooter';
  if (goalieFake && s.releaseMs === undefined) errors.push('a goalie fake needs releaseMs (when the real shot leaves the stick)');
  if (!goalieFake && s.releaseMs !== undefined) errors.push('releaseMs is only for goalie mode fakes');
  if (shooterFake && s.baitZone === undefined) errors.push('a shooter fake needs baitZone (the spot the goalie shows open)');
  if (shooterFake && s.closeMs === undefined) errors.push('a shooter fake needs closeMs (when the goalie closes the bait)');
  if (!shooterFake && s.baitZone !== undefined) errors.push('baitZone is only for shooter mode fakes');
  if (!shooterFake && s.closeMs !== undefined) errors.push('closeMs is only for shooter mode fakes');
  if (s.releaseMs !== undefined && s.releaseMs >= s.readWindowMs) errors.push('releaseMs must be inside readWindowMs');
  if (s.closeMs !== undefined && s.closeMs >= s.readWindowMs) errors.push('closeMs must be inside readWindowMs');
  if (s.baitZone !== undefined && (s.baitZone === s.bestZone || s.goodZones.includes(s.baitZone))) errors.push('baitZone must not be the best zone or a good zone');

  if (DASHES.test(s.rulesNote)) errors.push('rulesNote has an em dash, en dash, or "--"; rewrite the sentence');
  if (ctx.strict && s.status !== 'approved') errors.push('status is "draft" (strict mode)');

  // D16 amendment: sprites are never mirrored, so a goalie-mode mirror needs a lefty shooter.
  if (s.mode === 'goalie' && s.mirror !== false && s.mirrorReady !== false) {
    warnings.push('goalie-mode mirrors need left-handed shooter sprites; set "mirrorReady": false until they exist');
  }
  if (s.game === 'boys' && s.mode === 'goalie' && s.shooterHand === 'left') {
    warnings.push('the boys art has no left-handed shooter yet, so this scenario is held back in play');
  }

  const side = mirrored(s) && s.rulesNote.match(SIDE_WORDS);
  if (side) warnings.push(`rulesNote says "${side[0]}" and this scenario mirrors. Check the note still reads true flipped, or set "mirror": false`);
  return { errors, warnings };
}
