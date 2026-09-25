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
- `store.js` — capa de datos (`window.Store`), local-first. Siempre guarda en localStorage (`turnos:v1`); con sesión en Supabase encola cada cambio en `turnos:outbox`, lo sube cuando hay red y luego descarga el estado de la nube, que pasa a ser la verdad. Sincroniza al abrir, al volver a la app y al recuperar conexión. La primera vez que un dispositivo entra a una cuenta (`turnos:linked`) sube solo las filas que la nube no tiene, sin pisar las existentes. API async: `init, subscribe, getState (incluye sync: {status, email, pending, lastSync}), addShift, updateShift, deleteShift, newPlaceId, addPlace, updatePlace, setPerfil, exportJSON, importJSON, signIn, signUp, signOut, syncNow`.
- `config.js` — URL y clave publishable/anon de Supabase. Si están vacías, la app funciona solo local.
- `supabase/schema.sql` — tablas `places`, `shifts`, `perfil` con RLS por `user_id` (no se sirve; se pega en el SQL Editor).
- La librería `@supabase/supabase-js` se carga desde jsDelivr con versión fija e `integrity`; `sw.js` la guarda en caché. Al cambiar de versión, actualizar la URL y el hash en `index.html` y `sw.js`.
- Login con correo y contraseña dentro de la app (sin enlaces por correo: en iPhone abrirían Safari y no la app instalada, que tiene otro almacenamiento; y el SMTP por defecto de Supabase no permite editar plantillas). En Supabase, "Confirm email" debe estar desactivado; tras crear las cuentas, desactivar "Allow new users to sign up".
- `app.js` — estado de la UI (`S`), vistas (`V.inicio, V.realizadas, V.programadas, V.nuevo, V.cobros, V.historial, V.lugares`), eventos delegados por atributos `data-go`, `data-act`, `data-f`, `data-nl`, `data-rate`, `data-perfil`, `data-opt`.
- `manifest.webmanifest`, `sw.js`, `icons/` — instalación y funcionamiento sin conexión.

## Modelo de datos
- `places[]`: `{ id, name, rate (valor hora día CLP, 0 = sin definir), rateNoche (valor hora noche, 0 = igual al de día), feriadoNoche (bool: en feriado todas las horas se pagan como noche), color (índice de paleta 0–6), order }` — en Supabase `rate_noche`, `feriado_noche` y `sort`.
- Día/noche: cada hora del turno se cobra según cae entre `DIA_INI` y `DIA_FIN` (08:00–20:00, constantes en `app.js`); el resto es noche. Un turno que cruza ambos se divide (ej. 14:00 + 12 h = 6 h día + 6 h noche).
- `shifts[]`: `{ id, date, start, hours, placeId, placeName, feriado (bool), createdAt }` — un turno es "realizado" si `date < hoy`, "programado" si `date >= hoy`.
- `perfil`: `{ nombre, titulo ('doctora' | 'Dra.') }`
- `lastBackup`: ISO string o null.

## Mensaje de WhatsApp (pantalla Cobros, uno por lugar y mes)
```
Hola Doctoor,
Los refuerzos de <mes> serían <días, ej. 10, 24, 25 y 27>
Serían <N> horas
```
Con un solo día: `El refuerzo de <mes> sería el <día>` / `Sería 1 hora`. Opcional: línea `Total: $<monto>`. Se abre con `https://wa.me/?text=<mensaje codificado>`; también hay botón Copiar.

## Pendiente / ideas acordadas
1. **Sincronización en la nube:** hecha. Proyecto Supabase `equebyacfqsobhrljjwv`, cuenta creada con el correo de María Fernanda y registro de cuentas nuevas desactivado. `lastBackup` sigue siendo solo local. No hay tiempo real entre dispositivos: se sincroniza al abrir o volver a la app.
2. Tarifas: día/noche hecho (horario 08:00–20:00 confirmado). Feriado: casilla en el turno; si el lugar tiene `feriadoNoche`, todo se cobra como noche (así en los SAR; en la clínica aún no se sabe). Pendiente: fin de semana o monto fijo por turno.
3. **Editar un turno:** hecho (botón Editar al abrir un turno; reutiliza la vista `nuevo` con `S.editId`).
4. **Recordatorio de respaldo:** hecho. Aviso en Inicio si hay turnos y nunca se descargó un respaldo o pasaron 30+ días (`lastBackup`, local por dispositivo); "Ahora no" lo oculta 7 días (`backupSnooze` en localStorage).

## Cómo probar
Servir la carpeta con cualquier servidor estático (`python3 -m http.server`) y abrir en el navegador en modo móvil.
El service worker solo funciona en `localhost` o HTTPS.
