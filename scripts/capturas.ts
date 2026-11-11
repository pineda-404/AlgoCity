/**
 * Prueba de punta a punta + capturas para el informe (docs/img/pc03).
 * Recorre la app real en Chrome: resuelve los 6 algoritmos con comandos de texto
 * (los mismos que se dicen por voz), prueba errores, pistas, salas y panel docente.
 *
 *   npm run build && npm start          # en otra terminal
 *   CHROME_PATH=/ruta/a/chrome npm run capturas
 */
import { chromium, type Page } from 'playwright-core';
import { ENGINES, solve, describeAction } from '../shared/engines';
import { CATALOGO } from '../shared/exercises';

const BASE = process.env.BASE_URL ?? 'http://localhost:3001';
const OUT = 'docs/img/pc03';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const errores: string[] = [];

async function nueva(b: Awaited<ReturnType<typeof chromium.launch>>, w = 1366, h = 900) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && errores.push(`console: ${m.text()}`));
  return p;
}

async function entrar(p: Page, nombre: string, rol: 'estudiante' | 'docente' = 'estudiante') {
  await p.goto(`${BASE}/#/bienvenida`);
  await p.fill('input[autocomplete="given-name"]', nombre);
  if (rol === 'docente') await p.check('input[name=rol] >> nth=1');
  await p.click('button:has-text("Empezar")');
  await p.click('text=Guardar y entrar a mi ciudad');
}

async function comando(p: Page, texto: string) {
  await p.fill('#cmd-texto', texto);
  await p.press('#cmd-texto', 'Enter');
  await p.waitForTimeout(60);
}

