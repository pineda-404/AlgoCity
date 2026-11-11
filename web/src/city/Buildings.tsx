import { useRef } from 'react';
import { useNarrow } from './useNarrow';

/**
 * Avenida de edificios (Bubble, Quick y Merge Sort). Cada valor es un edificio cuya
 * altura es proporcional al valor; las ventanas se encienden cuando el edificio llega
 * a su lugar definitivo (nivel visceral del diseño emocional).
 */
export interface Zone {
  from: number;
  to: number; // exclusivo
  tipo: 'izq' | 'der' | 'pend';
  label?: string;
}

export interface BuildingsProps {
  values: number[];
  labels?: string[] | null;
  focus: number[];
  lit: boolean[];
  dim?: boolean[];
  zones?: Zone[];
  pivot?: number;
  divider?: number;
  out?: number[];
  jam: boolean;
  done: boolean;
  ariaLabel: string;
}

/** Mantiene la identidad de cada edificio entre estados para animar los intercambios. */
function useStableKeys(values: number[]): number[] {
  const prev = useRef<{ vals: number[]; ids: number[]; next: number }>({ vals: [], ids: [], next: 0 });
  const p = prev.current;
  if (p.vals.length === values.length && p.vals.every((v, i) => v === values[i])) return p.ids;
  const usados = new Set<number>();
  const ids = values.map((v, i) => {
    let k = p.vals[i] === v && !usados.has(i) ? i : -1;
    if (k < 0) k = p.vals.findIndex((pv, j) => pv === v && !usados.has(j));
    if (k >= 0) {
      usados.add(k);
      return p.ids[k];
    }
    return p.next++;
  });
  prev.current = { vals: [...values], ids, next: p.next };
  return ids;
}

