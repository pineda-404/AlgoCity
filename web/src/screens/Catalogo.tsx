import { useState } from 'react';
import { ENGINES } from '@shared/engines';
import { exercisesFor, NOMBRES, parseCustom } from '@shared/exercises';
import { ALGORITHMS, type AlgorithmId, type ErrorType } from '@shared/types';
import { useNav } from '../App';
import { useStore } from '../state/store';
import { Bar, Dialog } from '../components/ui';
import { llm, providerLabel } from '../llm/client';

const ICONO: Record<AlgorithmId, JSX.Element> = {
  bubble: <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="3" y="14" width="6" height="13" fill="var(--edif-2)" /><rect x="12" y="6" width="6" height="21" fill="var(--ambar)" /><rect x="21" y="18" width="6" height="9" fill="var(--edif-2)" /></svg>,
  merge: <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M4 6 L15 16 L26 6 M15 16 V27" stroke="var(--verde)" strokeWidth="4" fill="none" /></svg>,
  quick: <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="3" y="16" width="5" height="11" fill="var(--edif-2)" /><rect x="10" y="12" width="5" height="15" fill="var(--edif-2)" /><line x1="17.5" y1="3" x2="17.5" y2="27" stroke="var(--azul)" strokeWidth="2" strokeDasharray="3 2" /><rect x="20" y="6" width="6" height="21" fill="var(--azul)" /></svg>,
  bst: <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M15 6 L7 16 M15 6 L23 16 M7 16 L4 25 M7 16 L11 25" stroke="var(--fg)" strokeWidth="2.5" fill="none" /><circle cx="15" cy="6" r="4" fill="var(--ambar)" /><circle cx="7" cy="16" r="3.5" fill="var(--edif-2)" /><circle cx="23" cy="16" r="3.5" fill="var(--edif-2)" /></svg>,
  bfs: <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="3.5" fill="var(--coral)" /><circle cx="15" cy="15" r="8" fill="none" stroke="var(--coral)" strokeWidth="2" /><circle cx="15" cy="15" r="13" fill="none" stroke="var(--coral)" strokeWidth="2" opacity=".5" /></svg>,
  dijkstra: <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M5 22 L13 8 L25 12 L20 25 Z" stroke="var(--edif-2)" strokeWidth="2.5" fill="none" /><path d="M5 22 L13 8 L25 12" stroke="var(--ambar)" strokeWidth="4" fill="none" /><circle cx="5" cy="22" r="3" fill="var(--fg)" /><circle cx="25" cy="12" r="3" fill="var(--fg)" /></svg>,
};

const ENFOQUE: Record<AlgorithmId, ErrorType[]> = {
  bubble: ['decidir-intercambio', 'pareja-equivocada'], merge: ['fusionar'], quick: ['elegir-pivote'], bst: ['insertar-bst'], bfs: ['visitar-nodo'], dijkstra: ['visitar-nodo'],
};

const NIVEL = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

