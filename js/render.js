import { solicitud } from './estado.js';
import { calcularCuota, formatearMoneda } from './cotizador.js';
import { validarEquipo, validarTitular, validarPago } from './validaciones.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const fmtNumero = new Intl.NumberFormat('es-AR');
export const formatearValor = (n) => (n ? fmtNumero.format(n) : '');

export const ANTIGUEDAD = { 'menos-1': 'Menos de 1 año', '1-2': '1 a 2 años', 'mas-2': 'Más de 2 años' };

const ETIQUETAS = {
  'equipo.marca': 'Marca', 'equipo.modelo': 'Modelo', 'equipo.valor': 'Valor del equipo', 'equipo.antiguedad': 'Antigüedad',
  'titular.nombre': 'Nombre', 'titular.apellido': 'Apellido', 'titular.dni': 'DNI', 'titular.nacimiento': 'Fecha de nacimiento',
  'titular.email': 'Email', 'titular.celular': 'Celular', 'titular.terminos': 'Términos',
  'pago.tarjeta': 'Número de tarjeta', 'pago.vencimiento': 'Vencimiento', 'pago.cvv': 'CVV', 'pago.titular': 'Titular de la tarjeta',
};

/* ---------- Planes (los carga app.js desde data/planes.json) ---------- */
let planes = [];
let estadoPlanes = 'cargando'; // 'cargando' | 'ok' | 'error'
let claveCards = '';
let ultimoResumen = '';
let pasoAnterior = null;

export function setPlanes(lista, estado = 'ok') {
  planes = lista;
  estadoPlanes = estado;
  claveCards = '';
}
export const planActual = () => planes.find((p) => p.id === solicitud.plan) ?? null;
// Única forma de calcular una cuota en toda la UI: cards, resumen y pantalla de éxito
const cuotaDe = (plan) => (plan ? calcularCuota(solicitud.equipo.valor, plan.tasaAnual, solicitud.equipo.antiguedad) : 0);

/* ---------- Validación por paso ---------- */
const VALIDADORES = { 1: ['equipo', validarEquipo], 3: ['titular', validarTitular], 4: ['pago', validarPago] };

/** Devuelve { 'seccion.campo': mensaje|null } para el paso indicado */
export function erroresDelPaso(n) {
  const def = VALIDADORES[n];
  if (!def) return {};
  const [seccion, validar] = def;
  return Object.fromEntries(Object.entries(validar(solicitud[seccion])).map(([k, v]) => [`${seccion}.${k}`, v]));
}

/* ---------- Render principal ---------- */
export function render() {
  const p = solicitud.paso;
  document.querySelectorAll('[data-paso]').forEach((s) => {
    s.hidden = Number(s.dataset.paso) !== p;
  });

  const checkout = $('#checkout');
  checkout.hidden = p < 1 || p > 4;
  checkout.className = `grid items-start gap-6 pb-44 lg:gap-8 lg:pb-0 ${
    p >= 2 && p <= 4 ? 'lg:grid-cols-[1fr_380px]' : 'mx-auto max-w-3xl'
  }`;

  renderStepper();
  renderResumen();
  renderCampos();
  renderPlanes();
  renderErrores();
  renderBotones();
  renderFinales();

  // Al cambiar de paso el foco va al título (lectores de pantalla + teclado)
  if (pasoAnterior !== null && pasoAnterior !== p) {
    document.querySelector(`[data-paso="${p}"] :is(h1, h2)`)?.focus({ preventScroll: true });
  }
  pasoAnterior = p;
}

/* ---------- Stepper: completo / activo / pendiente (+ error) ---------- */
const PASOS = ['Cotizar', 'Plan', 'Datos', 'Pago'];
const CIRCULO = {
  completo: 'bg-success text-white',
  activo: 'bg-primary text-primary-foreground ring-4 ring-primary/20',
  error: 'bg-error text-white ring-4 ring-error/20',
  pendiente: 'border bg-card text-muted-foreground',
};
const TEXTO = {
  completo: 'text-foreground',
  activo: 'font-semibold text-primary-700',
  error: 'font-semibold text-error',
  pendiente: 'text-muted-foreground',
};

export function renderStepper() {
  const p = solicitud.paso;
  $('#stepper-wrap').hidden = p === 0;
  if (p === 0) return;
  const actual = p === 5 ? 5 : p === 6 ? 4 : p; // 5 = los cuatro pasos completos
  $('#stepper').innerHTML = PASOS.map((nombre, i) => {
    const n = i + 1;
    const estado = n < actual ? 'completo' : n === actual ? (p === 6 ? 'error' : 'activo') : 'pendiente';
    const marca = estado === 'completo' ? '✓' : estado === 'error' ? '!' : n;
    const linea =
      n > 1
        ? `<span aria-hidden="true" class="absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${n <= actual ? 'bg-success' : 'bg-border'}"></span>`
        : '';
    return `<li class="relative flex flex-1 flex-col items-center gap-1.5 text-center" ${
      estado === 'activo' || estado === 'error' ? 'aria-current="step"' : ''
    }>
      ${linea}
      <span class="relative z-10 grid size-8 place-items-center rounded-full text-sm font-bold ${CIRCULO[estado]}">${marca}</span>
      <span class="text-xs ${TEXTO[estado]}">${nombre}<span class="sr-only"> (${estado})</span></span>
    </li>`;
  }).join('');
}

