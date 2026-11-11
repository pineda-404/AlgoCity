import { useState } from 'react';
import { newProfile } from '@shared/profile';
import { useNav } from '../App';
import { profileFromMock, useStore, USUARIOS_SIMULADOS } from '../state/store';
import { Skyline } from '../components/Skyline';

/** P01 · Bienvenida: entrar como invitado, con un perfil simulado o con un código de sala (RF-01). */
export function Bienvenida({ codigoSala }: { codigoSala?: string }) {
  const { profile, setProfile } = useStore();
  const { go } = useNav();
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<'estudiante' | 'docente'>('estudiante');
  const [simulado, setSimulado] = useState(USUARIOS_SIMULADOS[0]?.id ?? '');
  const [codigo, setCodigo] = useState(codigoSala ?? '');
  const [error, setError] = useState('');

  const empezar = () => {
    setProfile(newProfile(nombre || 'Invitado', rol));
    go('preferencias');
  };

  const usarSimulado = () => {
    const p = profileFromMock(simulado);
    if (!p) return;
    setProfile(p);
    if (p.rol === 'docente') go('sala', 'CLS-2026');
    else go('inicio');
  };

  const unirse = () => {
    const c = codigo.trim().toUpperCase();
    if (!/^[A-Z]{3}-\d{4}$/.test(c)) return setError('El código tiene la forma URB-4821 (tres letras, guion y cuatro números).');
    if (!profile) setProfile(newProfile(nombre || 'Invitado', rol));
    go('sala', c);
  };

  return (
    <>
      <section className="hero">
        <div>
          <div className="letrero">
            <div className="l1">Bienvenida a</div>
            <div className="l2">AlgoCity · CC451 UNI</div>
          </div>
          <h1>Aprende algoritmos recorriendo una ciudad con tu voz</h1>
          <p className="lead">
            Un arreglo es una avenida de edificios, un árbol es un sistema de avenidas y un grafo es una red de metro.
            Tú ejecutas cada paso diciendo “intercambia”, “izquierda” o “visita B”; el Arquitecto Jefe te explica cada
            embotellamiento y la app recuerda en qué fallas para prepararte tus próximos retos.
          </p>
          {profile ? (
            <div className="fila">
              <button className="btn prim" onClick={() => go(codigoSala ? 'sala' : 'inicio', codigoSala)}>Continuar como {profile.nombre}</button>
              <button className="btn fantasma" onClick={() => setProfile(null)}>Usar otro perfil</button>
            </div>
          ) : (
            <div className="pila" style={{ maxWidth: 520 }}>
              <label className="campo">
                ¿Cómo te llamamos? <span className="tenue" style={{ fontWeight: 400 }}>(opcional)</span>
                <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Invitado" maxLength={40} autoComplete="given-name" />
              </label>
              <div role="radiogroup" aria-label="Rol" className="opciones">
                {(['estudiante', 'docente'] as const).map((r) => (
                  <label key={r} className="opcion">
                    <input type="radio" name="rol" checked={rol === r} onChange={() => setRol(r)} />
                    <span>{r === 'estudiante' ? 'Soy estudiante' : 'Soy docente'}</span>
                  </label>
                ))}
              </div>
              <div className="fila">
                <button className="btn prim" onClick={empezar}>Empezar</button>
              </div>
              <p className="tenue" style={{ fontSize: '.9rem' }}>Tu perfil se guarda solo en este dispositivo. Nunca guardamos tu voz: solo el texto de los comandos.</p>
            </div>
          )}
        </div>
        <div className="skyline" aria-hidden="true">
          <Skyline sesiones={demoSesiones} alto={320} />
        </div>
      </section>

      <div className="rejilla" style={{ marginTop: 28 }}>
        <section className="tarjeta" aria-labelledby="t-sala">
          <h2 id="t-sala">Tengo un código de sala</h2>
          <p className="tenue" style={{ marginBottom: 10 }}>Únete a la sala de tu clase o de tus compañeros.</p>
          <div className="fila">
            <label className="sr-only" htmlFor="codigo">Código de sala</label>
            <input id="codigo" className="input" style={{ flex: 1, textTransform: 'uppercase' }} value={codigo} onChange={(e) => { setCodigo(e.target.value); setError(''); }} placeholder="URB-4821" maxLength={8} />
            <button className="btn" onClick={unirse}>Unirme</button>
          </div>
          {error && <p role="alert" style={{ color: 'var(--coral)', marginTop: 8 }}>{error}</p>}
        </section>
        <section className="tarjeta" aria-labelledby="t-sim">
          <h2 id="t-sim">Probar con un perfil simulado</h2>
          <p className="tenue" style={{ marginBottom: 10 }}>Perfiles de <code>data/mock</code> con historial, errores y preferencias de accesibilidad.</p>
          <div className="fila">
            <label className="sr-only" htmlFor="sim">Perfil simulado</label>
            <select id="sim" className="input" style={{ flex: 1 }} value={simulado} onChange={(e) => setSimulado(e.target.value)}>
              {USUARIOS_SIMULADOS.map((u) => <option key={u.id} value={u.id}>{u.nombre} — {u.nota}</option>)}
            </select>
            <button className="btn" onClick={usarSimulado}>Usar</button>
          </div>
        </section>
      </div>
    </>
  );
}

const demoSesiones = Array.from({ length: 9 }, (_, k) => ({
  id: `d${k}`, fecha: '', algoritmo: (['bubble', 'merge', 'quick', 'bst', 'bfs', 'dijkstra'] as const)[k % 6], ejercicio: '', titulo: '',
  pasos: 6 + k * 5, errores: k % 3, pistas: 0, retrocesos: 0, duracionSeg: 0, completado: true, examen: k === 4, nota: null,
  animoInicio: 'normal' as const, animoFin: null, erroresPorTipo: {},
}));
