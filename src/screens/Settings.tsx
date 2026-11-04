import type { MotionSetting, Settings as S } from '../storage/schema';

interface Props {
  settings: S;
  onChange: (patch: Partial<S>) => void;
  onBack: () => void;
}

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function Settings({ settings, onChange, onBack }: Props) {
  return (
    <main className="screen settings">
      <p className="eyebrow">Read and Rip</p>
      <h1 className="title title--small">Settings</h1>

      <fieldset className="choice">
        <legend>Reduced motion</legend>
        {(['system', 'on', 'off'] as MotionSetting[]).map(v => (
          <button key={v} type="button" className="chip" aria-pressed={settings.reducedMotion === v} onClick={() => onChange({ reducedMotion: v })}>
            {v === 'system' ? 'Match device' : v === 'on' ? 'On' : 'Off'}
          </button>
        ))}
        <p className="hint">On shows each cue as still frames instead of motion.</p>
      </fieldset>

      <label className="toggle">
        <input type="checkbox" checked={settings.longerWindows} onChange={e => onChange({ longerWindows: e.target.checked })} />
        <span>
          <strong>Longer read windows</strong>
          <span className="hint">Every read lasts 1.5 times as long. Scores keep their own best.</span>
        </span>
      </label>

      <label className="toggle">
        <input type="checkbox" checked={settings.haptics} disabled={!canVibrate} onChange={e => onChange({ haptics: e.target.checked })} />
        <span>
          <strong>Vibrate on results</strong>
          <span className="hint">{canVibrate ? 'A short buzz after each rep.' : "This device or browser doesn't support vibration."}</span>
        </span>
      </label>

      <button type="button" className="cta" onClick={onBack}>Done</button>
    </main>
  );
}
