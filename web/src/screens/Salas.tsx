import { useEffect, useState } from 'react';
import { CATALOGO, NOMBRES } from '@shared/exercises';
import type { AlgorithmId } from '@shared/types';
import { useNav } from '../App';
import { useStore } from '../state/store';
import { emitAck } from '../net/socket';

interface SalaInfo {
  codigo: string;
  nombre: string;
  modo: 'cooperativo' | 'duelo' | 'clase';
  algoritmo: AlgorithmId;
  ejercicio: string;
  participantes: number;
  capacidad: number;
}

export const MODO: Record<SalaInfo['modo'], { nombre: string; desc: string }> = {
  cooperativo: { nombre: 'Cooperativa', desc: 'Una sola ciudad para todo el equipo, con turnos que se piden por voz.' },
  duelo: { nombre: 'Duelo', desc: 'Dos urbanistas resuelven la misma ciudad: gana quien termina primero con menos errores.' },
  clase: { nombre: 'Clase', desc: 'El docente asigna un ejercicio y ve en vivo el progreso y los errores del grupo.' },
};

/** P08 · Salas: unirse por lista o código y crear salas cooperativas, de duelo o de clase (RF-16, RF-21). */
export function Salas() {
  const { profile } = useStore();
  const { go, practica, route } = useNav();
  const [salas, setSalas] = useState<SalaInfo[] | null>(null);
  const [error, setError] = useState('');
  const [codigo, setCodigo] = useState('');
  const conActual = route.param === 'actual' && practica;
  const [modo, setModo] = useState<SalaInfo['modo']>(profile?.rol === 'docente' ? 'clase' : conActual ? 'duelo' : 'cooperativo');
  const [nombre, setNombre] = useState(profile?.rol === 'docente' ? 'Práctica de Algoritmos' : `Ciudad de ${profile?.nombre ?? 'invitado'}`);
  const [ejercicio, setEjercicio] = useState(conActual ? 'actual' : 'e01');
  const [creando, setCreando] = useState(false);

  const cargar = () =>
    fetch('/api/salas')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: SalaInfo[]) => { setSalas(d); setError(''); })
      .catch(() => setError('No hay conexión con el servidor de salas. Inicia la app con "npm run dev" o "npm start".'));

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 8000);
    return () => clearInterval(t);
  }, []);

  if (!profile) return null;
  const usuario = { id: profile.id, nombre: profile.nombre, rol: profile.rol };

  const crear = async () => {
    const ex = ejercicio === 'actual' && practica ? practica.exercise : CATALOGO.find((e) => e.id === ejercicio);
    if (!ex) return;
    setCreando(true);
    const r = await emitAck('sala:crear', { modo, nombre, ejercicio: ex, usuario });
    setCreando(false);
    if (r.ok && r.codigo) go('sala', r.codigo);
    else setError(r.error ?? 'No se pudo crear la sala.');
  };

  return (
    <>
      <h1 style={{ fontSize: 'clamp(1.7rem,3.4vw,2.5rem)', marginBottom: 6 }}>Salas</h1>
      <p className="tenue" style={{ marginBottom: 18 }}>Construye en equipo, reta a un compañero o sigue la clase de tu docente.</p>
      {error && <div className="aviso" role="alert">{error}</div>}
      <div className="dos">
        <div className="pila">
          <section className="tarjeta" aria-labelledby="t-lista">
            <div className="fila" style={{ justifyContent: 'space-between' }}>
              <h2 id="t-lista">Salas abiertas</h2>
              <button className="btn chico fantasma" onClick={cargar}>Actualizar</button>
            </div>
            {salas === null && !error && <p className="tenue">Cargando…</p>}
            {salas?.length === 0 && <p className="vacio">No hay salas abiertas. ¡Crea la primera!</p>}
            <div className="pila" style={{ marginTop: 8 }}>
              {salas?.map((s) => (
                <button key={s.codigo} className="ejercicio-btn" onClick={() => go('sala', s.codigo)} disabled={s.participantes >= s.capacidad && s.modo !== 'clase'}>
                  <span>
                    <b>{s.nombre}</b>
                    <span className="tenue" style={{ display: 'block', fontSize: '.88rem' }}>{MODO[s.modo].nombre} · {NOMBRES[s.algoritmo]} · {s.ejercicio}</span>
                  </span>
                  <span className="fila" style={{ gap: 6 }}>
                    <span className="chip mono">{s.codigo}</span>
                    <span className="chip num">{s.participantes}/{s.capacidad}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="tarjeta" aria-labelledby="t-cod">
            <h2 id="t-cod">Unirme con código</h2>
            <div className="fila">
              <label className="sr-only" htmlFor="cod">Código</label>
              <input id="cod" className="input mono" style={{ flex: 1, textTransform: 'uppercase' }} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="URB-4821" maxLength={8} />
              <button className="btn" onClick={() => codigo.trim() && go('sala', codigo.trim().toUpperCase())}>Unirme</button>
            </div>
          </section>
        </div>

        <section className="tarjeta" aria-labelledby="t-crear">
          <h2 id="t-crear">Crear una sala</h2>
          <div className="pila">
            <fieldset>
              <legend>Modo</legend>
              <div className="pila">
                {(Object.keys(MODO) as SalaInfo['modo'][]).map((m) => (
                  <label key={m} className="interruptor" style={{ justifyContent: 'flex-start' }}>
                    <input type="radio" name="modo" checked={modo === m} onChange={() => setModo(m)} />
                    <span><b>{MODO[m].nombre}</b> — <span className="tenue">{MODO[m].desc}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="campo">Nombre de la sala<input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} /></label>
            <label className="campo">
              Ejercicio
              <select className="input" value={ejercicio} onChange={(e) => setEjercicio(e.target.value)}>
                {conActual && <option value="actual">El que acabo de hacer: {practica!.exercise.titulo}</option>}
                {CATALOGO.map((e) => <option key={e.id} value={e.id}>{NOMBRES[e.algoritmo]} · {e.titulo}</option>)}
              </select>
            </label>
            <button className="btn prim" onClick={crear} disabled={creando || !!error}>{creando ? 'Creando…' : 'Crear y entrar'}</button>
          </div>
        </section>
      </div>
    </>
  );
}