async function shot(p: Page, nombre: string, full = false) {
  await p.waitForTimeout(350);
  await p.screenshot({ path: `${OUT}/${nombre}.png`, fullPage: full });
  console.log('  📸', nombre);
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await nueva(b);

  console.log('P01–P03');
  await p.goto(BASE);
  await shot(p, 'P01_bienvenida');
  await p.fill('input[autocomplete="given-name"]', 'Andre');
  await p.click('button:has-text("Empezar")');
  await shot(p, 'P02_preferencias', true);
  await p.click('text=Guardar y entrar a mi ciudad');
  await p.click('text=Con ganas');
  await shot(p, 'P03_mi_ciudad_vacia');

  console.log('P04 catálogo');
  await p.click('nav >> text=Algoritmos');
  await shot(p, 'P04_catalogo', true);

  // Resuelve un ejercicio de cada algoritmo desde la interfaz.
  const ids = ['e01', 'e09', 'e10', 'e05', 'e12', 'e07'];
  for (const id of ids) {
    const ex = CATALOGO.find((e) => e.id === id)!;
    const eng = ENGINES[ex.algoritmo];
    console.log(`Resolviendo ${ex.titulo} (${ex.algoritmo})`);
    await p.goto(`${BASE}/#/catalogo`);
    await p.click(`button.ejercicio-btn:has-text("${ex.titulo}")`);
    await p.waitForSelector('#cmd-texto');
    const acciones = solve(eng, eng.init(ex));
    // Un error a propósito al inicio para mostrar el "embotellamiento"
    const malo = { swap: 'avanza', skip: 'intercambia', left: 'derecha', right: 'izquierda', visit: 'visita ' + (ex.grafo?.nodos.at(-1) ?? '') }[acciones[0].kind];
    await comando(p, malo);
    if (id === 'e01') await shot(p, 'P05_bubble_error');
    if (id === 'e07') await shot(p, 'P05_dijkstra_error');
    await comando(p, 'dame una pista');
    await p.waitForTimeout(400);
    if (id === 'e01') {
      await comando(p, 'dame una pista');
      await p.waitForTimeout(400);
      await shot(p, 'P05_bubble_pistas');
    }
    const mitad = Math.floor(acciones.length / 2);
    for (let k = 0; k < acciones.length; k++) {
      await comando(p, describeAction(acciones[k]));
      if (k === mitad) await shot(p, `P05_${ex.algoritmo}`);
      if (id === 'e01' && k === 2) {
        await comando(p, 'retrocede el tiempo');
        await comando(p, describeAction(acciones[k]));
      }
    }
    await p.waitForURL(/resumen/, { timeout: 8000 });
    if (id === 'e01') await shot(p, 'P07_resumen', true);
  }

  console.log('Ayuda, confirmación y comando no válido');
  await p.goto(`${BASE}/#/catalogo`);
  await p.click('button.ejercicio-btn:has-text("Barrios por fusionar")');
  await comando(p, 'hola qué tal');
  await comando(p, '¿qué puedo decir?');
  await shot(p, 'P06_que_puedo_decir');
  await p.keyboard.press('Escape');
  await comando(p, '¿por qué en merge sort basta mirar el frente de cada barrio?');
  await p.waitForTimeout(600);
  await shot(p, 'P05_merge_pregunta');
  await comando(p, 'estoy frustrado');
  await p.waitForTimeout(300);
  await shot(p, 'P05_frustracion_modo_calma');

  console.log('Mi ciudad y perfil con progreso');
  await p.goto(`${BASE}/#/inicio`);
  await shot(p, 'P03_mi_ciudad', true);
  await p.goto(`${BASE}/#/perfil`);
  await shot(p, 'P10_perfil', true);

  console.log('Modo examen');
  await p.goto(`${BASE}/#/catalogo`);
  await p.check('label.interruptor input[type=checkbox]');
  await p.click('button.ejercicio-btn:has-text("Primer pivote")');
  await shot(p, 'P05_examen');

  console.log('Sala cooperativa con dos estudiantes');
  const q = await nueva(b);
  await entrar(q, 'Luis');
  await p.goto(`${BASE}/#/salas`);
  await shot(p, 'P08_salas', true);
  await p.click('button:has-text("Crear y entrar")');
  await p.waitForURL(/#\/sala\//);
  const codigo = decodeURIComponent(p.url().split('/sala/')[1]);
  await q.goto(`${BASE}/#/sala/${codigo}`);
  await q.waitForSelector('#cmd-texto');
  await comando(q, 'avanza'); // no es su turno
  await comando(p, 'avanza');
  await comando(q, 'pido turno');
  await comando(p, 'intercambia');
  await p.waitForTimeout(500);
  await comando(q, 'avanza');
  await p.waitForTimeout(500);
  await shot(p, 'P09_sala_cooperativa');
  await shot(q, 'P09_sala_cooperativa_otro');

  console.log('Panel docente (clase de demostración con estudiantes simulados)');
  const d = await nueva(b);
  await entrar(d, 'Prof. Núñez', 'docente');
  await d.goto(`${BASE}/#/sala/CLS-2026`);
  await d.waitForSelector('text=Panel docente');
  await q.goto(`${BASE}/#/sala/CLS-2026`);
  await q.waitForSelector('#cmd-texto');
  await comando(q, 'derecha');
  await comando(q, 'izquierda');
  await d.waitForTimeout(800);
  await shot(d, 'P11_panel_docente', true);

  console.log('Móvil, alto contraste y modo oscuro');
  const m = await nueva(b, 390, 844);
  await entrar(m, 'Ana');
  await m.goto(`${BASE}/#/catalogo`);
  await m.click('button.ejercicio-btn:has-text("Red de metro")');
  await comando(m, 'visita a');
  await shot(m, 'movil_P05_bfs', true);
  await m.goto(`${BASE}/#/perfil`);
  await m.click('header >> text=Contraste');
  await m.goto(`${BASE}/#/catalogo`);
  await m.click('button.ejercicio-btn:has-text("Sistema de avenidas")');
  await shot(m, 'movil_alto_contraste');

  const o = await b.newContext({ viewport: { width: 1366, height: 900 }, colorScheme: 'dark' });
  const op = await o.newPage();
  await op.goto(BASE);
  await op.fill('input[autocomplete="given-name"]', 'Diego');
  await op.click('button:has-text("Empezar")');
  await op.click('text=Guardar y entrar a mi ciudad');
  await op.goto(`${BASE}/#/catalogo`);
  await op.click('button.ejercicio-btn:has-text("Avenida pivote")');
  await comando(op, 'izquierda');
  await comando(op, 'derecha');
  await shot(op, 'P05_quick_oscuro');

  await b.close();
  if (errores.length) {
    console.error('\nErrores en el navegador:\n' + errores.join('\n'));
    process.exit(1);
  }
  console.log('\n✅ Recorrido completo sin errores en consola');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
