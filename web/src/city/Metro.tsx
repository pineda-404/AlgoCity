import { circleLayout } from '@shared/exercises';
import { pathTo, type GraphState } from '@shared/engines';
import { Fuegos } from './Buildings';
import { useNarrow } from './useNarrow';

/** Red de metro para BFS y Dijkstra. Las estaciones se pueden visitar con clic o teclado (RF-05). */
export function Metro(props: {
  s: GraphState;
  algoritmo: 'bfs' | 'dijkstra';
  coords?: Record<string, [number, number]>;
  jamNode: string | null;
  focus: string[];
  done: boolean;
  onVisit?: (node: string) => void;
  ariaLabel: string;
}) {
  const { s, algoritmo, jamNode, done, onVisit } = props;
  const narrow = useNarrow();
  const W = narrow ? 620 : 1000, H = narrow ? 600 : 540;
  const coords = props.coords && s.nodes.every((n) => props.coords![n]) ? props.coords : circleLayout(s.nodes);
  const P = (n: string) => ({ x: 70 + (coords[n][0] / 100) * (W - 140), y: 60 + (coords[n][1] / 100) * (H - 130) });
  const camino = done && s.target ? pathTo(s, s.target) : [];
  const enCamino = (u: string, v: string) => {
    const i = camino.indexOf(u), j = camino.indexOf(v);
    return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
  };
  const aristas: { u: string; v: string; w: number }[] = [];
  for (const u of s.nodes) for (const { to, w } of s.adj[u]) if (u < to) aristas.push({ u, v: to, w });
  const visitadas = new Set(s.order);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={props.ariaLabel}>
      <rect width={W} height={H} fill="var(--cielo)" />
      {aristas.map(({ u, v, w }) => {
        const a = P(u), b = P(v);
        const ruta = enCamino(u, v);
        const activa = visitadas.has(u) && visitadas.has(v);
        return (
          <g key={`${u}-${v}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--asfalto)" strokeWidth={14} strokeLinecap="round" opacity={0.85} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ruta ? 'var(--ambar)' : activa ? 'var(--verde)' : 'var(--edif)'} strokeWidth={ruta ? 10 : 6} strokeLinecap="round" />
            {algoritmo === 'dijkstra' && (
              <g>
                <rect x={(a.x + b.x) / 2 - 22} y={(a.y + b.y) / 2 - 15} width={44} height={28} rx={14} fill="var(--tarjeta)" stroke="var(--fg)" strokeWidth={2} />
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 5} textAnchor="middle" fontFamily="var(--f-codigo)" fontWeight="700" fontSize="15" fill="var(--fg)">{w}′</text>
              </g>
            )}
          </g>
        );
      })}

      {s.nodes.map((n) => {
        const p = P(n);
        const visit = visitadas.has(n);
        const cola = s.queue.indexOf(n);
        const d = s.dist[n];
        const jam = jamNode === n;
        const ultimo = s.last === n;
        const estado = visit ? (algoritmo === 'bfs' ? 'visitada' : 'fijada') : cola >= 0 ? `en la cola, posición ${cola + 1}` : d !== null ? `distancia ${d}` : 'sin descubrir';
        const label = `${n}, ${estado}${d !== null ? `, ${algoritmo === 'bfs' ? 'saltos' : 'minutos'} ${d}` : ''}`;
        const clickable = !!onVisit && !done && !visit;
        return (
          <g key={n} className={`estacion${jam ? ' atasco' : ''}`} role={clickable ? 'button' : 'img'} tabIndex={clickable ? 0 : -1} aria-label={clickable ? `Visitar ${label}` : label}
            onClick={() => clickable && onVisit!(n)}
            onKeyDown={(e) => {
              if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onVisit!(n);
              }
            }}>
            {ultimo && <circle cx={p.x} cy={p.y} r={36} fill="var(--verde)" opacity={0.18} />}
            <circle className="borde" cx={p.x} cy={p.y} r={24}
              fill={visit ? 'var(--verde)' : 'var(--tarjeta)'}
              stroke={jam ? 'var(--coral)' : cola >= 0 && algoritmo === 'bfs' ? 'var(--ambar)' : 'var(--fg)'}
              strokeWidth={jam || cola >= 0 ? 7 : 4} />
            {visit && <path d={`M${p.x - 9} ${p.y} l6 7 l12 -14`} fill="none" stroke="var(--sobre-verde)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />}
            {!visit && cola >= 0 && algoritmo === 'bfs' && (
              <text x={p.x} y={p.y + 7} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="800" fontSize="19" fill="var(--fg)">{cola + 1}</text>
            )}
            {(d !== null || algoritmo === 'dijkstra') && (
              <g>
                <rect x={p.x - 24} y={p.y - 58} width={48} height={26} rx={13} fill={visit ? 'var(--verde)' : 'var(--asfalto)'} />
                <text x={p.x} y={p.y - 39} textAnchor="middle" fontFamily="var(--f-codigo)" fontWeight="700" fontSize="15" fill={visit ? 'var(--sobre-verde)' : '#fff'}>{d ?? '∞'}</text>
              </g>
            )}
            <text x={p.x} y={p.y + 46} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="800" fontSize="17" fill="var(--fg)" stroke="var(--cielo)" strokeWidth={5} paintOrder="stroke">{n}</text>
            {n === s.start && <text x={p.x} y={p.y + 66} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="700" fontSize="12" fill="var(--verde)" letterSpacing=".08em">INICIO</text>}
            {n === s.target && <text x={p.x} y={p.y + 66} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="700" fontSize="12" fill="var(--coral)" letterSpacing=".08em">DESTINO</text>}
          </g>
        );
      })}

      {algoritmo === 'bfs' && (
        <g>
          <text x={20} y={H - 22} fontFamily="var(--f-senal)" fontWeight="800" fontSize="17" fill="var(--fg)">Cola:</text>
          {s.queue.map((q, k) => (
            <g key={q}>
              <rect x={74 + k * (narrow ? 90 : 120)} y={H - 44} width={narrow ? 84 : 112} height={30} rx={6} fill={k === 0 ? 'var(--ambar)' : 'var(--tarjeta)'} stroke="var(--fg)" strokeWidth={2} />
              <text x={(narrow ? 116 : 130) + k * (narrow ? 90 : 120)} y={H - 23} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="700" fontSize="14" fill="#1d2430">{q}</text>
            </g>
          ))}
          {s.queue.length === 0 && <text x={74} y={H - 22} fontSize="16" fill="var(--tenue)">vacía</text>}
        </g>
      )}
      {done && camino.length > 0 && (
        <g>
          <rect x={20} y={H - 46} width={W - 40} height={34} rx={8} fill="var(--ambar)" />
          <text x={W / 2} y={H - 23} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="800" fontSize="17" fill="#1d2430">
            Ruta: {camino.join(' → ')}{algoritmo === 'dijkstra' ? ` · ${s.dist[s.target!]} min` : ` · ${s.dist[s.target!]} tramos`}
          </text>
        </g>
      )}
      {jamNode && (
        <g>
          <rect x={W - 260} y={10} width={248} height={40} rx={8} fill="var(--coral)" />
          <text x={W - 136} y={37} textAnchor="middle" fontFamily="var(--f-senal)" fontWeight="800" fontSize="20" fill="#fff">¡Embotellamiento!</text>
        </g>
      )}
      {done && <Fuegos W={W} y={20} />}
    </svg>
  );
}
