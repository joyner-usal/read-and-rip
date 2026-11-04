# Read and Rip: notes for Claude

Read `BUILD.md` (decisions and status) and `SPEC.md` (how the game works) first.

## Working with Marty

- Ask questions one at a time, in the interactive question prompt, and wait for the
  answer before the next one. Mark one option as recommended. (Marty, 2026-11-04)
- Log each answer in `BUILD.md` as the next D number, then update `SPEC.md` to match.
- Merge only when Marty says "Merge it".

## Rules

- No em dashes or double hyphens in any copy, docs or rules notes.
- The repo is public: never commit font files or secrets (D22, D24).
- Colors live only in `brand/tokens.css`; no hex values in components.
- No AI imagery. Art is drawn in code (canvas or SVG).
- New scenarios stay `draft`. Only Marty sets `approved` (D28).
- Before pushing, run `npm run check` (validator, typecheck, tests, build).
