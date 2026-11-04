import { useEffect, useRef } from 'react';
import type { Summary as SummaryData } from '../game/machine';
import type { Mode, Scenario } from '../scenarios/types';
import { zoneForMode } from '../game/copy';
import { ResultIcon } from '../ui/icons';

interface Props {
  summary: SummaryData;
  mode: Mode;
  practice: boolean;
  /** Best before this round, or null if none. */
  previousBest: number | null;
  /** True when this round set a new best (timed rounds only). */
  newBest: boolean;
  review: Scenario[];
  onAgain: () => void;
  onHome: () => void;
}

export function Summary({ summary, mode, practice, previousBest, newBest, review, onAgain, onHome }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="screen summary">
      <p className="eyebrow">{practice ? 'Practice' : 'Round over'}</p>
      <h1 className="title" ref={heading} tabIndex={-1}>
        {summary.score} {summary.score === 1 ? 'point' : 'points'}
      </h1>
      {newBest ? (
        <p className="summary__best summary__best--new">
          <ResultIcon outcome="best" size={24} /> New best{previousBest !== null ? `. Old best: ${previousBest}` : ''}
        </p>
      ) : practice ? (
        <p className="summary__best">Practice scores don't count toward your best.</p>
      ) : (
        previousBest !== null && <p className="summary__best">Your best: {previousBest}</p>
      )}

      <dl className="stats">
        <div><dt>Reps</dt><dd>{summary.reps}</dd></div>
        <div><dt>Best reads</dt><dd>{summary.best}</dd></div>
        <div><dt>Good reads</dt><dd>{summary.good}</dd></div>
        <div><dt>Speed bonuses</dt><dd>{summary.speedBonuses}</dd></div>
        {!practice && summary.topLevel !== null && <div><dt>Top level</dt><dd>{summary.topLevel}</dd></div>}
      </dl>

      {review.length > 0 && (
        <section className="review" aria-labelledby="review-h">
          <h2 id="review-h" className="section-title">Reads to review</h2>
          <ul className="review__list">
            {review.map(s => (
              <li key={s.id} className="review__item">
                <p className="review__zone">Best spot: {zoneForMode(s.bestZone, mode)}</p>
                <p className="review__note">{s.rulesNote}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="row">
        <button type="button" className="cta" onClick={onAgain}>{practice ? 'Practice again' : 'Play again'}</button>
        <button type="button" className="btn" onClick={onHome}>Change setup</button>
      </div>
    </main>
  );
}