/* ---------- Resumen: se genera UNA sola vez; el CSS lo adapta a mobile/desktop ---------- */
export function renderResumen() {
  const el = $('#resumen');
  const p = solicitud.paso;
  el.hidden = !(p >= 2 && p <= 4);
  if (el.hidden) return;

  const { equipo, titular } = solicitud;
  const plan = planActual();
  const abierto = Boolean(solicitud.ui.resumenAbierto);
  const editable = p === 4; // bonus: "Editar" solo en el paso de pago

  const fila = (etiqueta, contenido, pasoEditar) => `
    <div class="flex items-start justify-between gap-3 py-2.5">
      <dt class="text-xs text-muted-foreground">${etiqueta}</dt>
      <dd class="text-right font-medium">${contenido}${
        editable && pasoEditar
          ? ` <button type="button" data-editar="${pasoEditar}" class="ml-1 text-xs font-semibold text-primary hover:underline">Editar</button>`
          : ''
      }</dd>
    </div>`;
  const sub = (t) => `<span class="block text-xs font-normal text-muted-foreground">${esc(t)}</span>`;

  const nombreTitular = `${titular.nombre} ${titular.apellido}`.trim();
  const html = `
    <h2 class="hidden px-6 pt-5 text-sm font-semibold lg:block">Resumen de tu seguro</h2>
    <div class="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
      <div class="min-w-0">
        <p class="truncate text-xs text-muted-foreground">Total mensual · Plan ${esc(plan?.nombre ?? '—')}</p>
        <p class="text-xl font-extrabold text-primary-700 lg:text-2xl">${formatearMoneda(cuotaDe(plan))}<span class="text-xs font-medium text-muted-foreground"> /mes</span></p>
      </div>
      <button type="button" data-accion="toggle-resumen" aria-expanded="${abierto}" aria-controls="resumen-detalle"
        class="text-sm font-semibold text-primary lg:hidden">${abierto ? 'Ocultar detalle' : 'Ver detalle'}</button>
    </div>
    <dl id="resumen-detalle" class="max-h-[40vh] divide-y overflow-y-auto border-t px-4 text-sm lg:max-h-none lg:px-6 ${abierto ? 'block' : 'hidden'} lg:block">
      ${fila('Seguro', 'Seguro de celular')}
      ${fila('Equipo', `${esc(`${equipo.marca} ${equipo.modelo}`.trim() || '—')}${sub(`Valor ${formatearMoneda(equipo.valor)} · ${ANTIGUEDAD[equipo.antiguedad] ?? '—'}`)}`, 1)}
      ${fila('Plan', `${esc(plan?.nombre ?? '—')}${plan ? sub(plan.coberturas.join(', ')) : ''}`, 2)}
      ${fila('Titular', esc(nombreTitular || '—'), 3)}
    </dl>`;

  if (html !== ultimoResumen) {
    el.innerHTML = html;
    ultimoResumen = html;
  }
}

/* ---------- Inputs: se rellenan SIEMPRE desde el estado (así "Volver" no pierde datos) ---------- */
function renderCampos() {
  document.querySelectorAll('[data-campo]').forEach((el) => {
    const [seccion, campo] = el.dataset.campo.split('.');
    const valor = solicitud[seccion][campo];
    if (el.type === 'radio') el.checked = valor === el.value;
    else if (el.type === 'checkbox') el.checked = Boolean(valor);
    else if (el !== document.activeElement) {
      // el campo que se está escribiendo no se pisa (se perdería el cursor)
      el.value = el.dataset.campo === 'equipo.valor' ? formatearValor(valor) : valor ?? '';
    }
  });
}

/* ---------- Planes ---------- */
const cardPlan = (pl) => `
  <label class="block cursor-pointer">
    <input type="radio" name="plan" value="${esc(pl.id)}" class="peer sr-only">
    <div class="card h-full gap-4 p-5 transition-colors hover:border-primary/60 peer-checked:border-primary peer-checked:bg-primary-50 peer-checked:ring-2 peer-checked:ring-primary/30 peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-lg font-bold">${esc(pl.nombre)}</h3>
        ${pl.recomendado ? '<span class="badge">Recomendado</span>' : ''}
      </div>
      <p class="text-3xl font-extrabold text-primary-700">${formatearMoneda(cuotaDe(pl))}<span class="text-sm font-medium text-muted-foreground"> /mes</span></p>
      <ul class="grid gap-1.5 text-sm">
        ${pl.coberturas.map((c) => `<li class="flex gap-2"><span aria-hidden="true" class="text-success">✓</span>${esc(c)}</li>`).join('')}
      </ul>
    </div>
  </label>`;

