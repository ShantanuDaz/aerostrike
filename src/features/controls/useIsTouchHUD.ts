import { useEffect, useState } from 'react';

export function getIsTouchHUD(): boolean {
  if (typeof window === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  return coarsePointer || (hasTouch && window.innerWidth < 1024);
}

export function useIsTouchHUD(): boolean {
  const [isTouchHUD, setIsTouchHUD] = useState(getIsTouchHUD);

  useEffect(() => {
    const mq = window.matchMedia?.('(pointer: coarse)');
    const sync = () => setIsTouchHUD(getIsTouchHUD());
    window.addEventListener('resize', sync);
    mq?.addEventListener?.('change', sync);
    return () => {
      window.removeEventListener('resize', sync);
      mq?.removeEventListener?.('change', sync);
    };
  }, []);

  return isTouchHUD;
}
