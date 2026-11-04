#!/usr/bin/env node
// Validates every scenarios/**/*.json file against schemas/scenario.schema.json,
// then the rules in scenario-rules.mjs. Errors exit 1; warnings print but pass.
//
//   npm run validate               check all files
//   npm run validate -- --strict   also fail on drafts (use before a release)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { crossChecks } from './scenario-rules.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const schema = JSON.parse(readFileSync(join(root, 'schemas/scenario.schema.json'), 'utf8'));
const validate = new Ajv({ allErrors: true }).compile(schema);

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return name.endsWith('.json') ? [p] : [];
  });
}

const files = walk(join(root, 'scenarios'));
const seen = new Map();
let failed = 0;
let warned = 0;
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
  const errors = [];
  const warnings = [];
  if (!validate(data)) {
    for (const e of validate.errors) errors.push(`${e.instancePath || '(root)'} ${e.message}${e.params?.allowedValues ? `: ${e.params.allowedValues.join(', ')}` : ''}`);
  } else {
    const r = crossChecks(data, { folder: basename(dirname(file)), fileBase: basename(file, '.json'), strict });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    for (const id of [data.id, data.mirror === false ? null : `${data.id}-m`].filter(Boolean)) {
      if (seen.has(id)) errors.push(`duplicate id "${id}", also in ${seen.get(id)}`);
      seen.set(id, rel);
    }
    if (data.status === 'draft') drafts++;
  }
  if (errors.length) {
    failed++;
    console.error(`✗ ${rel}\n${errors.map(m => `    ${m}`).join('\n')}`);
  }
  if (warnings.length) {
    warned++;
    console.warn(`! ${rel}\n${warnings.map(m => `    warning: ${m}`).join('\n')}`);
  }
}

console.log(`${files.length} scenario file(s), ${files.length - failed} valid, ${failed} with errors, ${warned} with warnings, ${drafts} draft(s).`);
process.exit(failed ? 1 : 0);
