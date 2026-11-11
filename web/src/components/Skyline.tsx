import type { SessionSummary } from '@shared/profile';
import type { AlgorithmId } from '@shared/types';

const COLOR: Record<AlgorithmId, string> = {
  bubble: 'var(--edif-2)', merge: 'var(--verde)', quick: 'var(--azul)', bst: 'var(--ambar)', bfs: 'var(--coral)', dijkstra: 'var(--asfalto)',
};

/**
 * "Tu ciudad": cada ejercicio completado levanta un edificio (nivel reflexivo del
 * diseño emocional). Los lotes vacíos invitan a seguir construyendo.
 */
export function Skyline({ sesiones, alto = 220 }: { sesiones: SessionSummary[]; alto?: number }) {
  const hechas = sesiones.filter((s) => s.completado).slice(-24);
  const lotes = Math.max(12, hechas.length + 3);
  const W = 1000, H = alto, suelo = H - 34;
  const ancho = (W - 40) / lotes;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tu ciudad tiene ${hechas.length} edificios, uno por cada ejercicio completado.`}>
      <rect width={W} height={H} fill="var(--cielo)" />
      <circle cx={W - 90} cy={52} r={26} fill="var(--ambar)" opacity={0.8} />
      {Array.from({ length: lotes }, (_, k) => {
        const s = hechas[k];
        const x = 20 + k * ancho + ancho * 0.12;
        const w = ancho * 0.76;
        if (!s) return <rect key={k} x={x} y={suelo - 8} width={w} height={8} rx={2} fill="none" stroke="var(--tenue)" strokeDasharray="4 4" />;
        const h = 50 + ((s.pasos * 7 + k * 13) % (H - 110)) * 0.85;
        const filas = Math.floor((h - 16) / 18);
        return (
          <g key={k}>
            <title>{`${s.titulo} · ${s.errores} errores`}</title>
            <rect x={x} y={suelo - h} width={w} height={h} rx={3} fill={COLOR[s.algoritmo]} />
            {Array.from({ length: filas }, (_, r) => (
              <rect key={r} x={x + w * 0.2} y={suelo - h + 10 + r * 18} width={w * 0.6} height={8} rx={1.5} fill="var(--ventana)" opacity={s.errores === 0 ? 1 : 0.65} />
            ))}
            {s.examen && <path d={`M${x + w / 2} ${suelo - h - 22} v16 M${x + w / 2} ${suelo - h - 22} l14 5 l-14 5`} stroke="var(--fg)" strokeWidth={2} fill="var(--coral)" />}
          </g>
        );
      })}
      <rect x={0} y={suelo} width={W} height={34} fill="var(--asfalto)" />
      <line x1={0} x2={W} y1={suelo + 17} y2={suelo + 17} stroke="var(--ambar)" strokeWidth={3} strokeDasharray="24 18" />
    </svg>
  );
}
