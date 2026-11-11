import { useState } from 'react';
import { BADGES, urbanistTitle } from '@shared/profile';
import { ERROR_LABEL, NOMBRES } from '@shared/exercises';
import { ALGORITHMS, type ErrorType } from '@shared/types';
import { useNav } from '../App';
import { useStore } from '../state/store';
import { Bar, Dialog, MOODS, fmtTiempo } from '../components/ui';

/** P10 · Mi perfil: progreso, errores, emociones, historial y control de mis datos (RF-13, RF-20). */
export function Perfil() {
  const { profile, setProfile, update } = useStore();
  const { go } = useNav();
  const [borrar, setBorrar] = useState(false);
  const [nombre, setNombre] = useState(profile?.nombre ?? '');
  if (!profile) return null;

  const errores = (Object.entries(profile.errores) as [ErrorType, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const maxErr = Math.max(1, ...errores.map(([, v]) => v));
  const descargar = () => {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `algocity-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const icono = (m: string) => MOODS.find((x) => x.id === m)?.icono ?? '';

  return (
    <>
      <div className="fila" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.7rem,3.4vw,2.5rem)' }}>Mi perfil</h1>
          <p className="tenue">{urbanistTitle(profile)} · nivel {profile.nivel} · ritmo promedio {profile.ritmo.segPorPaso ? `${profile.ritmo.segPorPaso.toFixed(1)} s por paso` : 'por medir'}</p>
        </div>
        <button className="btn" onClick={() => go('preferencias')}>Preferencias y accesibilidad</button>
      </div>

      <div className="dos">
        <div className="pila">
          <section className="tarjeta" aria-labelledby="t-prog">
            <h2 id="t-prog">Dominio por algoritmo</h2>
            <div className="barras" style={{ marginTop: 8 }}>
              {ALGORITHMS.map((a) => {
                const p = profile.progreso[a];
                return (
                  <div key={a} className="b">
                    <span>{NOMBRES[a]}</span>
                    <Bar value={p?.dominio ?? 0} label={`Dominio de ${NOMBRES[a]}`} />
                    <span className="num tenue" style={{ fontSize: '.85rem' }}>{p ? `${Math.round(p.dominio * 100)} % · ${p.completados}✓` : '—'}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="tarjeta" aria-labelledby="t-err">
            <h2 id="t-err">En qué me equivoco</h2>
            {errores.length === 0 ? <p className="vacio">Sin errores registrados.</p> : (
              <div className="barras" style={{ marginTop: 8 }}>
                {errores.map(([k, v]) => (
                  <div key={k} className="b"><span>{ERROR_LABEL[k]}</span><Bar value={v / maxErr} label={ERROR_LABEL[k]} /><b className="num">{v}</b></div>
                ))}
              </div>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="t-hist">
            <h2 id="t-hist">Historial</h2>
            {profile.sesiones.length === 0 ? <p className="vacio">Aún no completas ejercicios.</p> : (
              <div className="desplaza">
                <table className="tabla">
                  <thead><tr><th>Fecha</th><th>Ejercicio</th><th>Errores</th><th>Pistas</th><th>Tiempo</th><th>Ánimo</th></tr></thead>
                  <tbody>
                    {[...profile.sesiones].reverse().slice(0, 15).map((s) => (
                      <tr key={s.id}>
                        <td className="num">{new Date(s.fecha).toLocaleDateString('es-PE')}</td>
                        <td>{s.titulo}{s.examen ? <span className="chip" style={{ marginLeft: 6 }}>examen {s.nota}/20</span> : null}<div className="tenue" style={{ fontSize: '.8rem' }}>{NOMBRES[s.algoritmo]}</div></td>
                        <td className="num">{s.errores}</td>
                        <td className="num">{s.pistas}</td>
                        <td className="num">{fmtTiempo(s.duracionSeg)}</td>
                        <td aria-label={`Inicio ${s.animoInicio}, fin ${s.animoFin ?? 'sin registrar'}`}>{icono(s.animoInicio)} → {s.animoFin ? icono(s.animoFin) : '·'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="pila">
          <section className="tarjeta" aria-labelledby="t-yo">
            <h2 id="t-yo">Mis datos</h2>
            <label className="campo">Nombre
              <div className="fila">
                <input className="input" style={{ flex: 1 }} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} />
                <button className="btn chico" disabled={!nombre.trim() || nombre === profile.nombre} onClick={() => update((p) => ({ ...p, nombre: nombre.trim() }))}>Guardar</button>
              </div>
            </label>
            <p className="tenue" style={{ fontSize: '.9rem', margin: '10px 0' }}>Tu perfil se guarda solo en este dispositivo. AlgoCity nunca guarda tu voz: solo el texto de los comandos.</p>
            <div className="fila">
              <button className="btn chico" onClick={descargar}>Descargar mis datos (JSON)</button>
              <button className="btn chico peligro" onClick={() => setBorrar(true)}>Borrar mis datos</button>
            </div>
          </section>

          <section className="tarjeta" aria-labelledby="t-animo">
            <h2 id="t-animo">Cómo me he sentido</h2>
            {profile.animo.historial.length === 0 ? <p className="vacio">Sin registros todavía.</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {[...profile.animo.historial].reverse().slice(0, 8).map((m, k) => (
                  <li key={k} className="fila" style={{ gap: 8 }}>
                    <span aria-hidden="true">{icono(m.animo)}</span>
                    <span><b>{MOODS.find((x) => x.id === m.animo)?.label}</b> <span className="tenue">· {m.fuente === 'inferido' ? 'inferido por la app' : 'lo dijiste tú'} · {m.contexto}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="t-ins">
            <h2 id="t-ins">Insignias</h2>
            <div className="pila">
              {Object.entries(BADGES).map(([k, b]) => {
                const tiene = profile.insignias.includes(k);
                return (
                  <div key={k} className={`insignia${tiene ? '' : ' bloqueada'}`}>
                    <span className="icono" aria-hidden="true">{tiene ? '★' : '?'}</span>
                    <div><b>{b.nombre}</b><span className="sr-only">{tiene ? ' (obtenida)' : ' (por obtener)'}</span><div className="tenue" style={{ fontSize: '.88rem' }}>{b.desc}</div></div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {borrar && (
        <Dialog titulo="¿Borrar todos tus datos?" onClose={() => setBorrar(false)}>
          <p style={{ marginBottom: 16 }}>Se eliminarán tu perfil, tu historial, tus insignias y tus preferencias de este dispositivo. No se puede deshacer. Te recomendamos descargar tus datos antes.</p>
          <div className="fila" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setBorrar(false)}>Cancelar</button>
            <button className="btn peligro" onClick={() => { setProfile(null); go('bienvenida'); }}>Sí, borrar todo</button>
          </div>
        </Dialog>
      )}
    </>
  );
}
