import { useState } from 'react';
import { BADGES, declareMood, recommend, urbanistTitle } from '@shared/profile';
import { exercisesFor, NOMBRES } from '@shared/exercises';
import type { AlgorithmId, Exercise, Level } from '@shared/types';
import { useNav } from '../App';
import { useStore } from '../state/store';
import { MoodPicker } from '../components/ui';
import { Skyline } from '../components/Skyline';
import { llm, providerLabel } from '../llm/client';

export function pickExercise(alg: AlgorithmId, nivel: Level): Exercise {
  const lista = exercisesFor(alg);
  const orden: Level[] = ['basico', 'intermedio', 'avanzado'];
  return [...lista].sort((a, b) => Math.abs(orden.indexOf(a.nivel) - orden.indexOf(nivel)) - Math.abs(orden.indexOf(b.nivel) - orden.indexOf(nivel)))[0];
}

/** P03 · Mi ciudad: ánimo de entrada, siguiente reto recomendado y la ciudad que vas construyendo. */
export function Inicio() {
  const { profile, update } = useStore();
  const { go, startPractice } = useNav();
  const [cargando, setCargando] = useState(false);
  const [animoHoy, setAnimoHoy] = useState(false);
  if (!profile) return null;
  const rec = recommend(profile);
  const completados = profile.sesiones.filter((s) => s.completado).length;

  const empezar = async () => {
    if (rec.enfoque) {
      setCargando(true);
      const r = await llm.variant({ algorithm: rec.algoritmo, level: profile.nivel, weakSpots: [rec.enfoque] });
      setCargando(false);
      startPractice({ ...r.exercise, metafora: `${r.exercise.metafora} (Creado por: ${providerLabel(r.provider)}.)` });
    } else startPractice(pickExercise(rec.algoritmo, profile.nivel));
  };

  return (
    <>
      <div className="fila" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.7rem,3.4vw,2.5rem)' }}>Hola, {profile.nombre}</h1>
          <p className="tenue">{urbanistTitle(profile)} · {completados} {completados === 1 ? 'edificio construido' : 'edificios construidos'}{profile.racha.dias > 1 ? ` · racha de ${profile.racha.dias} días` : ''}</p>
        </div>
        {profile.simulado && <span className="chip ambar">Perfil simulado (data/mock)</span>}
      </div>

      <div className="dos">
        <div className="pila">
          <section className="tarjeta" aria-labelledby="t-animo">
            <h2 id="t-animo">¿Cómo llegas hoy?</h2>
            <p className="tenue" style={{ marginBottom: 10 }}>El Arquitecto Jefe ajusta su tono y su ritmo según cómo te sientas.</p>
            <MoodPicker label="Estado de ánimo al empezar" value={animoHoy ? profile.animo.actual : null} onChange={(m) => {
              update((p) => declareMood(p, m, 'declarado', 'al entrar a la ciudad'));
              setAnimoHoy(true);
            }} />
            {animoHoy && profile.animo.actual === 'frustrado' && !profile.prefs.modoCalma && (
              <div className="fila" style={{ marginTop: 10 }}>
                <span>¿Activamos el modo calma para hoy?</span>
                <button className="btn chico ambar" onClick={() => update((p) => ({ ...p, prefs: { ...p.prefs, modoCalma: true } }))}>Sí, modo calma</button>
              </div>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="t-reto" style={{ borderColor: 'var(--verde)' }}>
            <div className="etiqueta">Tu siguiente reto</div>
            <h2 id="t-reto" style={{ marginTop: 4 }}>{NOMBRES[rec.algoritmo]}{rec.enfoque ? ' · variante enfocada' : ''}</h2>
            <p style={{ marginBottom: 14 }}>{rec.razon}</p>
            <div className="fila">
              <button className="btn prim" onClick={empezar} disabled={cargando}>{cargando ? 'Preparando la ciudad…' : 'Empezar'}</button>
              <button className="btn" onClick={() => go('catalogo', rec.algoritmo)}>Elegir otro ejercicio</button>
            </div>
          </section>

          {profile.rol === 'docente' && (
            <section className="tarjeta" aria-labelledby="t-doc">
              <h2 id="t-doc">Panel docente</h2>
              <p className="tenue" style={{ marginBottom: 10 }}>Crea una sala de clase, comparte el código y mira en vivo en qué paso se traba cada estudiante.</p>
              <div className="fila">
                <button className="btn prim" onClick={() => go('salas')}>Crear sala de clase</button>
                <button className="btn" onClick={() => go('sala', 'CLS-2026')}>Ver la clase de demostración</button>
              </div>
            </section>
          )}
        </div>

        <div className="pila">
          <section className="tarjeta" aria-labelledby="t-ciudad">
            <h2 id="t-ciudad">Tu ciudad</h2>
            <p className="tenue" style={{ marginBottom: 10 }}>Cada ejercicio terminado levanta un edificio. Con ventanas encendidas si no tuvo errores.</p>
            <div className="skyline"><Skyline sesiones={profile.sesiones} /></div>
          </section>
          <section className="tarjeta" aria-labelledby="t-ins">
            <h2 id="t-ins">Insignias</h2>
            {profile.insignias.length === 0 ? (
              <p className="vacio">Termina tu primer ejercicio para ganar la primera.</p>
            ) : (
              <div className="pila">
                {profile.insignias.slice(-3).map((b) => (
                  <div key={b} className="insignia"><span className="icono" aria-hidden="true">★</span><div><b>{BADGES[b]?.nombre}</b><div className="tenue" style={{ fontSize: '.88rem' }}>{BADGES[b]?.desc}</div></div></div>
                ))}
              </div>
            )}
            <div className="fila" style={{ marginTop: 12 }}>
              <button className="btn chico" onClick={() => go('perfil')}>Ver mi progreso</button>
              <button className="btn chico" onClick={() => go('salas')}>Practicar con otros</button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
