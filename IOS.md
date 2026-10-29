# Pulso en iPhone — grabar con la pantalla bloqueada

## La verdad, sin vueltas

**En iPhone, una web (PWA) NO puede seguir usando el GPS con la pantalla bloqueada.** No es un fallo
de tu app: iOS suspende la página y corta la ubicación en cuanto bloqueas el teléfono o cambias de app.
No hay API web para ubicación en segundo plano, y ningún truco (audio en bucle, wake lock, etc.) lo cambia.
Lo mismo le pasa a cualquier web.

La **única** forma es una app nativa de iOS con `CoreLocation` + modo "location" en segundo plano.
Es exactamente lo que hace Strava, Nike Run Club o WorkOutDoors.

**Eso es lo que ya está hecho aquí:** el proyecto iOS nativo está generado y configurado
(`ios/`), con la misma app dentro y el GPS en segundo plano activado:

| Configuración | Dónde |
|---|---|
| `UIBackgroundModes = location` | `ios/App/App/Info.plist` |
| Textos de permiso "Siempre" | `ios/App/App/Info.plist` |
| `allowsBackgroundLocationUpdates` | plugin `background-geolocation` |
| `pausesLocationUpdatesAutomatically = false` | plugin (no corta al parar en un semáforo) |

Lo que **yo no puedo hacer desde aquí**: compilar y firmar. Eso necesita un Mac con Xcode
y tu Apple ID. Son 3 caminos según lo que tengas.

---

## Camino A — tienes un Mac (el más simple, ~10 min)

```bash
npm install
npx cap sync ios      # copia la app al proyecto iOS
npx cap open ios      # abre Xcode
```

En Xcode:

1. Arriba a la izquierda, selecciona el proyecto **App** → pestaña **Signing & Capabilities**.
2. En **Team** elige tu Apple ID (si no aparece: *Add an Account* y entra con tu Apple ID normal, es gratis).
3. Si Xcode se queja del identificador, cambia **Bundle Identifier** por algo único:
   `com.tunombre.pulso`.
4. Conecta el iPhone por cable, desbloquéalo y acepta "Confiar en este ordenador".
5. Arriba, elige tu iPhone como destino y pulsa **▶ Run**.

En el teléfono: Ajustes → General → **VPN y administración de dispositivos** → tu Apple ID → **Confiar**.

⏳ Con cuenta Apple **gratis** la app caduca a los **7 días** (se reinstala repitiendo el paso 5).
Con **Apple Developer Program (99 USD/año)** dura **1 año** y puedes usar TestFlight.

---

## Camino B — tienes Windows (sin Mac)

El `.ipa` se compila en un Mac de GitHub (gratis) y se firma en tu PC con tu Apple ID.

1. Sube todo el proyecto a un repositorio de GitHub (sin `node_modules`).
2. Pestaña **Actions** → **"Compilar IPA de Pulso (iOS)"** → **Run workflow**.
3. En 6–10 minutos descarga el artefacto **`pulso-ipa`** → contiene `Pulso.ipa`.
4. En el PC instala **Sideloadly** (sideloadly.io) e **iTunes** (solo para los drivers del iPhone).
5. Conecta el iPhone, arrastra `Pulso.ipa` a Sideloadly, escribe tu Apple ID y pulsa **Start**.
6. En el teléfono: Ajustes → General → VPN y administración de dispositivos → **Confiar**.

⏳ Igual que en el camino A: 7 días con cuenta gratis, se vuelve a firmar con Sideloadly.

> ¿Ni Mac ni Windows? Un Mac en la nube (MacinCloud, MacStadium) por una hora sirve para el camino A,
> o pídeselo a alguien con Mac: solo tiene que pulsar ▶ una vez.

---

## Primer arranque en el iPhone (importante)

1. Toca **Empezar a correr** → iOS pide ubicación → permite
   **"Permitir mientras uso la app"**.
2. Ve a **Ajustes → Pulso → Ubicación** y cámbialo a **Siempre** + activa **Ubicación precisa**.
   Si no aparece "Siempre", abre la app, empieza un entrenamiento y vuelve a mirar: iOS lo ofrece
   después del primer uso.
3. Ajustes → Pulso → **Movimiento y forma física** → activar (mejora la precisión del ritmo).
4. Batería: no hace falta tocarla, pero si quieres máxima duración activa el **Modo de bajo consumo
   solo después** de empezar (iOS puede retrasar el GPS si se activa antes).

---

## Cómo comprobar que de verdad graba bloqueado (5 minutos)

1. Empieza un entrenamiento y **bloquea la pantalla**.
2. Camina o corre 5 minutos con el teléfono en el bolsillo.
3. Desbloquea y mira la distancia: debe haber subido. Verás además el indicador azul de iOS
   ("Pulso está usando tu ubicación"), que es normal y no se puede quitar.
4. Si al desbloquear no subió nada → revisa que la ubicación esté en **Siempre**, no en "Al usar la app".

---

## Qué se mantiene igual

- Metas de distancia, tiempo y ritmo/velocidad.
- Recorrido guardado con estadísticas, parciales, desnivel, GPX y CSV.
- Autoguardado: si iOS cierra la app, la sesión se recupera al volver.
- 0 datos móviles.
- Spotify: en iPhone solo el botón que **abre tu playlist en la app de Spotify** (el control remoto
  no aplica dentro de la app nativa). Descarga la playlist offline y sigue sin gastar datos.
