import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './', // rutas relativas: funciona en GitHub Pages sin importar el nombre del repo
  plugins: [tailwindcss()],
});