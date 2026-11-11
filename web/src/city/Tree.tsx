import type { BstState } from '@shared/engines';
import { Fuegos } from './Buildings';
import { useNarrow } from './useNarrow';

/** Árbol binario de búsqueda como sistema de avenidas: cada cruce es una plaza con su valor. */
export function Tree({ s, jam, done, ariaLabel }: { s: BstState; jam: boolean; done: boolean; ariaLabel: string }) {
  const narrow = useNarrow();
  const W = narrow ? 620 : 1000;
  const pos = new Map<number, { x: number; y: number; d: number }>();
  const orden: number[] = [];
  let maxD = 0;
  const walk = (i: number | null, d: number) => {
    if (i === null) return;
    walk(s.nodes[i].l, d + 1);
    orden.push(i);
    pos.set(i, { x: 0, y: 0, d });
    maxD = Math.max(maxD, d);
    walk(s.nodes[i].r, d + 1);
  };
  walk(s.root, 0);
  const n = orden.length;
  orden.forEach((i, rank) => {
    const p = pos.get(i)!;
    p.x = n === 1 ? W / 2 : 40 + (rank * (W - 80)) / (n - 1);
  });
  const nivel = 88;
  const top = 120;
  const H = Math.max(440, top + (maxD + 1) * nivel + 60);
  pos.forEach((p) => (p.y = top + p.d * nivel));
  const cursor = s.cursor;
  const llega = s.done ? null : s.queue[s.k];
  const pendientes = s.queue.slice(s.k + 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <rect width={W} height={H} fill="var(--cielo)" />
      <text x={24} y={34} fontFamily="var(--f-senal)" fontWeight="800" fontSize="18" fill="var(--fg)">Por construir:</text>
      {llega !== null && (
        <g>
          <rect x={150} y={12} width={64} height={34} rx={8} fill="var(--ambar)" />
          <text x={182} y={36} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="800" fontSize="20" fill="#1d2430">{llega}</text>
        </g>
      )}
      {pendientes.map((v, k) => (
        <g key={k}>
          <rect x={226 + k * (narrow ? 52 : 58)} y={14} width={50} height={30} rx={6} fill="var(--tarjeta)" stroke="var(--linea)" strokeWidth={2} />
          <text x={251 + k * (narrow ? 52 : 58)} y={35} textAnchor="middle" fontFamily="var(--f-codigo)" fontSize="16" fill="var(--fg)">{v}</text>
        </g>
      ))}
      {s.done && <text x={150} y={36} fontFamily="var(--f-senal)" fontWeight="700" fontSize="18" fill="var(--verde)">nada, ¡todo construido!</text>}

      {/* Avenidas */}
      {s.nodes.map((nd, i) =>
        [nd.l, nd.r].map((h, k) => {
          if (h === null) return null;
          const a = pos.get(i)!, b = pos.get(h)!;
          return (
            <g key={`${i}-${k}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--asfalto)" strokeWidth={16} strokeLinecap="round" />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--ambar)" strokeWidth={2} strokeDasharray="10 10" />
            </g>
          );
        }),
      )}

      {/* Lotes vacíos junto al cruce actual (no revelan cuál es el correcto) */}
      {cursor !== null && !s.done && (['l', 'r'] as const).map((lado) => {
        if (s.nodes[cursor][lado] !== null) return null;
        const p = pos.get(cursor)!;
        const dx = Math.max(40, 160 / (p.d + 1));
        const x = Math.max(24, Math.min(W - 24, p.x + (lado === 'l' ? -dx : dx)));
        return (
          <g key={lado}>
            <line x1={p.x} y1={p.y} x2={x} y2={p.y + nivel * 0.8} stroke="var(--linea)" strokeWidth={6} strokeDasharray="6 8" />
            <circle cx={x} cy={p.y + nivel * 0.8} r={18} fill="none" stroke="var(--tenue)" strokeWidth={2} strokeDasharray="5 5" />
          </g>
        );
      })}

      {[...pos.entries()].map(([i, p]) => {
        const actual = i === cursor && !s.done;
        return (
          <g key={i} className={jam && actual ? 'atasco' : undefined}>
            <circle cx={p.x} cy={p.y} r={narrow && n > 6 ? 22 : 27} fill={actual ? 'var(--ambar-suave)' : 'var(--tarjeta)'} stroke={jam && actual ? 'var(--coral)' : actual ? 'var(--ambar)' : 'var(--fg)'} strokeWidth={actual ? 7 : 3} />
            <text x={p.x} y={p.y + 7} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="800" fontSize="20" fill="var(--fg)">{s.nodes[i].v}</text>
          </g>
        );
      })}

      {cursor !== null && llega !== null && !s.done && (() => {
        const p = pos.get(cursor)!;
        return (
          <g>
            <rect x={p.x - 54} y={p.y - 70} width={108} height={30} rx={15} fill="var(--asfalto)" />
            <text x={p.x} y={p.y - 49} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="800" fontSize="15" fill="#fff">llega el {llega}</text>
          </g>
        );
      })()}

      {jam && (
        <g>
          <rect x={W - 260} y={56} width={248} height={40} rx={8} fill="var(--coral)" />
          <text x={W - 136} y={83} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="800" fontSize="20" fill="#fff">¡Embotellamiento!</text>
        </g>
      )}
      {done && <Fuegos W={W} y={40} />}
    </svg>
  );
}
