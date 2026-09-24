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

Siempre en el almacenamiento del navegador del teléfono (localStorage), así la app funciona sin internet.
Si se inicia sesión en **Lugares → Sincronización en la nube** (con un código que llega por correo), los turnos también se guardan en Supabase y se ven en otros dispositivos.
En **Lugares → Respaldo de datos** se puede descargar un respaldo (`.json`), restaurarlo y exportar todo a Excel (`.csv`).

## Configurar Supabase (una vez)

1. Crear un proyecto en supabase.com.
2. **SQL Editor** → pegar el contenido de `supabase/schema.sql` → **Run**.
3. **Authentication → Emails → Magic Link**: agregar el código al correo, por ejemplo `Tu código para Turnos es: {{ .Token }}`.
4. **Project Settings → API**: copiar la URL del proyecto y la clave *publishable* (o *anon*) en `config.js`.
5. Subir los cambios (y el número de `CACHE` en `sw.js`).

## Actualizar la app

Después de cambiar archivos, sube el número de versión en `sw.js` (`const CACHE = 'turnos-v2'`, etc.). Si no, los teléfonos seguirán mostrando la versión anterior guardada.
