import '../src/style.css';
import { solicitud, setCampo, setPlan, marcarTocado, irAPaso, editarDesdeResumen, reiniciar } from './estado.js';
import { render, setPlanes, erroresDelPaso, formatearValor } from './render.js';
import { hayErrores, primerCampoConError, soloDigitos } from './validaciones.js';
import { parsearNumero, verificarCasos } from './cotizador.js';
import { simularPago, generarPoliza } from './pago.js';

/* ---------- Datos: planes desde data/planes.json ---------- */
async function cargarPlanes() {
  try {
    const res = await fetch('data/planes.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setPlanes(await res.json());
  } catch (err) {
    console.error('No se pudieron cargar los planes:', err);
    setPlanes([], 'error');
  }
}

/* ---------- Máscaras de input (bonus) ---------- */
const MASCARAS = {
  'equipo.valor': (v) => soloDigitos(v).slice(0, 9),
  'titular.dni': (v) => soloDigitos(v).slice(0, 8),
  'pago.tarjeta': (v) => soloDigitos(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '), // grupos de 4
  'pago.vencimiento': (v, borrando) => {
    const d = soloDigitos(v).slice(0, 4);
    return d.length > 2 || (d.length === 2 && !borrando) ? `${d.slice(0, 2)}/${d.slice(2)}` : d; // MM/AA
  },
  'pago.cvv': (v) => soloDigitos(v).slice(0, 3),
};

/* ---------- Limpieza de texto: nombres sin números ni símbolos ---------- */
const limpiarNombre = (v) =>
  v.replace(/[^\p{L}\s'’-]/gu, '').replace(/^\s+/, '').replace(/\s{2,}/g, ' ').slice(0, 40);

const LIMPIEZAS = {
  'titular.nombre': limpiarNombre,
  'titular.apellido': limpiarNombre,
  'pago.titular': limpiarNombre,
};
// Al salir del campo se recortan espacios sobrantes
const TRIMEAR = new Set([...Object.keys(LIMPIEZAS), 'titular.email', 'equipo.modelo']);

function limpiarTexto(el, limpiar) {
  const previo = el.value;
  const pos = el.selectionStart ?? previo.length;
  const nuevo = limpiar(previo);
  if (nuevo === previo) return;
  el.value = nuevo;
  const p = Math.max(0, pos - (previo.length - nuevo.length));
  el.setSelectionRange?.(p, p);
}

/** En mobile el detalle del resumen se contrae solo para no tapar el formulario */
function cerrarResumen() {
  if (!solicitud.ui.resumenAbierto) return;
  solicitud.ui.resumenAbierto = false;
  render();
}

/** Aplica la máscara sin mandar el cursor siempre al final */
function aplicarMascara(el, formatear, borrando) {
  const previo = el.value;
  const pos = el.selectionStart ?? previo.length;
  const digitosAntes = soloDigitos(previo.slice(0, pos)).length;
  const alFinal = pos >= previo.length;
  el.value = formatear(previo, borrando);
  let nueva = el.value.length;
  if (!alFinal) {
    nueva = 0;
    let cuenta = 0;
    for (let i = 0; i < el.value.length && cuenta < digitosAntes; i++) {
      if (/\d/.test(el.value[i])) cuenta++;
      nueva = i + 1;
    }
  }
  el.setSelectionRange?.(nueva, nueva);
}

function leer(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.dataset.campo === 'equipo.valor') return parsearNumero(el.value); // "600.000" → 600000
  return el.value;
}

/* ---------- Eventos (delegación: un solo listener por tipo) ---------- */
function onInput(e) {
  const el = e.target;
  const k = el.dataset?.campo;
  if (!k || el.type === 'radio' || el.type === 'checkbox') return;
  if (MASCARAS[k]) aplicarMascara(el, MASCARAS[k], e.inputType?.startsWith('delete'));
  if (LIMPIEZAS[k]) limpiarTexto(el, LIMPIEZAS[k]);
  const [seccion, campo] = k.split('.');
  setCampo(seccion, campo, leer(el));
  render();
}

function onChange(e) {
  const el = e.target;
  if (el.name === 'plan') {
    setPlan(el.value);
    return render();
  }
  const k = el.dataset?.campo;
  if (!k) return;
  if (el.type === 'radio' || el.type === 'checkbox' || el.tagName === 'SELECT') {
    const [seccion, campo] = k.split('.');
    setCampo(seccion, campo, leer(el));
    marcarTocado(k);
    render();
  }
}

// Validación en blur: el error aparece al salir del campo, no mientras se escribe
function onBlur(e) {
  const el = e.target;
  const k = el.dataset?.campo;
  if (!k || el.type === 'radio' || el.type === 'checkbox') return;
  if (TRIMEAR.has(k)) {
    const [seccion, campo] = k.split('.');
    el.value = el.value.trim();
    setCampo(seccion, campo, el.value);
  }
  marcarTocado(k);
  if (k === 'equipo.valor') el.value = formatearValor(solicitud.equipo.valor);
  render();
}

function onClick(e) {
  // Tocar fuera del resumen lo contrae (mobile)
  if (!e.target.closest('#resumen')) cerrarResumen();

  const el = e.target.closest('[data-accion], [data-editar]');
  if (!el) return;
  if (el.dataset.editar) {
    solicitud.ui.resumenAbierto = false;
    return editarDesdeResumen(Number(el.dataset.editar));
  }

  switch (el.dataset.accion) {
    case 'iniciar':
      return irAPaso(1);
    case 'volver':
      return volver();
    case 'reintentar':
      irAPaso(4);
      return document.getElementById('btn-pagar')?.focus();
    case 'cambiar-medio':
      irAPaso(4);
      return document.querySelector('[data-campo="pago.metodo"]:checked')?.focus();
    case 'reiniciar':
      return reiniciar();
    case 'toggle-resumen':
      solicitud.ui.resumenAbierto = !solicitud.ui.resumenAbierto;
      render();
      return document.querySelector('[data-accion="toggle-resumen"]')?.focus();
    case 'tema':
      return alternarTema(el);
  }
}

async function onSubmit(e) {
  e.preventDefault(); // el formulario nunca recarga la página
  const n = Number(e.target.id.replace('form-', ''));

  // Se revalida todo el paso al intentar avanzar
  const errores = erroresDelPaso(n);
  if (hayErrores(errores)) {
    Object.keys(errores).forEach((k) => marcarTocado(k));
    render();
    document.querySelector(`[data-campo="${primerCampoConError(errores)}"]`)?.focus();
    return;
  }
  if (n === 4) return pagar();
  avanzar(n);
}

/* ---------- Navegación ---------- */
function volver() {
  solicitud.ui.volverAPago = false; // cancela el modo "Editar"
  irAPaso(Math.max(0, solicitud.paso - 1));
}

function avanzar(desde) {
  let destino = desde + 1;
  if (solicitud.ui.volverAPago) {
    destino = 4; // bonus Editar: después de corregir, vuelve directo al pago
    solicitud.ui.volverAPago = false;
  }
  irAPaso(destino);
}

/* ---------- Pago ---------- */
async function pagar() {
  if (solicitud.ui.procesando) return; // evita el doble click / doble Enter
  solicitud.ui.procesando = true;
  render(); // botón → "Procesando…" y deshabilitado

  let resultado;
  try {
    resultado = await simularPago(solicitud.pago.tarjeta);
  } catch {
    resultado = { ok: false, motivo: 'No pudimos conectar con el medio de pago' };
  }
  solicitud.ui.procesando = false;

  if (resultado.ok) {
    solicitud.poliza = generarPoliza();
    irAPaso(5); // al llegar a éxito se limpia el localStorage
    mostrarToast({
      category: 'success',
      title: '¡Pago aprobado!',
      description: `Tu póliza ${solicitud.poliza} ya está activa.`,
      duration: 6000,
    });
  } else {
    solicitud.ui.motivoError = resultado.motivo;
    irAPaso(6); // los datos quedan en el estado: "Reintentar" los conserva
  }
}

function mostrarToast(config) {
  const toaster = document.getElementById('toaster');
  // 1) API del toaster de Basecoat  2) evento basecoat:toast como alternativa
  if (typeof toaster?.toast === 'function') toaster.toast(config);
  else document.dispatchEvent(new CustomEvent('basecoat:toast', { detail: { config } }));

  // Plan B: si Basecoat no creó ningún toast, se avisa con uno propio
  setTimeout(() => {
    if (toaster?.querySelector('.toast')) return;
    console.warn('Basecoat no mostró el toast: se usa el aviso propio.');
    const aviso = document.createElement('div');
    aviso.setAttribute('role', 'status');
    aviso.className = 'fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border bg-card p-4 shadow-lg';
    const titulo = document.createElement('p');
    titulo.className = 'font-semibold';
    titulo.textContent = config.title;
    const detalle = document.createElement('p');
    detalle.className = 'text-sm text-muted-foreground';
    detalle.textContent = config.description;
    aviso.append(titulo, detalle);
    document.body.append(aviso);
    setTimeout(() => aviso.remove(), config.duration ?? 4000);
  }, 400);
}

/* ---------- Modo oscuro (bonus): clase .dark en <html>, como Basecoat ---------- */
function alternarTema(boton) {
  const oscuro = document.documentElement.classList.toggle('dark');
  try {
    localStorage.setItem('themeMode', oscuro ? 'dark' : 'light');
  } catch { /* sin storage */ }
  boton.setAttribute('aria-pressed', String(oscuro));
}

/* ---------- Arranque ---------- */
async function init() {
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('focusout', onBlur);
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('focusin', (e) => { if (!e.target.closest('#resumen')) cerrarResumen(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarResumen(); });
  window.addEventListener('scroll', cerrarResumen, { passive: true });

  document
    .querySelector('[data-accion="tema"]')
    ?.setAttribute('aria-pressed', String(document.documentElement.classList.contains('dark')));

  if (import.meta.env.DEV) verificarCasos(); // console.assert: silencioso si todo está bien

  render(); // primer pintado (los planes todavía cargan)
  await cargarPlanes();
  render();
}

init();