export function Buildings(props: BuildingsProps) {
  const { values, labels, focus, lit, dim, zones, pivot, divider, out, jam, done } = props;
  const W = useNarrow() ? 620 : 1000;
  const ids = useStableKeys(values);
  const n = Math.max(values.length, 1);
  const topStrip = out ? 150 : 0;
  const H = 430 + topStrip;
  const ground = H - 110;
  const slot = (W - 40) / n;
  const bw = Math.min(slot * 0.62, 120);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(1, ...values);
  const maxH = ground - topStrip - 80;
  const alto = (v: number) => 40 + ((v - minV) / (maxV - minV || 1)) * (maxH - 40);
  const cx = (k: number) => 20 + slot * k + slot / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.ariaLabel}>
      <defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--cielo)" />
          <stop offset="1" stopColor="var(--tarjeta)" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#cielo)" />
      {/* Silueta lejana de la ciudad */}
      <g opacity=".18" fill="var(--edif-2)">
        {Array.from({ length: 22 }, (_, k) => {
          const h = 40 + ((k * 37) % 90);
          return <rect key={k} x={k * 46} y={ground - h} width={40} height={h} />;
        })}
      </g>

      {zones?.map((z, k) =>
        z.to > z.from ? (
          <g key={k}>
            <rect x={20 + slot * z.from + 4} y={topStrip + 30} width={slot * (z.to - z.from) - 8} height={ground - topStrip - 30} rx={10}
              fill={z.tipo === 'izq' ? 'var(--verde-suave)' : z.tipo === 'der' ? 'var(--ambar-suave)' : 'var(--azul-suave)'} opacity=".75" />
            {z.label && (
              <text x={20 + slot * z.from + 14} y={topStrip + 52} fontFamily="var(--f-senal)" fontWeight="800" fontSize="17" fill="var(--fg)">
                {slot * (z.to - z.from) < 170 ? (z.tipo === 'izq' ? 'Izq.' : z.tipo === 'der' ? 'Der.' : '') : z.label}
              </text>
            )}
          </g>
        ) : null,
      )}

      {out && (
        <g>
          <text x={24} y={28} fontFamily="var(--f-senal)" fontWeight="800" fontSize="18" fill="var(--fg)">Nueva avenida</text>
          <rect x={20} y={128} width={W - 40} height={10} rx={3} fill="var(--asfalto)" />
          {out.map((v, k) => {
            const h = 20 + ((v - minV) / (maxV - minV || 1)) * 80;
            const w = Math.min(bw * 0.6, 60);
            const x = 24 + k * (w + 10);
            return (
              <g key={k}>
                <rect x={x} y={128 - h} width={w} height={h} rx={3} fill="var(--verde)" />
                <text x={x + w / 2} y={128 - h - 6} textAnchor="middle" fontFamily="var(--f-codigo)" fontWeight="700" fontSize="16" fill="var(--fg)">{v}</text>
              </g>
            );
          })}
          {out.length === 0 && <text x={24} y={100} fontSize="16" fill="var(--tenue)">Aquí entran los edificios en orden</text>}
        </g>
      )}

      {values.map((v, k) => {
        const h = alto(v);
        const x = -bw / 2;
        const y = ground - h;
        const foco = focus.includes(k);
        const apagado = dim?.[k];
        const encendido = lit[k] || done;
        const cols = bw > 80 ? 3 : 2;
        const filas = Math.max(1, Math.floor((h - 26) / 26));
        const esPivote = pivot === k;
        return (
          <g key={ids[k]} className="edificio" style={{ transform: `translateX(${cx(k)}px)` }} opacity={apagado ? 0.28 : 1}>
            <g className={jam && foco ? 'atasco' : undefined}>
            <rect x={x} y={y} width={bw} height={h} rx={3}
              fill={esPivote ? 'var(--azul)' : encendido ? 'var(--edif-2)' : 'var(--edif)'}
              stroke={jam && foco ? 'var(--coral)' : foco ? 'var(--ambar)' : 'none'} strokeWidth={foco ? 7 : 0} />
            {Array.from({ length: filas }, (_, r) =>
              Array.from({ length: cols }, (_, c) => {
                const on = encendido || (r + c + k) % 3 === 0;
                return (
                  <rect key={`${r}-${c}`} x={x + 10 + c * ((bw - 20) / cols) + ((bw - 20) / cols - 14) / 2} y={y + 12 + r * 26} width={14} height={13} rx={1.5}
                    fill={on ? 'var(--ventana)' : 'var(--ventana-off)'} />
                );
              }),
            )}
            <rect x={-28} y={y - 44} width={56} height={34} rx={6} fill="var(--tarjeta)" stroke="var(--fg)" strokeWidth={3} />
            <text x={0} y={y - 20} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="800" fontSize="22" fill="var(--fg)">{v}</text>
            {esPivote && (
              <g>
                <rect x={-38} y={y - 76} width={76} height={26} rx={13} fill="var(--azul)" />
                <text x={0} y={y - 58} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="800" fontSize="14" fill="#fff">PIVOTE</text>
              </g>
            )}
            {foco && !done && <path d={`M-9 ${ground - 6} l9 -12 l9 12 z`} fill={jam ? 'var(--coral)' : 'var(--asfalto)'} />}
            </g>
          </g>
        );
      })}

      {divider !== undefined && (
        <g>
          <line x1={20 + slot * divider} x2={20 + slot * divider} y1={topStrip + 60} y2={ground} stroke="var(--azul)" strokeWidth={4} strokeDasharray="10 8" />
        </g>
      )}

      <rect x={0} y={ground} width={W} height={110} fill="var(--asfalto)" />
      <line x1={0} x2={W} y1={ground + 70} y2={ground + 70} stroke="var(--ambar)" strokeWidth={5} strokeDasharray="34 26" />
      {values.map((_, k) => (
        <g key={k}>
          <text x={cx(k)} y={ground + 34} textAnchor="middle" fontFamily="var(--f-codigo)" fontSize="20" fill="#e9eee9">A[{k}]</text>
          {labels?.[k] && (
            <text x={cx(k)} y={ground + 98} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="700" fontSize="15" fill="#e9eee9">{labels[k]}</text>
          )}
        </g>
      ))}

      {jam && (
        <g>
          {focus.slice(0, 2).map((k, i) => (
            <g key={i} className="atasco">
              <rect x={cx(k) - 34} y={ground + 50} width={30} height={16} rx={5} fill="var(--coral)" />
              <rect x={cx(k) + 4} y={ground + 50} width={30} height={16} rx={5} fill="#f6c343" />
            </g>
          ))}
          <g>
            <rect x={W - 260} y={8} width={248} height={40} rx={8} fill="var(--coral)" />
            <text x={W - 136} y={35} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="800" fontSize="20" fill="#fff">¡Embotellamiento!</text>
          </g>
        </g>
      )}
      {done && <Fuegos W={W} y={topStrip + 40} />}
    </svg>
  );
}

export function Fuegos({ W, y }: { W: number; y: number }) {
  const puntos = [[0.18, 0], [0.42, 30], [0.66, -10], [0.86, 25]];
  const colores = ['var(--ambar)', 'var(--verde)', 'var(--coral)', 'var(--azul)'];
  return (
    <g className="fuego" aria-hidden="true">
      {puntos.map(([px, dy], k) =>
        [0, 1, 2].map((r) => (
          <circle key={`${k}-${r}`} cx={W * px} cy={y + 40 + dy} r={12 + r * 10} fill="none" stroke={colores[(k + r) % 4]} strokeWidth={4}
            style={{ animationDelay: `${k * 0.3 + r * 0.15}s` }} />
        )),
      )}
    </g>
  );
}
