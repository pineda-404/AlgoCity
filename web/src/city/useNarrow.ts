import { useEffect, useState } from 'react';

/** En pantallas angostas las escenas usan un lienzo más estrecho para que el texto se lea bien. */
export function useNarrow(max = 640): boolean {
  const q = `(max-width: ${max}px)`;
  const [n, setN] = useState(() => typeof window !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const f = () => setN(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return n;
}
