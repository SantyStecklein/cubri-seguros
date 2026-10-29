import { render } from './render.js';

const CLAVE = 'cubri:solicitud';

const crearInicial = () => ({
  paso: 0, // 0 = inicio, 1..4 = checkout, 5 = éxito, 6 = error
  equipo: { marca: '', modelo: '', valor: 0, antiguedad: '' },
  plan: 'plus',
  titular: { nombre: '', apellido: '', dni: '', nacimiento: '', email: '', celular: '', terminos: false },
  pago: { metodo: 'credito', tarjeta: '', vencimiento: '', cvv: '', titular: '' },
  poliza: null,
  // UI: campos "tocados" (error en blur), flag de edición y de procesamiento
  ui: { tocados: {}, volverAPago: false, procesando: false, motivoError: '' },
});

/* ---------- Persistencia (bonus) ---------- */
function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const g = JSON.parse(crudo);
    const base = crearInicial();
    return {
      ...base,
      ...g,
      equipo: { ...base.equipo, ...g.equipo },
      titular: { ...base.titular, ...g.titular },
      pago: { ...base.pago, ...g.pago },
      paso: g.paso === 6 ? 4 : g.paso >= 5 ? 0 : g.paso ?? 0,
      ui: { ...base.ui, volverAPago: Boolean(g.ui?.volverAPago) },
    };
  } catch {
    return null;
  }
}

export const solicitud = cargar() ?? crearInicial();

export function guardar() {
  try {
    // Al terminar (éxito) se limpia el storage
    if (solicitud.paso === 5) return localStorage.removeItem(CLAVE);
    // Por seguridad nunca se persisten número de tarjeta ni CVV
    const copia = {
      ...solicitud,
      pago: { ...solicitud.pago, tarjeta: '', cvv: '' },
      ui: { volverAPago: solicitud.ui.volverAPago },
    };
    localStorage.setItem(CLAVE, JSON.stringify(copia));
  } catch { /* storage no disponible: la app sigue funcionando en memoria */ }
}

/* ---------- Mutaciones (siempre vía estas funciones) ---------- */
export function setCampo(seccion, campo, valor) {
  solicitud[seccion][campo] = valor;
  guardar();
}

export function setPlan(id) {
  solicitud.plan = id;
  guardar();
}

export function marcarTocado(campo) {
  solicitud.ui.tocados[campo] = true;
}

export function irAPaso(n) {
  solicitud.paso = n;
  guardar();
  render(); // siempre después de cambiar el estado
  window.scrollTo({ top: 0 });
}

/** Bonus "Editar": salta al paso indicado y recuerda que hay que volver al pago */
export function editarDesdeResumen(n) {
  solicitud.ui.volverAPago = true;
  irAPaso(n);
}

export function reiniciar() {
  Object.assign(solicitud, crearInicial());
  try { localStorage.removeItem(CLAVE); } catch { /* noop */ }
  render();
  window.scrollTo({ top: 0 });
}