function renderPlanes() {
  const cont = $('#planes');
  if (estadoPlanes !== 'ok') {
    claveCards = '';
    cont.innerHTML =
      estadoPlanes === 'error'
        ? `<div class="alert lg:col-span-3" data-variant="destructive" role="alert"><h2>No pudimos cargar los planes</h2><section>Abrí el sitio con un servidor (npm run dev) y recargá la página.</section></div>`
        : '<p class="text-sm text-muted-foreground">Cargando planes…</p>';
    return;
  }
  // Las cards se regeneran solo si cambió la cotización; si no, solo se actualiza el radio elegido
  const { valor, antiguedad } = solicitud.equipo;
  const clave = `${valor}|${antiguedad}`;
  if (clave !== claveCards) {
    claveCards = clave;
    cont.innerHTML = planes.map(cardPlan).join('');
  }
  cont.querySelectorAll('input[name="plan"]').forEach((r) => {
    r.checked = r.value === solicitud.plan;
  });
  const { marca, modelo } = solicitud.equipo;
  $('#plan-lead').textContent = `Cuota mensual para tu ${`${marca} ${modelo}`.trim() || 'equipo'} (valor ${formatearMoneda(valor)}).`;
}

/* ---------- Errores en línea: solo en campos "tocados" ---------- */
function renderErrores() {
  const tocados = solicitud.ui.tocados;
  [1, 3, 4].forEach((n) => {
    Object.entries(erroresDelPaso(n)).forEach(([clave, msg]) => {
      const visible = Boolean(msg && tocados[clave]);
      const p = document.getElementById(`err-${clave.replace('.', '-')}`);
      if (p) {
        const texto = visible ? msg : '';
        if (p.textContent !== texto) p.textContent = texto; // evita re-anunciar el mismo error
        p.hidden = !visible;
      }
      document.querySelectorAll(`[data-campo="${clave}"]`).forEach((el) => {
        el.setAttribute('aria-invalid', String(visible));
        el.closest('.field')?.toggleAttribute('data-invalid', visible);
      });
    });
  });
}

/* ---------- Botones: habilitados por JS + explicación de qué falta ---------- */
function renderBotones() {
  [1, 2, 3, 4].forEach((n) => {
    const form = document.getElementById(`form-${n}`);
    if (!form) return;
    const faltan = Object.entries(erroresDelPaso(n))
      .filter(([, msg]) => msg)
      .map(([clave]) => ETIQUETAS[clave]);
    const procesando = n === 4 && solicitud.ui.procesando;
    const planOk = n !== 2 || (estadoPlanes === 'ok' && Boolean(planActual()));
    const btn = form.querySelector('[data-continuar]');
    btn.disabled = faltan.length > 0 || procesando || !planOk;
    if (n === 4) {
      btn.textContent = procesando ? 'Procesando…' : 'Pagar y contratar';
      btn.setAttribute('aria-busy', String(procesando));
      form.querySelector('[data-accion="volver"]').disabled = procesando;
    }
    const ayuda = form.querySelector('[data-ayuda]');
    const texto = faltan.length && !procesando ? `Para continuar completá: ${faltan.join(', ')}.` : '';
    if (ayuda.textContent !== texto) ayuda.textContent = texto;
  });
}

/* ---------- Pantallas finales ---------- */
function renderFinales() {
  const p = solicitud.paso;
  if (p === 5) {
    const { titular, equipo } = solicitud;
    const plan = planActual();
    $('#ex-nombre').textContent = titular.nombre;
    $('#ex-email').textContent = titular.email;
    $('#ex-poliza').textContent = solicitud.poliza ?? '';
    const filas = [
      ['Titular', `${titular.nombre} ${titular.apellido}`],
      ['Seguro', 'Seguro de celular'],
      ['Equipo', `${equipo.marca} ${equipo.modelo}`],
      ['Plan', plan?.nombre ?? '—'],
      ['Coberturas', plan?.coberturas.join(', ') ?? '—'],
      ['Cuota mensual', formatearMoneda(cuotaDe(plan))],
    ];
    $('#ex-detalle').innerHTML = filas
      .map(([k, v]) => `<div class="flex justify-between gap-4 py-2.5"><dt class="text-muted-foreground">${k}</dt><dd class="text-right font-medium">${esc(v)}</dd></div>`)
      .join('');
  }
  if (p === 6) $('#err-motivo').textContent = solicitud.ui.motivoError || 'No pudimos procesar el pago';
}