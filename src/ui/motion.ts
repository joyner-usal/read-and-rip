import { useEffect, useState } from 'react';
import type { MotionSetting } from '../storage/schema';

/** True when motion should be reduced: the in-app setting wins, otherwise the system setting. */
export function useReducedMotion(setting: MotionSetting): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [system, setSystem] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setSystem(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return setting === 'on' ? true : setting === 'off' ? false : system;
}
