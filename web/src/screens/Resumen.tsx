import { useEffect, useState } from 'react';
import { BADGES, declareMood } from '@shared/profile';
import { ERROR_LABEL, NOMBRES } from '@shared/exercises';
import type { ErrorType, Mood } from '@shared/types';
import { useNav } from '../App';
import { learner, useStore } from '../state/store';
import { MoodPicker, fmtTiempo } from '../components/ui';
import { llm, providerLabel } from '../llm/client';
import { tts } from '../voice/voice';

/** P07 · Resumen con métricas, reflexión, insignias y ánimo al cerrar (RF-15, RF-18). */
export function Resumen() {
  const { resultado, go, startPractice } = useNav();
  const { profile, update } = useStore();
  const [reflexion, setReflexion] = useState<{ text: string; provider: string } | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [guardado, setGuardado] = useState(false);
  const [animo, setAnimo] = useState<Mood | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!resultado || !profile) return;
    const s = resultado.summary;
    llm.reflect({
      algorithm: s.algoritmo, exerciseTitle: s.titulo, steps: s.pasos, errors: s.errores, hints: s.pistas, undos: s.retrocesos,
      seconds: s.duracionSeg, errorTypes: s.erroresPorTipo, completed: s.completado,
    }, learner(profile)).then((r) => {
      setReflexion(r);
      if (profile.prefs.narracion) tts.speak(r.text, { rate: profile.prefs.velocidadVoz, tono: 'neutral' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado?.summary.id]);

  if (!resultado || !profile) {
    return (
      <div className="tarjeta">
        <h1>Aún no hay un resumen</h1>
        <button className="btn prim" style={{ marginTop: 12 }} onClick={() => go('catalogo')}>Practicar</button>
      </div>
    );
  }
  const s = resultado.summary;
  const nuevas = resultado.nuevas ?? [];

  const patchSesion = (fn: (x: typeof s) => typeof s) =>
    update((p) => ({ ...p, sesiones: p.sesiones.map((x) => (x.id === s.id ? fn(x) : x)) }));

  const elegirAnimo = (m: Mood) => {
    setAnimo(m);
    update((p) => declareMood(p, m, 'declarado', `al cerrar ${s.titulo}`));
    patchSesion((x) => ({ ...x, animoFin: m }));
  };

  const varianteEnfocada = async () => {
    setCargando(true);
    const weak = Object.keys(s.erroresPorTipo) as ErrorType[];
    const r = await llm.variant({ algorithm: s.algoritmo, level: profile.nivel, weakSpots: weak });
    setCargando(false);
    startPractice({ ...r.exercise, metafora: `${r.exercise.metafora} (Creado por: ${providerLabel(r.provider)}.)` });
  };

  const metricas: [string, string][] = [
    ['Pasos', String(s.pasos)], ['Errores', String(s.errores)], ['Pistas', String(s.pistas)], ['Retrocesos', String(s.retrocesos)], ['Tiempo', fmtTiempo(s.duracionSeg)],
  ];

  return (
    <>
      <h1 style={{ fontSize: 'clamp(1.7rem,3.4vw,2.5rem)', marginBottom: 4 }}>{s.completado ? '¡Ciudad terminada!' : 'Resumen'}</h1>
      <p className="tenue" style={{ marginBottom: 18 }}>{resultado.exercise.titulo} · {NOMBRES[s.algoritmo]}</p>
      <div className="dos">
        <div className="pila">
          <section className="tarjeta" aria-labelledby="t-met">
            <h2 id="t-met">Tus números</h2>
            <div className="fila num" style={{ gap: 22, marginTop: 6 }}>
              {metricas.map(([k, v]) => (
                <div key={k}><div className="etiqueta">{k}</div><div style={{ fontFamily: 'var(--f-senal)', fontWeight: 800, fontSize: '1.8rem' }}>{v}</div></div>
              ))}
              {s.examen && (
                <div><div className="etiqueta">Nota</div><div style={{ fontFamily: 'var(--f-senal)', fontWeight: 800, fontSize: '1.8rem', color: (s.nota ?? 0) >= 11 ? 'var(--verde)' : 'var(--coral)' }}>{s.nota}/20</div></div>
              )}
            </div>
            {Object.keys(s.erroresPorTipo).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="etiqueta" style={{ marginBottom: 6 }}>Dónde te equivocaste</div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {Object.entries(s.erroresPorTipo).map(([k, v]) => <li key={k}>{ERROR_LABEL[k as ErrorType]}: {v}</li>)}
                </ul>
              </div>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="t-ref">
            <h2 id="t-ref">Para pensar</h2>
            {reflexion ? (
              <>
                <p style={{ fontSize: '1.1rem' }}>{reflexion.text}</p>
                <p className="tenue" style={{ fontSize: '.8rem', marginTop: 4 }}>Arquitecto Jefe · {providerLabel(reflexion.provider)}</p>
              </>
            ) : <p className="tenue">El Arquitecto Jefe está pensando…</p>}
            <label className="campo" style={{ marginTop: 12 }}>
              Tu respuesta (opcional, se guarda en tu historial)
              <textarea className="input" style={{ fontFamily: 'var(--f-texto)' }} value={respuesta} onChange={(e) => { setRespuesta(e.target.value); setGuardado(false); }} />
            </label>
            <button className="btn chico" style={{ marginTop: 8 }} disabled={!respuesta.trim()} onClick={() => { patchSesion((x) => ({ ...x, reflexion: respuesta.trim() })); setGuardado(true); }}>
              {guardado ? 'Guardada ✓' : 'Guardar reflexión'}
            </button>
          </section>
        </div>

        <div className="pila">
          <section className="tarjeta" aria-labelledby="t-an">
            <h2 id="t-an">¿Cómo te sentiste al terminar?</h2>
            <MoodPicker label="Estado de ánimo al cerrar" value={animo} onChange={elegirAnimo} />
            {animo && <p className="tenue" style={{ marginTop: 8 }}>Gracias. Lo tomaré en cuenta para tu próximo reto.</p>}
          </section>

          {nuevas.length > 0 && (
            <section className="tarjeta" aria-labelledby="t-ins" style={{ borderColor: 'var(--ambar)' }}>
              <h2 id="t-ins">Insignias nuevas</h2>
              <div className="pila">
                {nuevas.map((b) => (
                  <div key={b} className="insignia"><span className="icono" aria-hidden="true">★</span><div><b>{BADGES[b]?.nombre}</b><div className="tenue" style={{ fontSize: '.88rem' }}>{BADGES[b]?.desc}</div></div></div>
                ))}
              </div>
            </section>
          )}

          <section className="tarjeta" aria-labelledby="t-sig">
            <h2 id="t-sig">¿Y ahora?</h2>
            <div className="pila">
              {s.errores > 0 && <button className="btn prim" onClick={varianteEnfocada} disabled={cargando}>{cargando ? 'Creando…' : 'Variante enfocada en mis errores'}</button>}
              <button className="btn" onClick={() => startPractice(resultado.exercise, s.examen)}>Repetir este ejercicio</button>
              {!s.examen && <button className="btn" onClick={() => startPractice(resultado.exercise, true)}>Repetir en modo examen</button>}
              <button className="btn" onClick={() => go('salas', 'actual')}>Retar a alguien en una sala</button>
              <button className="btn fantasma" onClick={() => go('inicio')}>Volver a mi ciudad</button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
