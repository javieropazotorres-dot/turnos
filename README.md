# Turnos — registro de turnos médicos

App web instalable (PWA) para registrar turnos por centro, ver los próximos, calcular cobros mensuales por lugar y enviar el resumen de horas por WhatsApp.

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `turnos`). Puede ser público; los datos **no** se suben, viven en el teléfono.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio (incluido `.nojekyll`).
3. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`. Guarda.
4. En 1–2 minutos queda en `https://<tu-usuario>.github.io/turnos/`.

## Instalar en el teléfono

- **iPhone (Safari):** abrir el enlace → Compartir → **Agregar a pantalla de inicio**.
- **Android (Chrome):** abrir el enlace → menú ⋮ → **Instalar app** (o *Agregar a pantalla principal*).

Se abre a pantalla completa, con su propio ícono y funciona sin internet.

## Dónde quedan los datos

En el almacenamiento del navegador del teléfono (localStorage). No hay cuenta ni servidor.
En **Lugares → Respaldo de datos** se puede descargar un respaldo (`.json`), restaurarlo y exportar todo a Excel (`.csv`).
Conviene descargar un respaldo cada cierto tiempo.

## Actualizar la app

Después de cambiar archivos, sube el número de versión en `sw.js` (`const CACHE = 'turnos-v2'`, etc.). Si no, los teléfonos seguirán mostrando la versión anterior guardada.
