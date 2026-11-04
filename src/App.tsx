import { useEffect, useState } from 'react';
import { FieldView, zoneLabel } from './field/FieldView';
import { load, save } from './storage/store';
import type { Game, Mode, Zone } from './scenarios/types';
import { Logo } from './ui/Logo';

// Phase 0 shell: pick a pack and a mode, preview the field view.
// No gameplay, clock, or scoring yet (see BUILD.md, Phase 1).
export default function App() {
  const [data, setData] = useState(load);
  const [preview, setPreview] = useState<Zone | null>(null);
  const { game, mode } = data.settings;

  useEffect(() => { save(data); }, [data]);

  useEffect(() => {
    const pref = data.settings.reducedMotion;
    if (pref === 'system') delete document.documentElement.dataset.reducedMotion;
    else document.documentElement.dataset.reducedMotion = pref;
  }, [data.settings.reducedMotion]);

  const setGame = (g: Game) => setData(d => ({ ...d, settings: { ...d.settings, game: g } }));
  const setMode = (m: Mode) => setData(d => ({ ...d, settings: { ...d.settings, mode: m } }));

  return (
    <div className="app">
      <header className="top">
        <Logo />
      </header>

      <main className="start">
        <p className="eyebrow">USA Lacrosse</p>
        <h1 className="title">Read and Rip</h1>
        <p className="lede">
          {mode === 'shooter'
            ? 'Read the goalie. Pick the spot before the clock runs out.'
            : 'Read the shooter. Pick the save before the ball leaves the stick.'}
        </p>

        <fieldset className="choice">
          <legend>Field</legend>
          {(['boys', 'girls'] as const).map(g => (
            <button key={g} type="button" className="chip" aria-pressed={game === g} onClick={() => setGame(g)}>
              {g === 'boys' ? 'Boys' : 'Girls'}
            </button>
          ))}
        </fieldset>

        <fieldset className="choice">
          <legend>Play as</legend>
          {(['shooter', 'goalie'] as const).map(m => (
            <button key={m} type="button" className="chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === 'shooter' ? 'Shooter' : 'Goalie'}
            </button>
          ))}
        </fieldset>

        <FieldView approachAngleDeg={0} shooterHand="right" selected={preview} onPick={setPreview} />
        <p className="status" role="status" aria-live="polite">
          {preview ? `Preview: ${zoneLabel(preview)}` : 'Tap the goal to try the grid.'}
        </p>

        <button type="button" className="cta" disabled>
          Start
        </button>
        <p className="note">Gameplay arrives in Phase 1.</p>
      </main>
    </div>
  );
}
