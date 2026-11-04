import type { Game, Mode } from '../scenarios/types';
import type { SaveData } from '../storage/schema';
import { bestKey } from '../storage/schema';
import { Logo } from '../ui/Logo';

interface Props {
  data: SaveData;
  available: number;
  drafts: boolean;
  onGame: (g: Game) => void;
  onMode: (m: Mode) => void;
  onPlay: (practice: boolean) => void;
  onSettings: () => void;
}

export function Start({ data, available, drafts, onGame, onMode, onPlay, onSettings }: Props) {
  const { game, mode, longerWindows } = data.settings;
  const best = game ? data.bests[bestKey(game, mode, longerWindows)] : undefined;
  const ready = game !== null && available > 0;
  return (
    <>
      <header className="top">
        <Logo />
        <button type="button" className="top__btn" onClick={onSettings}>Settings</button>
      </header>
      {drafts && (
        <p className="banner" role="note">
          <strong>Draft content.</strong> These scenarios haven't been reviewed by coaches yet.
        </p>
      )}
      <main className="screen start">
        <p className="eyebrow">USA Lacrosse</p>
        <h1 className="title">Read and Rip</h1>
        <p className="lede">
          {mode === 'shooter'
            ? 'Read the goalie. Pick the spot before the clock runs out.'
            : 'Read the shooter. Pick the save before the ball gets there.'}
        </p>

        <fieldset className="choice">
          <legend>Field</legend>
          {(['boys', 'girls'] as const).map(g => (
            <button key={g} type="button" className="chip" aria-pressed={game === g} onClick={() => onGame(g)}>
              {g === 'boys' ? 'Boys' : 'Girls'}
            </button>
          ))}
        </fieldset>

        <fieldset className="choice">
          <legend>Play as</legend>
          {(['shooter', 'goalie'] as const).map(m => (
            <button key={m} type="button" className="chip" aria-pressed={mode === m} onClick={() => onMode(m)}>
              {m === 'shooter' ? 'Shooter' : 'Goalie'}
            </button>
          ))}
        </fieldset>

        {game === null ? (
          <p className="hint">Pick a field to start.</p>
        ) : available === 0 ? (
          <p className="empty" role="status">No approved scenarios yet for this field and position. Check back soon.</p>
        ) : (
          <p className="hint">
            30 seconds on the clock. {best ? `Your best: ${best.score}.` : 'No best yet.'}
            {longerWindows ? ' Longer read windows are on.' : ''}
          </p>
        )}

        <button type="button" className="cta" disabled={!ready} onClick={() => onPlay(false)}>Play</button>
        <button type="button" className="btn" disabled={!ready} onClick={() => onPlay(true)}>Practice (no clock)</button>
      </main>
    </>
  );
}
