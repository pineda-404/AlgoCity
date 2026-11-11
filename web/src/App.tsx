import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Exercise } from '@shared/types';
import type { TextSize } from '@shared/profile';
import { useStore } from './state/store';
import { Logo } from './components/ui';
import { health, setConsent, type Health } from './llm/client';
import type { PracticeResult } from './practice/usePractice';
import { Bienvenida } from './screens/Bienvenida';
import { Preferencias } from './screens/Preferencias';
import { Inicio } from './screens/Inicio';
import { Catalogo } from './screens/Catalogo';
import { Practica } from './screens/Practica';
import { Resumen } from './screens/Resumen';
import { Salas } from './screens/Salas';
import { Sala } from './screens/Sala';
import { Perfil } from './screens/Perfil';

export interface Route {
  name: 'bienvenida' | 'preferencias' | 'inicio' | 'catalogo' | 'practica' | 'resumen' | 'salas' | 'sala' | 'perfil';
  param?: string;
}

function parse(hash: string): Route {
  const [name, param] = hash.replace(/^#\/?/, '').split('/');
  const valid: Route['name'][] = ['bienvenida', 'preferencias', 'inicio', 'catalogo', 'practica', 'resumen', 'salas', 'sala', 'perfil'];
  return valid.includes(name as Route['name']) ? { name: name as Route['name'], param: param ? decodeURIComponent(param) : undefined } : { name: 'inicio' };
}

interface Nav {
  route: Route;
  go: (name: Route['name'], param?: string) => void;
  practica: { exercise: Exercise; examen: boolean } | null;
  startPractice: (exercise: Exercise, examen?: boolean) => void;
  resultado: PracticeResult | null;
  setResultado: (r: PracticeResult | null) => void;
  red: Health | null;
}

const NavCtx = createContext<Nav | null>(null);
export const useNav = () => {
  const n = useContext(NavCtx);
  if (!n) throw new Error('Nav no montado');
  return n;
};

const SS = 'algocity.sesion';
function loadSS<T>(k: string): T | null {
  try {
    return JSON.parse(sessionStorage.getItem(`${SS}.${k}`) ?? 'null') as T | null;
  } catch {
    return null;
  }
}
function saveSS(k: string, v: unknown) {
  try {
    sessionStorage.setItem(`${SS}.${k}`, JSON.stringify(v));
  } catch {
    /* sin almacenamiento */
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<any> };

export function App() {
  const { profile, update } = useStore();
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  const [practica, setPractica] = useState<Nav['practica']>(() => loadSS('practica'));
  const [resultado, setResultadoState] = useState<PracticeResult | null>(() => loadSS('resultado'));
  const [red, setRed] = useState<Health | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [instalar, setInstalar] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const check = () => health(true).then(setRed);
    check();
    const up = () => {
      setOnline(navigator.onLine);
      check();
    };
    window.addEventListener('online', up);
    window.addEventListener('offline', up);
    const t = setInterval(check, 30000);
    const bip = (e: Event) => {
      e.preventDefault();
      setInstalar(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', bip);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', up);
      window.removeEventListener('beforeinstallprompt', bip);
      clearInterval(t);
    };
  }, []);

  useEffect(() => setConsent(profile?.prefs.consentimientoLLM ?? true), [profile?.prefs.consentimientoLLM]);

  const go = useCallback((name: Route['name'], param?: string) => {
    const h = `#/${name}${param ? `/${encodeURIComponent(param)}` : ''}`;
    if (location.hash !== h) location.hash = h;
    else setRoute(parse(h));
    window.scrollTo({ top: 0 });
  }, []);

  const startPractice = useCallback((exercise: Exercise, examen = false) => {
    const p = { exercise, examen };
    setPractica(p);
    saveSS('practica', p);
    go('practica');
  }, [go]);

  const setResultado = useCallback((r: PracticeResult | null) => {
    setResultadoState(r);
    saveSS('resultado', r);
  }, []);

  // Sin perfil solo se puede ver la bienvenida (o entrar directo a una sala por enlace).
  const efectiva: Route = !profile && route.name !== 'bienvenida' ? { name: 'bienvenida', param: route.name === 'sala' ? route.param : undefined } : route;

  // Mueve el foco al título de cada pantalla para lectores de pantalla.
  useEffect(() => {
    const h = document.querySelector<HTMLElement>('main h1');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    const titulos: Record<string, string> = { bienvenida: 'Bienvenida', preferencias: 'Tu forma de aprender', inicio: 'Mi ciudad', catalogo: 'Catálogo', practica: 'Práctica', resumen: 'Resumen', salas: 'Salas', sala: 'Sala', perfil: 'Mi perfil' };
    document.title = `${titulos[efectiva.name]} · AlgoCity`;
  }, [efectiva.name, efectiva.param]);

  const nav = useMemo<Nav>(() => ({ route: efectiva, go, practica, startPractice, resultado, setResultado, red }), [efectiva, go, practica, startPractice, resultado, setResultado, red]);

  const tam: TextSize[] = ['normal', 'grande', 'muy-grande'];
  const cambiarTexto = (d: number) => update((p) => ({ ...p, prefs: { ...p.prefs, texto: tam[Math.max(0, Math.min(2, tam.indexOf(p.prefs.texto) + d))] } }));

  let pantalla: ReactNode;
  switch (efectiva.name) {
    case 'bienvenida': pantalla = <Bienvenida codigoSala={efectiva.param} />; break;
    case 'preferencias': pantalla = <Preferencias />; break;
    case 'inicio': pantalla = <Inicio />; break;
    case 'catalogo': pantalla = <Catalogo algoritmo={efectiva.param} />; break;
    case 'practica': pantalla = <Practica />; break;
    case 'resumen': pantalla = <Resumen />; break;
    case 'salas': pantalla = <Salas />; break;
    case 'sala': pantalla = <Sala codigo={efectiva.param ?? ''} />; break;
    case 'perfil': pantalla = <Perfil />; break;
  }

  const enlaces: [Route['name'], string][] = [['inicio', 'Mi ciudad'], ['catalogo', 'Algoritmos'], ['salas', 'Salas'], ['perfil', 'Mi perfil']];
  const sinRed = !online || (red && !red.online);

  return (
    <NavCtx.Provider value={nav}>
      <a className="saltar" href="#contenido">Saltar al contenido</a>
      <div className="app">
        <header className="barra">
          <a className="marca" href={profile ? '#/inicio' : '#/bienvenida'} aria-label="AlgoCity, ir a mi ciudad">
            <Logo />
            <b>AlgoCity</b>
          </a>
          {profile && (
            <nav className="nav" aria-label="Principal">
              {enlaces.map(([n, l]) => (
                <a key={n} href={`#/${n}`} aria-current={efectiva.name === n || (n === 'salas' && efectiva.name === 'sala') ? 'page' : undefined}>{l}</a>
              ))}
            </nav>
          )}
          <div className="barra-der">
            {profile && (
              <>
                <button className="ctrl" onClick={() => cambiarTexto(-1)} aria-label="Reducir tamaño de texto">A−</button>
                <button className="ctrl" onClick={() => cambiarTexto(1)} aria-label="Aumentar tamaño de texto">A+</button>
                <button className="ctrl" aria-pressed={profile.prefs.contraste === 'alto'} onClick={() => update((p) => ({ ...p, prefs: { ...p.prefs, contraste: p.prefs.contraste === 'alto' ? 'estandar' : 'alto' } }))}>Contraste</button>
              </>
            )}
            {instalar && (
              <button className="ctrl" onClick={async () => { await instalar.prompt(); setInstalar(null); }}>Instalar app</button>
            )}
            <span className="estado-red" title={red?.cadena.join(' → ')}>
              <span className={`punto ${sinRed ? 'off' : 'on'}`} aria-hidden="true" />
              {sinRed ? 'Sin conexión' : red?.conModelo ? 'IA conectada' : 'En línea'}
            </span>
          </div>
        </header>
        {sinRed && (
          <div className="aviso" role="status">
            <b>Modo sin conexión.</b> Puedes practicar todos los ejercicios; el Arquitecto Jefe usa respuestas predefinidas y las salas no están disponibles.
          </div>
        )}
        <main id="contenido">{pantalla}</main>
      </div>
    </NavCtx.Provider>
  );
}
