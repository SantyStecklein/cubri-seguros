// Única fuente de verdad para precios: resumen y cards de plan usan SOLO esta función.

// Los values de los radios de antigüedad en el HTML coinciden con estas claves
export const FACTORES = { 'menos-1': 1.0, '1-2': 1.1, 'mas-2': 1.25 };

export function calcularCuota(valor, tasaAnual, antiguedad) {
  const factor = FACTORES[antiguedad];
  const v = Number(valor);
  if (!factor || !Number.isFinite(v) || v <= 0) return 0;
  return Math.round(((v * tasaAnual) / 12) * factor);
}

/** "600.000", "$ 600.000" → 600000 */
export const parsearNumero = (texto) => Number(String(texto ?? '').replace(/\D/g, ''));

const fmt = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
export const formatearMoneda = (n) => fmt.format(n);

/* ---------- Casos de prueba obligatorios (se llaman solo en dev desde app.js) ---------- */
export function verificarCasos() {
  const tasas = { basico: 0.04, plus: 0.06, premium: 0.09 };
  const casos = [
    [600000, 'menos-1', { basico: 2000, plus: 3000, premium: 4500 }],
    [600000, '1-2', { basico: 2200, plus: 3300, premium: 4950 }],
    [1200000, 'mas-2', { basico: 5000, plus: 7500, premium: 11250 }],
  ];
  for (const [valor, antig, esperado] of casos) {
    for (const id of Object.keys(tasas)) {
      const real = calcularCuota(valor, tasas[id], antig);
      console.assert(real === esperado[id], `Cuota ${id} ${valor}/${antig}: ${real} ≠ ${esperado[id]}`);
    }
  }
}