// Funciones puras: reciben un valor y devuelven un mensaje de error o null.

export const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');

const MSG_EDAD = 'Tenés que ser mayor de edad';
const MSG_VENC = 'Vencimiento inválido';

/* ---------- Equipo ---------- */
export const validarMarca = (v) => (v ? null : 'Elegí una marca');

export const validarModelo = (v) => {
  const n = String(v ?? '').trim().length;
  return n >= 2 && n <= 40 ? null : 'Ingresá el modelo del equipo';
};

export const validarValor = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 100000 && n <= 2500000
    ? null
    : 'El valor debe estar entre $100.000 y $2.500.000';
};

export const validarAntiguedad = (v) =>
  ['menos-1', '1-2', 'mas-2'].includes(v) ? null : 'Indicá la antigüedad';

/* ---------- Titular ---------- */
// Letras (con tildes/ñ), espacios simples entre palabras, apóstrofe y guion
const NOMBRE = /^\p{L}[\p{L}'’-]*(?: \p{L}[\p{L}'’-]*)*$/u;
const letras = (v) => String(v ?? '').replace(/[^\p{L}]/gu, '').length;
const esNombre = (v) => {
  const t = String(v ?? '').trim();
  return letras(t) >= 2 && t.length <= 40 && NOMBRE.test(t);
};
export const validarNombre = (v) => (esNombre(v) ? null : 'Ingresá tu nombre');
export const validarApellido = (v) => (esNombre(v) ? null : 'Ingresá tu apellido');
export const validarTitularTarjeta = (v) => (esNombre(v) ? null : 'Ingresá el nombre del titular');

// Rangos de DNI (RENAPER): 1M–59.999.999 argentinos y naturalizados · 90M–99.999.999 extranjeros residentes.
// 60M–69M es CUIT/CUIL de extranjeros y 70M+ son recién nacidos (menores de edad).
// ¿Querés rechazar todo lo que empiece con 9? Borrá el segundo rango.
const DNI_RANGOS = [[1_000_000, 59_999_999], [90_000_000, 99_999_999]];
export function validarDni(v) {
  const s = String(v ?? '').trim();
  if (!/^\d{7,8}$/.test(s)) return 'El DNI debe tener 7 u 8 números';
  const n = Number(s);
  return DNI_RANGOS.some(([min, max]) => n >= min && n <= max) ? null : 'El DNI ingresado no es válido';
}

// Más estricto que el de la consigna: sin símbolos raros, sin ".." y TLD de 2+ letras
const EMAIL = /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
export function validarEmail(v) {
  const e = String(v ?? '').trim();
  return e.length <= 254 && !e.includes('..') && EMAIL.test(e) ? null : 'Ingresá un email válido';
}

/* ---------- Titular ---------- */

export function validarNacimiento(v, hoy = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
  if (!m) return MSG_EDAD;
  const [y, mo, d] = m.slice(1).map(Number);
  const fecha = new Date(y, mo - 1, d);
  if (fecha.getMonth() !== mo - 1 || y < 1900) return MSG_EDAD; // fecha inexistente
  let edad = hoy.getFullYear() - y;
  if (hoy.getMonth() < mo - 1 || (hoy.getMonth() === mo - 1 && hoy.getDate() < d)) edad--;
  return edad >= 18 ? null : MSG_EDAD;
}

export function validarCelular(v) {
  const limpio = String(v ?? '').replace(/[\s-]/g, '');
  const ok = /^\d{10}$/.test(limpio) && !limpio.startsWith('0') && !limpio.startsWith('15');
  return ok ? null : 'Ej.: 11 5555-1234';
}

export const validarTerminos = (v) => (v === true ? null : 'Tenés que aceptar los términos');

/* ---------- Pago ---------- */
export const validarTarjeta = (v) =>
  /^\d{16}$/.test(String(v ?? '').replace(/\s/g, '')) ? null : 'Número de tarjeta inválido';

export function validarVencimiento(v, hoy = new Date()) {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(v ?? '');
  if (!m) return MSG_VENC;
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  // La tarjeta vale hasta el último día del mes indicado
  return new Date(anio, mes, 1) > hoy ? null : MSG_VENC;
}

export const validarCvv = (v) => (/^\d{3}$/.test(String(v ?? '')) ? null : 'CVV inválido');

/* ---------- Validadores por paso: devuelven { campo: error|null } ---------- */
export const validarEquipo = (e) => ({
  marca: validarMarca(e.marca),
  modelo: validarModelo(e.modelo),
  valor: validarValor(e.valor),
  antiguedad: validarAntiguedad(e.antiguedad),
});

export const validarTitular = (t) => ({
  nombre: validarNombre(t.nombre),
  apellido: validarApellido(t.apellido),
  dni: validarDni(t.dni),
  nacimiento: validarNacimiento(t.nacimiento),
  email: validarEmail(t.email),
  celular: validarCelular(t.celular),
  terminos: validarTerminos(t.terminos),
});

export const validarPago = (p) => ({
  tarjeta: validarTarjeta(p.tarjeta),
  vencimiento: validarVencimiento(p.vencimiento),
  cvv: validarCvv(p.cvv),
  titular: validarTitularTarjeta(p.titular),
});

export const hayErrores = (errores) => Object.values(errores).some(Boolean);
export const primerCampoConError = (errores) =>
  Object.keys(errores).find((k) => errores[k]) ?? null;