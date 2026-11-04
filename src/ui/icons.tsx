// Result icons: each result has its own shape (SPEC.md section 8). Drawn in code, currentColor.
import type { ReactElement } from 'react';
import type { Outcome } from '../game/scoring';

const paths: Record<Outcome, ReactElement> = {
  best: <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z" />,
  good: <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />,
  miss: <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />,
  timeout: (
    <g fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2.5" strokeLinecap="square" />
    </g>
  ),
  early: (
    <path d="M8 21v-9.5L6 9a1.6 1.6 0 0 1 2.4-2L10 9V4.5a1.5 1.5 0 0 1 3 0V10V3.5a1.5 1.5 0 0 1 3 0V10V5a1.5 1.5 0 0 1 3 0v10c0 3.3-2.5 6-6 6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  ),
  bait: <path d="M15 3v10a5 5 0 0 1-10 0v-2l3 2.5M15 3h4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
};

export function ResultIcon({ outcome, size = 32 }: { outcome: Outcome; size?: number }) {
  return (
    <svg className={`result-icon result-icon--${outcome}`} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {paths[outcome]}
    </svg>
  );
}
