# Pulso en tu iPhone — paso a paso, desde Windows y por 0 €

**Qué vas a hacer:** un servidor de GitHub (gratis) compila la app de iPhone, y Sideloadly la firma
con tu Apple ID (gratis) y la instala en tu teléfono.

**Coste: 0 €.** GitHub gratis, Sideloadly gratis, Apple ID gratis.
**Único peaje:** la firma gratuita dura **7 días**. Cada semana repites un paso de 2 minutos (Paso 8).

**Tiempo la primera vez:** 40–50 minutos.

### Antes de empezar (checklist)
- [ ] PC con Windows 10 u 11
- [ ] Cable USB para el iPhone
- [ ] Cuenta de GitHub (si no tienes, la creas en el Paso 2, gratis)
- [ ] Tu Apple ID (el mismo que usas en el iPhone)
- [ ] El archivo `Pulso-completo.zip`

> **¿Se puede hacer todo desde el celular?** No. Los pasos 2 y 3 sí (GitHub funciona en el navegador
> del móvil), pero **firmar e instalar la app necesita un ordenador**. Como tienes Windows, perfecto.

---

## Paso 1 — Descomprimir (2 min)

1. Clic derecho sobre `Pulso-completo.zip` → **Extraer todo…**
2. Destino: `C:\Pulso`
3. Abre `C:\Pulso`. Debes ver:
   - carpetas: `pulso`, `ios`, `android`, `.github`
   - archivos: `package.json`, `package-lock.json`, `capacitor.config.json`, `LEEME-Pulso.md`, `IOS.md`, `NATIVO.md`

> ¿No ves la carpeta `.github`? Empieza por un punto, así que Windows la oculta.
> En el Explorador: menú **Ver** → **Mostrar** → **Elementos ocultos**.

**No toques nada de lo que hay dentro.** Solo hay que subirlo tal cual.

---

## Paso 2 — Subirlo a GitHub (10 min)

1. Entra en **github.com** → **Sign up** y crea la cuenta (email, contraseña, usuario). Gratis.
2. Arriba a la derecha: **+** → **New repository**.
3. Rellena:
   - **Repository name:** `pulso`
   - **Public** ← importante: con repositorio público las compilaciones son ilimitadas y gratis
   - No marques nada más
4. **Create repository**.
5. En la página que aparece, pulsa **uploading an existing file**
   (o **Add file** → **Upload files**).
6. Abre `C:\Pulso` en el Explorador, selecciona **todo** (`Ctrl + E`) y **arrastra** a la zona de
   carga del navegador. Espera: son ~120 archivos, tarda un poco.
7. Comprueba que arriba aparece la lista con `pulso/`, `ios/`, `android/`, `.github/`…
8. Abajo, botón verde **Commit changes**.

> Si el navegador se atasca (muchos archivos), súbelo en dos tandas:
> primero la carpeta `pulso` y los archivos sueltos → Commit; luego `ios`, `android` y `.github` → Commit.

---

## Paso 3 — Compilar el .ipa (10 min, tú no haces nada)

1. En tu repositorio pulsa la pestaña **Actions**.
2. Si sale un botón verde **"I understand my workflows, go ahead and enable them"**, púlsalo.
3. En la columna izquierda elige **Compilar IPA de Pulso (iOS)**.
4. Botón **Run workflow** (derecha) → **Run workflow**.
5. Recarga la página a los 30 segundos: aparece una fila amarilla (compilando). Tarda **6–10 min**.
6. Cuando se ponga **verde** ✅, entra en esa fila y baja hasta **Artifacts** → pulsa **pulso-ipa**.
   Se descarga un `.zip`.
