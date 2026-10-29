export function simularPago(numero) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const limpio = String(numero).replace(/\s/g, '');
      resolve(
        limpio === '4000000000000002'
          ? { ok: false, motivo: 'Tarjeta rechazada' }
          : { ok: true }
      );
    }, 1500);
  });
}

const CLAVE_CONTADOR = 'cubri:contador';

/** POL-AAAA-NNNNNN. El contador persiste entre solicitudes. */
export function generarPoliza() {
  let contador = 1;
  try {
    contador = Number(localStorage.getItem(CLAVE_CONTADOR) ?? 0) + 1;
    localStorage.setItem(CLAVE_CONTADOR, String(contador));
  } catch { /* sin storage: arranca en 1 */ }
  return `POL-${new Date().getFullYear()}-${String(contador).padStart(6, '0')}`;
}