/** P04 · Catálogo: 6 algoritmos, variantes de la IA y ejercicios con datos propios. */
export function Catalogo({ algoritmo }: { algoritmo?: string }) {
  const { profile } = useStore();
  const { startPractice } = useNav();
  const [examen, setExamen] = useState(false);
  const [cargando, setCargando] = useState<AlgorithmId | null>(null);
  const [propio, setPropio] = useState<AlgorithmId | null>(null);
  if (!profile) return null;

  const variante = async (alg: AlgorithmId) => {
    setCargando(alg);
    const weak = ENFOQUE[alg].filter((e) => (profile.errores[e] ?? 0) > 0);
    const r = await llm.variant({ algorithm: alg, level: profile.nivel, weakSpots: weak });
    setCargando(null);
    startPractice({ ...r.exercise, metafora: `${r.exercise.metafora} (Creado por: ${providerLabel(r.provider)}.)` }, examen);
  };

  const orden = algoritmo && ALGORITHMS.includes(algoritmo as AlgorithmId) ? [algoritmo as AlgorithmId, ...ALGORITHMS.filter((a) => a !== algoritmo)] : ALGORITHMS;

  return (
    <>
      <div className="fila" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.7rem,3.4vw,2.5rem)' }}>Elige un barrio de la ciudad</h1>
          <p className="tenue">Seis algoritmos, cada uno con su escena urbana. Practica con el catálogo, con una variante hecha para ti o con los datos de tu propia práctica.</p>
        </div>
        <label className="interruptor tarjeta" style={{ padding: '6px 14px', gap: 14 }}>
          <span><b>Modo examen</b><br /><span className="tenue" style={{ fontSize: '.85rem' }}>Sin pistas ni retrocesos, con nota vigesimal</span></span>
          <input type="checkbox" checked={examen} onChange={(e) => setExamen(e.target.checked)} />
        </label>
      </div>

      <div className="rejilla">
        {orden.map((alg) => {
          const eng = ENGINES[alg];
          const prog = profile.progreso[alg];
          return (
            <section key={alg} className="tarjeta alg-card" aria-labelledby={`t-${alg}`} style={alg === algoritmo ? { borderColor: 'var(--verde)' } : undefined}>
              <header>
                <div className="alg-ico">{ICONO[alg]}</div>
                <div>
                  <h2 id={`t-${alg}`} style={{ fontSize: '1.2rem', margin: 0 }}>{NOMBRES[alg]}</h2>
                  <div className="tenue" style={{ fontSize: '.85rem' }}>{prog ? `${prog.completados} completados · dominio ${Math.round(prog.dominio * 100)} %` : 'Sin practicar todavía'}</div>
                </div>
              </header>
              <p style={{ fontSize: '.95rem' }}>{eng.escena}</p>
              {prog && <Bar value={prog.dominio} label={`Dominio de ${NOMBRES[alg]}`} />}
              <div className="ejercicios">
                {exercisesFor(alg).map((ex) => (
                  <button key={ex.id} className="ejercicio-btn" onClick={() => startPractice(ex, examen)}>
                    <span><b>{ex.titulo}</b>{ex.titulo.includes('UNI') && <span className="chip" style={{ marginLeft: 6 }}>campus</span>}</span>
                    <span className="chip">{NIVEL[ex.nivel]}</span>
                  </button>
                ))}
              </div>
              <div className="fila">
                <button className="btn chico prim" onClick={() => variante(alg)} disabled={cargando !== null}>{cargando === alg ? 'Creando…' : 'Variante para mí'}</button>
                <button className="btn chico" onClick={() => setPropio(alg)}>Usar mis datos</button>
              </div>
            </section>
          );
        })}
      </div>
      {propio && <DatosPropios alg={propio} onClose={() => setPropio(null)} onStart={(ex) => startPractice(ex, examen)} />}
    </>
  );
}

function DatosPropios({ alg, onClose, onStart }: { alg: AlgorithmId; onClose: () => void; onStart: (ex: ReturnType<typeof parseCustom>['exercise'] & object) => void }) {
  const grafo = alg === 'bfs' || alg === 'dijkstra';
  const [texto, setTexto] = useState(grafo ? (alg === 'dijkstra' ? 'A B 4\nA C 2\nC B 1\nB D 5\nC D 8' : 'A B\nA C\nB D\nC D\nD E') : alg === 'bst' ? '50, 30, 70, 20, 40' : '9, 4, 7, 1, 8');
  const [inicio, setInicio] = useState('A');
  const [destino, setDestino] = useState('');
  const [error, setError] = useState('');
  const ok = () => {
    const r = parseCustom(alg, texto, inicio, destino);
    if (!r.ok || !r.exercise) return setError(r.error ?? 'Datos no válidos');
    onStart(r.exercise);
  };
  return (
    <Dialog titulo={`Tus datos · ${NOMBRES[alg]}`} onClose={onClose}>
      <p className="tenue" style={{ marginBottom: 10 }}>
        {grafo
          ? `Escribe un tramo por línea: “A B${alg === 'dijkstra' ? ' 4' : ''}”. Si los nombres tienen espacios usa guion: “Puerta 3 - Biblioteca${alg === 'dijkstra' ? ' : 4' : ''}”.`
          : 'Escribe entre 2 y 12 números separados por comas o espacios, por ejemplo los de tu práctica.'}
      </p>
      <label className="campo">
        Datos
        <textarea className="input" value={texto} onChange={(e) => { setTexto(e.target.value); setError(''); }} />
      </label>
      {grafo && (
        <div className="fila" style={{ marginTop: 10 }}>
          <label className="campo" style={{ flex: 1 }}>Estación de inicio<input className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
          <label className="campo" style={{ flex: 1 }}>Destino (opcional)<input className="input" value={destino} onChange={(e) => setDestino(e.target.value)} /></label>
        </div>
      )}
      {error && <p role="alert" style={{ color: 'var(--coral)', marginTop: 8 }}>{error}</p>}
      <div className="fila" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn prim" onClick={ok}>Construir mi ciudad</button>
      </div>
    </Dialog>
  );
}
