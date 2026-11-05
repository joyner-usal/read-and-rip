import { useCallback, useEffect, useMemo, useState } from 'react';
import { addSession, load, save } from './storage/store';
import { bestKey, type Settings as SettingsData, type SessionRecord } from './storage/schema';
import { contentVersion, includeDrafts, scenarioById, scenarios } from './scenarios/loader';
import { DEFAULTS, summarize, type GameConfig, type GameState } from './game/machine';
import type { Game as GameName, Mode, Scenario } from './scenarios/types';
import { useReducedMotion } from './ui/motion';
import { Start } from './screens/Start';
import { Game } from './screens/Game';
import { Summary } from './screens/Summary';
import { Settings } from './screens/Settings';
import { loadSprites, spritesReady, type SpriteImages } from './art/loader';

type Screen =
  | { name: 'start' }
  | { name: 'settings' }
  | { name: 'loading'; config: GameConfig; error: boolean }
  | { name: 'game'; config: GameConfig; key: number }
  | { name: 'summary'; config: GameConfig; final: GameState; previousBest: number | null; newBest: boolean };

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export default function App() {
  const [data, setData] = useState(load);
  const [screen, setScreen] = useState<Screen>({ name: 'start' });
  const reduced = useReducedMotion(data.settings.reducedMotion);
  const [sprites, setSprites] = useState<SpriteImages | null>(spritesReady);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    save(data);
  }, [data]);

  useEffect(() => {
    const pref = data.settings.reducedMotion;
    if (pref === 'system') delete document.documentElement.dataset.reducedMotion;
    else document.documentElement.dataset.reducedMotion = pref;
  }, [data.settings.reducedMotion]);

  const patchSettings = (p: Partial<SettingsData>) => setData(d => ({ ...d, settings: { ...d.settings, ...p } }));
  const { game, mode, longerWindows } = data.settings;
  const available = useMemo(() => (game ? scenarios.filter(s => s.game === game && s.mode === mode).length : 0), [game, mode]);

  // The boys field plays on the sprite set: start loading it as soon as Boys is picked.
  const preload = useCallback(() => {
    return loadSprites((done, total) => setProgress(done / total)).then(imgs => {
      setSprites(imgs);
      return imgs;
    });
  }, []);
  useEffect(() => {
    if (game === 'boys' && !sprites) preload().catch(() => undefined);
  }, [game, sprites, preload]);

  const startGame = (config: GameConfig) => {
    if (config.game === 'boys' && !spritesReady()) {
      setScreen({ name: 'loading', config, error: false });
      preload()
        .then(() => setScreen({ name: 'game', config, key: Date.now() }))
        .catch(() => setScreen({ name: 'loading', config, error: true }));
      return;
    }
    setScreen({ name: 'game', config, key: Date.now() });
  };

  const play = (practice: boolean) => {
    if (!game) return;
    startGame({ game, mode, practice, longerWindows, ...DEFAULTS });
  };

  const finish = useCallback(
    (final: GameState) => {
      const { config } = final;
      const key = bestKey(config.game, config.mode, config.longerWindows);
      const previousBest = data.bests[key]?.score ?? null;
      const counts = config.practice ? final.reps.length > 0 : final.endReason === 'clock';
      const newBest = counts && !config.practice && final.score > 0 && (previousBest === null || final.score > previousBest);
      if (counts) {
        const session: SessionRecord = {
          id: newId(),
          ownerId: data.profile.localId,
          game: config.game,
          mode: config.mode,
          startedAt: new Date(Date.now() - (performance.now() - final.startedAt)).toISOString(),
          endedAt: new Date().toISOString(),
          score: final.score,
          reps: final.reps.map(r => ({ scenarioId: r.scenarioId, tappedZone: r.tappedZone, outcome: r.outcome, responseMs: r.responseMs, points: r.points })),
          practice: config.practice,
          longerWindows: config.longerWindows,
          contentVersion,
          syncedAt: null
        };
        setData(d => addSession(d, session));
      }
      setScreen({ name: 'summary', config, final, previousBest, newBest });
    },
    [data.bests, data.profile.localId]
  );

  if (screen.name === 'game') {
    return (
      <div className="app app--game">
        <Game
          key={screen.key}
          config={screen.config}
          pool={scenarios}
          reducedMotion={reduced}
          haptics={data.settings.haptics}
          sprites={screen.config.game === 'boys' ? sprites : null}
          onDone={finish}
        />
      </div>
    );
  }
  if (screen.name === 'loading') {
    return (
      <div className="app">
        <main className="screen loading">
          <p className="eyebrow">Read and Rip</p>
          {screen.error ? (
            <>
              <h1 className="title title--small">Couldn't load the field</h1>
              <p className="lede">Check your connection and try again.</p>
              <button type="button" className="cta" onClick={() => startGame(screen.config)}>Try again</button>
              <button type="button" className="btn" onClick={() => setScreen({ name: 'start' })}>Back</button>
            </>
          ) : (
            <>
              <h1 className="title title--small">Loading the field</h1>
              <div className="loadbar" role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <div className="loadbar__fill" style={{ transform: `scaleX(${progress})` }} />
              </div>
            </>
          )}
        </main>
      </div>
    );
  }
  if (screen.name === 'summary') {
    const sum = summarize(screen.final);
    // A scenario and its mirror share a note: list each note once.
    const review = sum.toReview
      .map(id => scenarioById.get(id))
      .filter((s): s is Scenario => !!s)
      .filter((s, i, all) => all.findIndex(o => o.rulesNote === s.rulesNote) === i);
    return (
      <div className="app">
        <Summary
          summary={sum}
          mode={screen.config.mode}
          practice={screen.config.practice}
          previousBest={screen.previousBest}
          newBest={screen.newBest}
          review={review}
          onAgain={() => startGame(screen.config)}
          onHome={() => setScreen({ name: 'start' })}
        />
      </div>
    );
  }
  if (screen.name === 'settings') {
    return (
      <div className="app">
        <Settings settings={data.settings} onChange={patchSettings} onBack={() => setScreen({ name: 'start' })} />
      </div>
    );
  }
  return (
    <div className="app">
      <Start
        data={data}
        available={available}
        drafts={includeDrafts}
        onGame={(g: GameName) => patchSettings({ game: g })}
        onMode={(m: Mode) => patchSettings({ mode: m })}
        onPlay={play}
        onSettings={() => setScreen({ name: 'settings' })}
      />
    </div>
  );
}
