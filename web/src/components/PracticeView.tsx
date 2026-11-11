import { useEffect, type ReactNode } from 'react';
import type { Exercise } from '@shared/types';
import type { GraphState } from '@shared/engines';
import { Scene } from '../city/Scene';
import { CommandBar } from './CommandBar';
import { Bar, Dialog, HelpDialog, Toast, fmtTiempo } from './ui';
import { usePractice, type CoopBridge, type PracticeResult, type ProgressReport } from '../practice/usePractice';

const BOTONES: Record<string, { label: string; atajo: string; key: string }> = {
  swap: { label: 'Intercambia', atajo: 'I', key: 'i' },
  skip: { label: 'Avanza', atajo: 'A', key: 'a' },
  left: { label: '← Izquierda', atajo: '←', key: 'ArrowLeft' },
  right: { label: 'Derecha →', atajo: '→', key: 'ArrowRight' },
};

/** Pantalla de ejecución guiada (P05): ciudad, asistente, pseudocódigo y mando. */
export function PracticeView({ exercise, examen, coop, onProgress, onFinish, extraPanel }: {
  exercise: Exercise;
  examen: boolean;
  coop?: CoopBridge;
  onProgress?: (p: ProgressReport) => void;
  onFinish?: (r: PracticeResult) => void;
  extraPanel?: ReactNode;
}) {
  const p = usePractice({ exercise, examen, coop, onProgress, onFinish });
  const { eng, state, stats } = p;
  const grafo = exercise.algoritmo === 'bfs' || exercise.algoritmo === 'dijkstra';
  const pendientes = grafo ? (state as GraphState).nodes.filter((n) => !(state as GraphState).order.includes(n)) : [];
  const bloqueado = !!coop && !coop.miTurno;

  // Atajos de teclado (RF-05)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable], [role="dialog"]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const accion = eng.acciones.find((a) => BOTONES[a] && (e.key === BOTONES[a].key || e.key === BOTONES[a].key.toUpperCase()));
      if (accion) {
        e.preventDefault();
        return p.run({ type: 'action', action: { kind: accion } as never }, 'teclado');
      }
      const mapa: Record<string, () => void> = {
        z: () => p.run({ type: 'undo', steps: 1 }, 'teclado'),
        p: () => p.run({ type: 'hint' }, 'teclado'),
        r: () => p.run({ type: 'repeat' }, 'teclado'),
        '?': () => p.setHelpOpen(true),
      };
      const f = mapa[e.key.toLowerCase()];
      if (f) {
        e.preventDefault();
        f();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [eng, p]);

  const sugerencias = [
    ...eng.acciones.flatMap((a) => ({ swap: ['Intercambia'], skip: ['Avanza'], left: ['Izquierda'], right: ['Derecha'], visit: pendientes.length ? [`Visita ${pendientes[0]}`] : [] }[a] ?? [])),
    ...(examen ? [] : ['Retrocede el tiempo', 'Dame una pista', '¿Por qué?']),
    '¿Qué puedo decir?',
  ];

  return (
    <div className="practica">
      <section aria-labelledby="titulo-ej">
        <div className="titulo-ej">
          <h1 id="titulo-ej">{exercise.titulo}</h1>
          <span className="chip">{eng.nombre}</span>
          {examen && <span className="chip coral">Modo examen · {fmtTiempo(p.segundos)}</span>}
          {exercise.origen === 'llm' && <span className="chip verde">Variante de la IA</span>}
          {exercise.origen === 'generador' && <span className="chip verde">Variante para ti</span>}
          {exercise.origen === 'propio' && <span className="chip ambar">Tus datos</span>}
        </div>
        <p className="tenue" style={{ marginBottom: 10 }}>{eng.escena}</p>

        <div className="lienzo">
          <Scene ex={exercise} state={state} jam={!!p.jam} jamNode={p.jam?.node} onVisit={grafo && !bloqueado ? (n) => p.run({ type: 'action', action: { kind: 'visit', node: n } }, 'boton') : undefined} />
          <div className="lienzo-pie">
            {!examen && <button className="btn chico" onClick={() => p.run({ type: 'undo', steps: 1 }, 'boton')} disabled={bloqueado || (!!coop && !coop.puedeDeshacer)}>⟲ Retroceder <kbd>Z</kbd></button>}
            {!examen && <button className="btn chico" onClick={() => p.run({ type: 'hint' }, 'boton')} disabled={p.done}>Pista <kbd>P</kbd></button>}
            {!coop && <button className="btn chico fantasma" onClick={() => p.run({ type: 'restart' }, 'boton')}>Reiniciar</button>}
            <button className="btn chico fantasma" onClick={() => p.setHelpOpen(true)}>¿Qué puedo decir? <kbd>?</kbd></button>
            <span className="der tenue num" aria-live="off">{p.progreso !== null ? `Paso ${stats.pasos} de ${p.total}` : ''}</span>
          </div>
        </div>

        <p className="pregunta" aria-live="polite">{p.done ? eng.final(state) : bloqueado ? `Turno de ${coop!.turnoDe}. ${eng.intro(state)}` : eng.intro(state)}</p>

        {!p.done && (
          <div className="acciones-alg" role="group" aria-label="Acciones del algoritmo">
            {eng.acciones.filter((a) => BOTONES[a]).map((a) => (
              <button key={a} className="btn ambar" disabled={bloqueado} onClick={() => p.run({ type: 'action', action: { kind: a } as never }, 'boton')}>
                {BOTONES[a].label} <kbd>{BOTONES[a].atajo}</kbd>
              </button>
            ))}
            {grafo && (
              <label className="campo" style={{ flex: '1 1 260px' }}>
                <span className="sr-only">Estación a visitar</span>
                <select className="input" value="" disabled={bloqueado} onChange={(e) => e.target.value && p.run({ type: 'action', action: { kind: 'visit', node: e.target.value } }, 'boton')}>
                  <option value="">Visitar estación… (o haz clic en el mapa)</option>
                  {pendientes.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            {coop && (
              coop.miTurno
                ? <button className="btn" onClick={() => coop.turno('ceder')}>Ceder turno</button>
                : <button className="btn prim" onClick={() => coop.turno('pedir')}>Pedir turno</button>
            )}
          </div>
        )}

        <CommandBar onInput={p.input} sugerencias={sugerencias} disabled={p.done && !coop}
          onSugerencia={(s) => p.input([{ text: s, confidence: 1 }], 'texto')} />
      </section>

      <aside aria-label="Asistente y estado">
        <div className="panel">
          <div className="asistente-cab">
            <div className={`avatar ${p.tono}`} aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24"><path fill="#fff" d="M4 11h16v2H4zM7 6h10l1 4H6zM8 14h8v5H8z" /></svg>
            </div>
            <div>
              <div className="etiqueta">Arquitecto Jefe</div>
              <div className="tenue" style={{ fontSize: '.85rem' }}>Tono {p.tono === 'calmo' ? 'calmado' : p.tono === 'entusiasta' ? 'entusiasta' : 'neutral'}</div>
            </div>
          </div>
          <div className="mensajes" role="log" aria-live="polite" aria-label="Mensajes del asistente" ref={(el) => el && (el.scrollTop = el.scrollHeight)}>
            {p.msgs.map((m) => (
              <div key={m.id} className={`msg ${m.kind}`}>
                <small>{m.who}</small>
                {m.kind === 'pensando' ? <span className="pensando" aria-label="Pensando"><i /><i /><i /></span> : m.text}
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="etiqueta" style={{ marginBottom: 6 }}>Plano del algoritmo</div>
          <pre className="pseudo" aria-label="Pseudocódigo">
            {eng.pseudocodigo.map((l, k) => <div key={k} className={k === eng.line(state) ? 'on' : ''} aria-current={k === eng.line(state) ? 'step' : undefined}>{l}</div>)}
          </pre>
        </div>

        <div className="panel">
          <div className="etiqueta">Estado</div>
          <p style={{ fontSize: '.92rem', marginTop: 4 }}>{eng.describe(state)}</p>
          {p.progreso !== null && <div style={{ marginTop: 10 }}><Bar value={p.progreso} label="Progreso del ejercicio" /></div>}
          <div className="contadores num">
            <span><b>{stats.pasos}</b> pasos</span>
            <span><b>{stats.errores}</b> errores</span>
            {!examen && <span><b>{stats.pistas}</b> pistas</span>}
            <span><b>{fmtTiempo(p.segundos)}</b></span>
          </div>
        </div>
        {extraPanel}
      </aside>

      {p.helpOpen && <HelpDialog acciones={eng.acciones} nodo={pendientes[0]} onClose={() => p.setHelpOpen(false)} />}
      {p.confirm && (
        <Dialog titulo="¿Quisiste decir esto?" onClose={() => p.confirmar(false)}>
          <p style={{ fontSize: '1.2rem', marginBottom: 16 }}>“{p.confirm.text}”</p>
          <div className="fila">
            <button className="btn prim" onClick={() => p.confirmar(true)}>Sí, hazlo</button>
            <button className="btn" onClick={() => p.confirmar(false)}>No</button>
          </div>
        </Dialog>
      )}
      {p.calmOffer && (
        <Toast>
          ¿Activo el modo calma? (colores suaves, voz pausada)
          <button className="btn chico ambar" onClick={p.acceptCalm}>Sí</button>
          <button className="btn chico" style={{ color: '#fff', borderColor: '#fff', background: 'transparent' }} onClick={() => p.setCalmOffer(false)}>No, gracias</button>
        </Toast>
      )}
    </div>
  );
}
