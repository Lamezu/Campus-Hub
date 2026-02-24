import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {} // Vacío pero presente
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  },
  // Configuración para SPA routing - maneja rutas no encontradas
  // redirigiendo a index.html
  base: '/',
  // Esta configuración asegura que todas las rutas sean manejadas por el SPA
  // y no generen errores 404 en desarrollo
})
