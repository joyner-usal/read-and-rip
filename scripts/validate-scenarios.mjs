#!/usr/bin/env node
// Validates every scenarios/**/*.json file against schemas/scenario.schema.json,
// then checks the rules a JSON Schema cannot express. Exits 1 on any error.
//
//   npm run validate            check all files
//   npm run validate -- --strict  also fail on drafts (use before a release)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const schema = JSON.parse(readFileSync(join(root, 'schemas/scenario.schema.json'), 'utf8'));
const validate = new Ajv({ allErrors: true }).compile(schema);

const SHOOTER_CUES = new Set(['goalie-off-angle', 'goalie-stick-high', 'goalie-stick-low', 'goalie-weight-shift', 'goalie-low-stance', 'goalie-early-drop']);
const GOALIE_CUES = new Set(['hands-high', 'hands-low', 'hip-turn', 'shoulder-dip', 'release-sidearm', 'release-overhand', 'release-underhand', 'stick-fake', 'head-fake']);
const DASHES = /[\u2013\u2014]|--/;

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return name.endsWith('.json') ? [p] : [];
  });
}

/** Checks a JSON Schema cannot express. Returns a list of messages. */
export function crossChecks(s, file) {
  const errs = [];
  const folder = basename(dirname(file));
  if (folder !== s.game) errs.push(`game is "${s.game}" but the file is in scenarios/${folder}/`);
  if (basename(file, '.json') !== s.id) errs.push(`file name should match id ("${s.id}.json")`);
  if (!s.id.startsWith(`${s.game}-${s.mode}-`)) errs.push(`id should start with "${s.game}-${s.mode}-"`);
  if (s.goodZones.includes(s.bestZone)) errs.push('bestZone must not also be in goodZones');
  if (s.mode === 'shooter' && !SHOOTER_CUES.has(s.cueType)) errs.push(`cueType "${s.cueType}" reads the shooter; shooter mode reads the goalie`);
  if (s.mode === 'goalie' && !GOALIE_CUES.has(s.cueType)) errs.push(`cueType "${s.cueType}" reads the goalie; goalie mode reads the shooter`);
  if (s.fake && s.mode !== 'goalie') errs.push('fake is only used in goalie mode in v1 (BUILD.md, open question)');
  if (s.fake && s.releaseMs === undefined) errs.push('a fake needs releaseMs (when the real shot leaves the stick)');
  if (!s.fake && s.releaseMs !== undefined) errs.push('releaseMs is only for fakes');
  if (s.releaseMs !== undefined && s.releaseMs >= s.readWindowMs) errs.push('releaseMs must be inside readWindowMs');
  if (DASHES.test(s.rulesNote)) errs.push('rulesNote has an em dash, en dash, or "--"; rewrite the sentence');
  if (strict && s.status !== 'approved') errs.push('status is "draft" (strict mode)');
  return errs;
}

const files = walk(join(root, 'scenarios'));
const seen = new Map();
let failed = 0;
let drafts = 0;

for (const file of files) {
  const rel = relative(root, file);
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`✗ ${rel}\n    not valid JSON: ${e.message}`);
    failed++;
    continue;
  }
  const errs = [];
  if (!validate(data)) {
    for (const e of validate.errors) errs.push(`${e.instancePath || '(root)'} ${e.message}${e.params?.allowedValues ? `: ${e.params.allowedValues.join(', ')}` : ''}`);
  } else {
    errs.push(...crossChecks(data, file));
    if (seen.has(data.id)) errs.push(`duplicate id, also in ${seen.get(data.id)}`);
    seen.set(data.id, rel);
    if (data.status === 'draft') drafts++;
  }
  if (errs.length) {
    failed++;
    console.error(`✗ ${rel}\n${errs.map(m => `    ${m}`).join('\n')}`);
  }
}

console.log(`${files.length} scenario file(s), ${files.length - failed} valid, ${failed} with errors, ${drafts} draft(s).`);
process.exit(failed ? 1 : 0);
