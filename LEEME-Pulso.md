# Pulso — tu entrenador GPS para correr y bici

Mide **tiempo, distancia, ritmo y velocidad** con el GPS del teléfono, para **carrera y ciclismo**,
con metas configurables, **recorridos guardados con estadísticas** y control de Spotify opcional.

**Diseñada para gastar casi nada de datos: ~90 KB en total, una sola vez. Después, 0 bytes.**

Hay dos formas de usarla, con el mismo código:

| Versión | Para qué | Pantalla apagada |
|---|---|---|
| **PWA** (esta carpeta) | Instalarla desde un enlace, sin tiendas | No (límite de los navegadores) |
| **APK Android** (carpeta `android/`) | Grabar con el teléfono bloqueado en Android | **Sí** — ver [NATIVO.md](NATIVO.md) |
| **App iOS** (carpeta `ios/`) | Grabar con el teléfono bloqueado en iPhone | **Sí** — ver [IOS.md](IOS.md) |

---

## 1. Qué hace

| Función | Detalle |
|---|---|
| Deportes | Correr (ritmo en min/km) y ciclismo (velocidad en km/h) |
| Metas que tú eliges | Distancia (km), tiempo (h:mm:ss) y ritmo/velocidad — puedes poner 2 y la app calcula el tercero |
| Fin automático | La sesión termina sola al llegar a la meta de distancia o de tiempo |
| En vivo | Restante, tiempo, distancia, ritmo/velocidad actual y media, vueltas, aviso por km |
| Mapa | Dibujo del recorrido **sin descargar mapas** (por eso no gasta datos) |
| Recorridos | Se guarda **todo el trazado GPS**, no solo los totales |
| Estadísticas | Distancia, tiempo, tiempo en movimiento, ritmo/velocidad media y máxima, mejor km, parciales por km, desnivel, calorías |
| Historial | Cada salida con su recorrido, detalle y totales acumulados |
| Exportar | **GPX** (Strava, Garmin, Google Earth) y **CSV** |
| Resistente | Autoguardado cada 12 s: si el móvil cierra la app, la sesión se recupera |
| Spotify | Abre tu playlist, o controla play/pausa/siguiente desde la app (requiere Premium) |
| Sin conexión | Funciona en modo avión y sin señal |

---

## 2. Instalarla en tu celular (5 minutos)

La app necesita abrirse por **https://** para que el navegador permita el GPS. Elige una opción:

### Opción A — Netlify Drop (la más rápida, gratis)
1. En la computadora entra a **https://app.netlify.com/drop**
2. Arrastra **la carpeta `pulso` completa** a la zona de carga.
3. Te da un enlace tipo `https://algo-random.netlify.app`. Crea cuenta gratis para conservarlo.
4. Abre ese enlace en el celular con **Chrome** (Android) o **Safari** (iPhone).
5. Instálala:
   - **Android:** menú ⋮ → *Instalar aplicación* / *Añadir a pantalla principal*.
   - **iPhone:** botón Compartir → *Añadir a pantalla de inicio*.

### Opción B — GitHub Pages
1. Crea un repositorio y sube el contenido de la carpeta `pulso` (no la carpeta, los archivos).
2. Settings → Pages → Branch `main` / carpeta `/root` → Save.
3. Abre `https://TU-USUARIO.github.io/TU-REPO/` en el celular e instálala igual que arriba.

### Opción C — Cloudflare Pages
1. https://pages.cloudflare.com → *Upload assets* → arrastra la carpeta `pulso`.

> Si cambias el contenido, sube de nuevo los archivos. Para que el teléfono tome la versión nueva,
> cierra la app y ábrela otra vez (el service worker se actualiza al recargar dos veces).

---

## 3. Cómo se usa

1. Elige **Correr** o **Ciclismo**.
2. Llena lo que quieras (puedes dejar campos vacíos):
   - **Distancia**: `10` → 10 km
   - **Tiempo**: `45:00` = 45 min · `1:20:00` = 1 h 20 min
   - **Ritmo/velocidad**: correr `5:30` = 5 min 30 s por km · bici `20` = 20 km/h
3. Abajo eliges **cuándo termina**: al llegar a la distancia, al cumplirse el tiempo, o sin límite.
4. **Empezar**. Acepta el permiso de ubicación y espera a que la barra de GPS se ponga verde.
5. Durante la carrera: **Pausa**, **Vuelta** y **Fin**. Al terminar se guarda sola en el historial.

Ejemplos:
- *Quiero 5 km en 25 minutos* → Distancia `5`, Tiempo `25:00`, meta = "Llego a la distancia". La app te dice que necesitas 5:00 /km.
- *Quiero pedalear 1 hora* → Tiempo `1:00:00`, meta = "Se cumple el tiempo".
- *Quiero ir a 6:00 /km hasta cansarme* → Ritmo `6:00`, meta = "Sin límite".

### Tus recorridos y estadísticas

Al terminar, la sesión se guarda automáticamente con **el trazado completo** y sus estadísticas.
En **Historial** tocas cualquier salida y ves:

