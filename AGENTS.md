# AGENTS.md — contexto para agentes de código (Codex, etc.)

## Qué es
PWA en español (Chile) para que una médica (María Fernanda Urrutia Bucarey) registre sus turnos en distintos centros,
vea los próximos, calcule cuánto cobrar por mes y por lugar, y envíe el resumen de horas por WhatsApp.
Usuarios: ella (uso diario en el teléfono) y su pareja Javier (mantiene el código). Se publica en GitHub Pages.

## Stack y reglas
- HTML/CSS/JS sin framework ni build. No agregar bundlers, npm ni frameworks salvo que se pida explícitamente.
- Todas las rutas son relativas (GitHub Pages sirve bajo `/<repo>/`). Nunca usar rutas que empiecen con `/`.
- Texto de la interfaz en español de Chile. Montos en pesos: `$25.000` (punto como separador de miles, sin decimales). Horas con coma decimal (`7,5 h`).
- Fechas guardadas como `YYYY-MM-DD` en hora local; horas como `HH:MM`. Un turno puede cruzar medianoche (se muestra `(+1)`).
- Mobile-first, ancho máx. 480 px, objetivos táctiles ≥ 44 px, modo claro/oscuro con variables CSS en `:root` (`styles.css`).
- Al cambiar cualquier archivo servido, subir `CACHE` en `sw.js` y mantener la lista `ASSETS` al día.

## Archivos
- `index.html` — estructura, barra de navegación inferior, registro del service worker.
- `styles.css` — tokens de color/tipografía (Fraunces + Instrument Sans) y componentes.
- `store.js` — capa de datos (`window.Store`). Hoy usa localStorage con la clave `turnos:v1`. API async: `init, subscribe, getState, addShift, deleteShift, newPlaceId, addPlace, updatePlace, setPerfil, exportJSON, importJSON`. Reemplazar esta capa es la forma de cambiar el backend sin tocar `app.js`.
- `app.js` — estado de la UI (`S`), vistas (`V.inicio, V.realizadas, V.programadas, V.nuevo, V.cobros, V.historial, V.lugares`), eventos delegados por atributos `data-go`, `data-act`, `data-f`, `data-nl`, `data-rate`, `data-perfil`, `data-opt`.
- `manifest.webmanifest`, `sw.js`, `icons/` — instalación y funcionamiento sin conexión.

## Modelo de datos
- `places[]`: `{ id, name, rate (valor hora CLP, 0 = sin definir), color (índice de paleta 0–6), order }`
- `shifts[]`: `{ id, date, start, hours, placeId, placeName, createdAt }` — un turno es "realizado" si `date < hoy`, "programado" si `date >= hoy`.
- `perfil`: `{ nombre, titulo ('doctora' | 'Dra.') }`
- `lastBackup`: ISO string o null.

## Mensaje de WhatsApp (pantalla Cobros, uno por lugar y mes)
`Horas realizadas por la doctora <nombre> en <lugar>: <N> horas durante el mes de <mes> <año>.`
Opcional: detalle por turno y monto total. Se abre con `https://wa.me/?text=<mensaje codificado>`; también hay botón Copiar.

## Pendiente / ideas acordadas
1. **Sincronización en la nube (prioridad):** reemplazar `store.js` por Supabase (auth con enlace mágico por correo o Google, tablas `places`, `shifts`, `perfil` con RLS por `user_id`), manteniendo la misma API y una migración que importe el respaldo JSON local.
2. Tarifas distintas por tipo de turno (noche, fin de semana, festivo) o monto fijo por turno.
3. Editar un turno existente (hoy solo se puede eliminar).
4. Recordatorio de respaldo si pasan más de 30 días sin descargar uno.

## Cómo probar
Servir la carpeta con cualquier servidor estático (`python3 -m http.server`) y abrir en el navegador en modo móvil.
El service worker solo funciona en `localhost` o HTTPS.