7. Descomprímelo: dentro está **`Pulso.ipa`**. Guárdalo en `C:\Pulso\` (lo vas a necesitar cada semana).

> Si sale en rojo ❌: entra, abre el paso que falló y mándame una captura del error.

---

## Paso 4 — Preparar Windows (10 min, solo la primera vez)

1. Instala **iTunes** desde **apple.com/itunes** → el instalador clásico de Windows.
   **No** uses el de la Microsoft Store. No hace falta abrirlo; solo da los drivers del iPhone.
2. Instala **Sideloadly** desde **sideloadly.io** → Download for Windows.
3. Conecta el iPhone con el cable, desbloquéalo y cuando pregunte pulsa **Confiar** → escribe el código.

---

## Paso 5 — Firmar e instalar (5 min)

1. Abre **Sideloadly**.
2. Arriba debe aparecer tu iPhone (si no aparece: desconecta y vuelve a conectar el cable).
3. Arrastra **`Pulso.ipa`** a la ventana de Sideloadly (o pulsa el icono del IPA y selecciónalo).
4. En **Apple account** escribe tu **Apple ID** y tu contraseña.
   - Si tienes verificación en dos pasos, Sideloadly te pedirá el **código de 6 dígitos**:
     sale en tu iPhone. Escríbelo.
5. Pulsa **Start**. Espera 1–3 minutos hasta **"Done"**.
6. En el iPhone verás el icono de **Pulso**. Si al abrirlo dice que no es de confianza:
   **Ajustes → General → VPN y administración de dispositivos → tu Apple ID → Confiar**.

---

## Paso 6 — Los permisos que hacen que grabe con la pantalla apagada

1. Abre **Pulso** → elige Correr o Ciclismo → **Empezar** → cuando pregunte, permite la ubicación.
2. **Ajustes → Pulso → Ubicación → Siempre** (no "Al usar la app") y activa **Ubicación precisa**.
3. **Ajustes → Pulso → Movimiento y forma física** → activar.
4. (Opcional, recomendado) **Ajustes → Batería → Modo de bajo consumo**: actívalo solo *después*
   de empezar a entrenar, no antes.

---

## Paso 7 — La prueba de 5 minutos (hazla antes de confiar en la app)

1. Empieza un entrenamiento.
2. **Bloquea la pantalla** y camina o corre 5 minutos con el teléfono en el bolsillo.
3. Desbloquea y mira la distancia: **tiene que haber subido**.

Si no subió → vuelve al Paso 6: la ubicación está en "Al usar la app" y debe estar en **Siempre**.

> Verás un indicador azul de iOS mientras grabas ("Pulso está usando tu ubicación"). Es normal.

---

## Paso 8 — Cada 7 días (2 minutos)

A los 7 días la app dirá *"Pulso no está disponible"*. Es la firma gratuita caducando, no un fallo.

1. Conecta el iPhone, abre **Sideloadly**.
2. Arrastra otra vez el mismo `Pulso.ipa` (no hay que volver a compilar nada).
3. **Start** → espera a "Done".

**Tus entrenamientos guardados no se borran** al reinstalar. Aun así, de vez en cuando exporta el CSV
o el GPX desde Historial (por si acaso).

---

## Si algo falla

| Lo que ves | Qué hacer |
|---|---|
| "No se puede verificar la app" | Ajustes → General → VPN y administración de dispositivos → Confiar |
| "Pulso no está disponible" | Caducó la firma → Paso 8 |
| Sideloadly no ve el iPhone | Reinstala iTunes clásico, prueba otro cable, pulsa "Confiar" otra vez |
| Error de Apple ID en Sideloadly | Genera una **contraseña de aplicación** en appleid.apple.com y úsala en vez de la normal |
| El workflow sale en rojo | Abre el log del paso que falló y mándame la captura |
| Graba pero con huecos | Ubicación en "Siempre" + Ubicación precisa + desactiva el ahorro de batería para Pulso |

---

## Lo que NO cuesta nada y lo que sí

| Cosa | Coste |
|---|---|
| GitHub (repo público) | 0 € |
| Sideloadly | 0 € |
| Apple ID gratis | 0 € (firma de 7 días) |
| Datos móviles al usar la app | 0 MB |
| Apple Developer Program (opcional) | 99 USD/año — solo si quieres olvidarte del Paso 8 |

---

## Atajo si algún día te cansas del Paso 8

Una app de running de la App Store **ya graba con la pantalla bloqueada** sin firma ni historias
(Strava o Nike Run Club, gratis). Lo que no tendrás ahí son tus metas configurables de distancia,
tiempo y ritmo como en Pulso. Es la alternativa honesta si el ciclo de 7 días te resulta molesto.