- El **mapa del recorrido** dibujado desde tus puntos GPS (sin descargar mapas ni datos).
- Distancia, tiempo total, tiempo en movimiento, ritmo o velocidad media, mejor km,
  velocidad máxima, desnivel acumulado, calorías y número de puntos GPS.
- Los **parciales de cada kilómetro**.

Desde ahí puedes **exportar GPX** (para subirlo a Strava, Garmin Connect, Google Earth, etc.),
**CSV** de esa sesión, o borrarla. En Ajustes → *Exportar todo* baja el historial completo.

**Si el móvil cierra la app** (batería, poca memoria, reinicio), al volver a abrirla aparece
un aviso arriba: *"Sesión sin terminar · 4,2 km · hace 20 min"* con dos opciones,
**Guardar** (la convierte en entrenamiento con su recorrido) o **Descartar**.
La app guarda sola cada 12 segundos y justo antes de que el sistema la duerma.

---

## 4. Spotify (opcional, dos formas)

### Forma simple — 0 configuración
Copia el enlace de tu playlist favorita en **Ajustes → Canciones favoritas**.
El botón de Spotify abre tu app directamente. **Truco:** descarga esa playlist en modo *offline*
dentro de Spotify y la música tampoco gastará datos.

### Forma completa — control desde la app
Requiere **Spotify Premium** (es requisito de Spotify para controlar la reproducción) y 1 minuto de configuración:

1. Entra a **https://developer.spotify.com/dashboard** con tu cuenta → *Create app*.
2. Nombre cualquiera. En **Redirect URI** pega exactamente lo que muestra la app en
   *Ajustes → Redirect URI* (normalmente `https://tu-sitio.netlify.app/`).
3. Marca **Web API** y guarda.
4. Copia el **Client ID** y pégalo en *Ajustes → Client ID*.
5. Toca **Conectar cuenta** → acepta → vuelve a la app.
6. Activa **Control desde la app** y dale play en Spotify antes de empezar (debe haber un dispositivo activo).

Si algo falla, la app te avisa (por ejemplo "requiere Premium"). Puedes desconectar cuando quieras.

---

## 5. Por qué no gasta datos

| Elemento | Datos |
|---|---|
| App completa (HTML + JS + iconos) | **83 KB**, se guarda en el teléfono |
| Uso durante la carrera | **0 bytes** — todo se calcula en el teléfono |
| Mapas | **Ninguno**. El recorrido se dibuja con tus puntos GPS |
| GPS | Usa satélites, **no** red móvil |
| Fuentes, analíticas, publicidad | Ninguna |
| Spotify (si lo conectas) | ~1 KB por consulta, cada 15 s y solo mientras la app está abierta |

Comparación: una app de running típica descarga mapas y sube la actividad → entre 5 y 40 MB por salida.
Aquí: 0.

**Ahorro extra:** en Ajustes de Android puedes restringir los datos móviles de la app sin afectar el GPS.

---

## 6. Límites reales (importante)

- **Pantalla apagada.** En la versión web los navegadores suspenden el GPS al bloquear el teléfono;
  la app lo compensa manteniendo la pantalla despierta y guardando la sesión por si el sistema la cierra.
  Para grabar de verdad con el teléfono bloqueado está la **versión APK** (carpeta `android/`,
  instrucciones en [NATIVO.md](NATIVO.md)): usa un servicio en primer plano y sigue grabando con la pantalla apagada.
- **Huecos de señal.** Si el GPS pierde cobertura (túneles, edificios), la distancia de ese tramo se estima
  en línea recta y el resumen te avisa con el número de huecos.
- **Precisión.** El GPS del teléfono tiene ±5–15 m. La app descarta saltos imposibles y puntos con mala
  señal, así que la distancia queda en un ~1–3 % de error (normal en cualquier app de GPS).
- **iPhone.** Funciona e se instala, pero iOS es más estricto con el GPS en segundo plano.
- **Calorías.** Estimación aproximada para 70 kg; sirve de referencia, no es un dato médico.
- **Historial.** Se guarda en el navegador. Si borras los datos del sitio, se pierde: exporta el CSV de vez en cuando.

---

## 7. Archivos

```
pulso/                      ← lo que se sube a Netlify / GitHub Pages
├── index.html              estructura y estilos (todo el diseño)
├── app.js                  GPS, cronómetro, metas, vueltas, Spotify, historial
├── store.js                guarda recorridos y estadísticas (IndexedDB) + GPX
├── sw.js                   service worker: la app queda guardada en el teléfono
├── manifest.webmanifest    datos para instalarla como aplicación
├── icon.svg                icono vectorial
└── icon-180/192/512.png    iconos para Android e iOS

android/                    proyecto Android (para el APK, ver NATIVO.md)
capacitor.config.json       configuración del empaquetado nativo
.github/workflows/          compila el APK automáticamente en GitHub
```

No usa frameworks ni CDN: nada que descargar después de la primera visita.
Los recorridos se guardan en **IndexedDB** (aguanta cientos de rutas con miles de puntos);
si el navegador no lo permite, usa localStorage como respaldo.

---

## 8. Probar rápido en la computadora

Dentro de la carpeta `pulso`, ejecuta:

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080`. El GPS solo funciona en `localhost` o `https://`
(en `file://` el navegador lo bloquea).
