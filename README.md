# Cubrí Seguros · Contratación digital de un seguro de celular

Trabajo Práctico de Diseño UX/UI (Licenciatura en Sistemas de Información, FCyT UADER, 2026).
Front-end de un checkout multipaso: cotizar → elegir plan → datos personales → pago simulado → póliza.

- **Sitio publicado:** _pegar acá la URL de GitHub Pages_
- **Diseño en Figma:** https://www.figma.com/design/vJrfOUfiOI7OSeTtRfCloh

## Stack

HTML5 · Tailwind CSS v4 · Basecoat UI · JavaScript vanilla (módulos ES) · Vite. Sin frameworks ni librerías de validación.

## Cómo correrlo

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # genera dist/
npm run preview   # sirve dist/ localmente
```

Hay que usar el servidor de Vite: abrir `index.html` con doble click (`file://`) rompe el `fetch` de `data/planes.json`.

## Estructura

```
index.html            Las 7 pantallas como <section data-paso="n">
css/tokens.css        Tokens del Figma sobre las variables de Basecoat (+ modo oscuro)
data/ → public/data/planes.json   Planes, cargados con fetch
js/app.js             Arranque, eventos, validación on blur, navegación, pago
js/estado.js          Objeto único `solicitud`, irAPaso(), persistencia
js/render.js          Pinta todo a partir del estado (stepper, resumen, errores)
js/validaciones.js    Funciones puras: devuelven mensaje o null
js/cotizador.js       calcularCuota() (única fuente de precios)
js/pago.js            simularPago() y generarPoliza()
.github/workflows/    Deploy a GitHub Pages
```

## Decisiones

- **El estado manda:** cada evento modifica `solicitud` y después llama a `render()`. El DOM nunca se lee para calcular.
- **Un solo resumen:** `renderResumen()` genera un único elemento; el CSS lo muestra como barra fija en mobile y card lateral en desktop.
- **Botón deshabilitado con explicación:** cada paso indica qué campos faltan.
- **Seguridad:** el `localStorage` nunca guarda número de tarjeta ni CVV.
- **Mobile first:** diseño base en 390 px, ajustes con `lg:` para 1440 px.
- **Accesibilidad:** `label for`, `aria-invalid`, `role="alert"`, foco al primer error y foco al título al cambiar de paso.

## Casos de prueba de la cuota

| Valor | Antigüedad | Básico | Plus | Premium |
|---|---|---|---|---|
| $ 600.000 | menos de 1 año | $ 2.000 | $ 3.000 | $ 4.500 |
| $ 600.000 | 1 a 2 años | $ 2.200 | $ 3.300 | $ 4.950 |
| $ 1.200.000 | más de 2 años | $ 5.000 | $ 7.500 | $ 11.250 |

Tarjetas de prueba: `4111 1111 1111 1111` (aprobada) · `4000 0000 0000 0002` (rechazada).

## Bonus implementados

1. **Persistencia** en `localStorage` (sobrevive a F5; se limpia al terminar).
2. **Editar desde el resumen**: lleva al paso correspondiente y vuelve directo al pago.
3. **Toast de Basecoat** al aprobarse el pago (se carga solo el JS de toast).
4. **Máscaras de input**: tarjeta en grupos de 4 y vencimiento con barra automática.
5. **Modo oscuro** con las variables de Basecoat (clase `.dark`).
6. **Deploy automático** con GitHub Actions a GitHub Pages.

## Capturas

| Mobile (390 px) | Desktop (1440 px) |
|---|---|
| _captura_ | _captura_ |

## Deploy

Push a `main` → el workflow `.github/workflows/deploy.yml` construye y publica.
Requiere *Settings → Pages → Source: GitHub Actions*.