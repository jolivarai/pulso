/* =====================================================================
   Pulso — entrenador GPS para correr y ciclismo
   Sin dependencias externas. Sin red. Sin mapas descargados.
   ===================================================================== */
'use strict';

/* ------------------------------- helpers ------------------------------ */
const $ = (id) => document.getElementById(id);
const LS = {
  get(k, d) { try { const v = localStorage.getItem('pulso.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pulso.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('pulso.' + k); } catch {} }
};

const KM = 1000;

function fmtTime(sec, forceH) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  if (h > 0 || forceH) return h + ':' + p(m) + ':' + p(s);
  return p(m) + ':' + p(s);
}
function fmtClock(sec) { // para el cronómetro grande: siempre mm:ss o h:mm:ss
  return fmtTime(sec, sec >= 3600);
}
function num1(n) { return (Math.round(n * 10) / 10).toFixed(1).replace('.', ','); }
function num2(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ','); }
function num0(n) { return String(Math.round(n)); }

// ritmo (s/km) para correr. Si es 0 o infinito, guion.
function fmtPace(spk) {
  if (!isFinite(spk) || spk <= 0 || spk > 3600) return '—';
  const m = Math.floor(spk / 60), s = Math.round(spk % 60);
  if (s === 60) return (m + 1) + ':00';
  return m + ':' + String(s).padStart(2, '0');
}
function fmtSpeed(kmh) {
  if (!isFinite(kmh) || kmh <= 0) return '—';
  return num1(kmh);
}

// "45", "45:30", "1:20:00" -> segundos ; devuelve NaN si no válido
function parseTime(str) {
  if (!str) return NaN;
  const parts = String(str).replace(',', ':').split(':').map((x) => x.trim());
  if (parts.some((p) => p !== '' && !/^\d+$/.test(p))) return NaN;
  const n = parts.filter((p) => p !== '').map(Number);
  if (!n.length) return NaN;
  if (n.length === 1) return n[0] * 60;              // minutos sueltos
  if (n.length === 2) return n[0] * 60 + n[1];
  return n[0] * 3600 + n[1] * 60 + n[2];
}
function parsePace(str, sport) {
  if (!str) return NaN;
  const t = String(str).replace(',', ':').trim();
  if (sport === 'bike') {                             // km/h
    const v = parseFloat(t.replace(':', '.'));
    return isFinite(v) && v > 0 ? v : NaN;
  }
  const parts = t.split(':').map(Number);
  if (parts.some((x) => !isFinite(x))) return NaN;
  if (parts.length === 1) return parts[0] * 60;       // "5" -> 5:00
  return parts[0] * 60 + parts[1];                    // "5:30"
}

function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const la1 = a.lat * rad, la2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

let toastT;
function toast(msg, ms = 2400) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), ms);
}

/* ------------------------------ ajustes ------------------------------- */
const PREFS = Object.assign({
  voice: true, beep: true, autopause: false, wake: true, spcontrol: false
}, LS.get('prefs', {}));
function savePrefs() { LS.set('prefs', PREFS); }
document.querySelectorAll('[data-tg]').forEach((b) => {
  const k = b.dataset.tg;
  b.classList.toggle('on', !!PREFS[k]);
  b.addEventListener('click', () => {
    PREFS[k] = !PREFS[k];
    b.classList.toggle('on', PREFS[k]);
    savePrefs();
    if (k === 'wake') PREFS.wake ? requestWake() : releaseWake();
    if (k === 'spcontrol' && PREFS.spcontrol) ensureSpotify();
  });
});

/* --------------------------- plan / objetivo -------------------------- */
const plan = Object.assign({
  sport: 'run', goal: 'distance', dist: 0, time: 0, pace: 0
}, LS.get('plan', {}));

function planInputs() {
  plan.dist = Math.max(0, parseFloat(String($('in-dist').value).replace(',', '.')) || 0);
  plan.time = parseTime($('in-time').value) || 0;
  const rawPace = parsePace($('in-pace').value, plan.sport);
  plan.pace = isFinite(rawPace) ? rawPace : 0;   // seg/km (run) | km/h (bike, guardado aparte)
}

// devuelve ritmo objetivo en s/km a partir de lo que haya
function derivedPace() {
  if (plan.pace) return plan.sport === 'bike' ? 3600 / plan.pace : plan.pace;
  if (plan.dist > 0 && plan.time > 0) return plan.time / plan.dist;
  return 0;
}
function derivedTime() {
  if (plan.time) return plan.time;
  const p = derivedPace();
  if (p && plan.dist > 0) return p * plan.dist;
  return 0;
}
function derivedDist() {
  if (plan.dist) return plan.dist;
  const p = derivedPace();
  if (p && plan.time > 0) return plan.time / p;
  return 0;
}

function renderPlan() {
  planInputs();
  LS.set('plan', plan);
  const out = $('plan-out');
  const isBike = plan.sport === 'bike';
  const p = derivedPace();
  const chips = [];

  if (plan.dist > 0) chips.push(`<span class="chip">Distancia <b>${num2(plan.dist)} km</b></span>`);
  if (plan.time > 0) chips.push(`<span class="chip">Tiempo <b>${fmtTime(plan.time)}</b></span>`);

  if (p) {
    const label = isBike ? 'Velocidad' : 'Ritmo';
    const val = isBike ? num1(3600 / p) + ' km/h' : fmtPace(p) + ' /km';
    chips.push(`<span class="chip acc">${label} <b>${val}</b></span>`);
    // estimación de llegada
    if (plan.dist > 0 && plan.time > 0) {
      const need = plan.time / plan.dist;
      const needTxt = isBike ? num1(3600 / need) + ' km/h' : fmtPace(need) + ' /km';
      if (Math.abs(need - p) > 1) chips.push(`<span class="chip">Necesitas <b>${needTxt}</b></span>`);
    }
  }
  if (!chips.length) chips.push('<span class="chip">Sin meta: entrena libre</span>');

  // proyección
  const dt = derivedTime(), dd = derivedDist();
  if (p && dd > 0 && dt > 0) {
    chips.push(`<span class="chip">Llegada est. <b>${fmtTime(dt)}</b></span>`);
  }
  out.innerHTML = chips.join('');

  // etiquetas según deporte
  $('pace-label').textContent = isBike ? 'Velocidad objetivo' : 'Ritmo objetivo';
  $('pace-unit').textContent = isBike ? 'km/h' : 'min/km';
  $('in-pace').placeholder = isBike ? '20' : '5:30';
  $('btn-start').textContent = isBike ? 'Empezar a pedalear' : 'Empezar a correr';
  $('time-unit').textContent = 'hh:mm:ss';
  // si no hay meta, la meta de fin debe ser "sin límite"
  if (!dd && !dt && plan.goal !== 'none') { plan.goal = 'none'; syncGoalSeg(); }
  if (dd && dt && plan.goal === 'none') { plan.goal = 'distance'; syncGoalSeg(); }
}
function syncGoalSeg() {
  document.querySelectorAll('#seg-goal button').forEach((b) => b.classList.toggle('on', b.dataset.goal === plan.goal));
}

/* ---------------------------- navegación ------------------------------ */
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === 'view-' + name));
  window.scrollTo(0, 0);
}

/* ------------------------------ deporte ------------------------------- */
function setSport(s) {
  const prev = plan.sport;
  if (prev !== s && plan.pace > 0) {
    // convertir el valor mostrado (min/km <-> km/h)
    if (s === 'bike') plan.pace = Math.round(3600 / plan.pace * 10) / 10;
    else plan.pace = Math.round(3600 / plan.pace);
    const inp = $('in-pace');
    if (inp.value) inp.value = s === 'bike' ? num1(plan.pace) : fmtPace(plan.pace);
  }
  plan.sport = s;
  document.body.classList.toggle('bike', s === 'bike');
  document.body.classList.toggle('run', s !== 'bike');
  document.querySelectorAll('#seg-sport button').forEach((b) => b.classList.toggle('on', b.dataset.sport === s));
  $('live-label').textContent = s === 'bike' ? 'Pedaleando' : 'Corriendo';
  $('k-cur').textContent = s === 'bike' ? 'Vel.' : 'Ritmo';
  $('k-avg').textContent = s === 'bike' ? 'Vel. med.' : 'Medio';
  $('sum-l-avg').textContent = s === 'bike' ? 'Velocidad media' : 'Ritmo medio';
  $('sum-l-best').textContent = s === 'bike' ? 'Mejor km (vel.)' : 'Mejor km (ritmo)';
  LS.set('plan', plan);
  renderPlan();
}

/* ------------------------------- sesión ------------------------------- */
const S = {
  status: 'idle', sport: 'run',
  elapsed: 0, lastResume: 0, moveMs: 0, startedAt: 0,
  dist: 0, last: null, pts: [], win: [], maxV: 0,
  laps: [], splits: [], nextKm: 1, gaps: 0,
  goal: { type: 'none', val: 0, pace: 0 },
  autoPaused: false, watchId: null, tick: 0, kcal: 0, lastRec: null
};
const GEO = { acc: 999, ok: false };
const MAXV = () => (S.sport === 'bike' ? 28 : 13);   // m/s, corta saltos de GPS

function elapsedMs() { return S.elapsed + (S.status === 'running' ? Date.now() - S.lastResume : 0); }
function curSpeed() {
  if (!S.win.length) return 0;
  const span = (S.win[S.win.length - 1].t - S.win[0].t) / 1000;
  if (span < 1) return 0;
  const d = S.win.reduce((a, b) => a + b.d, 0);
  return d / span;
}

/* -------------------------------- GPS -------------------------------- */
function setGps(acc) {
  GEO.acc = acc;
  GEO.ok = acc <= 30;
  const pct = Math.max(6, Math.min(100, 100 - (acc - 5) * 1.6));
  $('gps-fill').style.width = pct + '%';
  $('gps-txt').textContent = acc >= 900 ? '—' : '±' + Math.round(acc) + 'm';
  $('gps-box').classList.toggle('bad', acc > 35);
}

function onPos(pos) {
  const c = pos.coords || pos;
  const acc = c.accuracy || 999;
  const ts = pos.timestamp || Date.now();
  setGps(acc);
  const pt = {
    t: ts, lat: c.latitude, lon: c.longitude, acc,
    alt: (typeof c.altitude === 'number' && isFinite(c.altitude) ? c.altitude : 0)
  };

  if (!S.last) { S.last = pt; S.pts.push(pt); return; }
  if (ts <= S.last.t) return;

  const d = haversine(S.last, pt);
  const dt = (ts - S.last.t) / 1000;
  const v = d / dt;

  if (d > 6 && v > MAXV()) return;                       // salto imposible
  if (acc > 50) return;                                  // señal muy mala
  if (dt > 30 && S.status === 'running') S.gaps++;       // la app estuvo dormida

  if (S.status === 'paused' && S.autoPaused && v > 1.2) resume(true);
  if (d < 2.5) { S.last = pt; return; }                  // ruido con el móvil quieto

  if (S.status === 'running') {
    S.dist += d;
    if (v > 0.5) S.moveMs += dt * 1000;
    S.win.push({ t: ts, d });
    if (S.win.length > 40) S.win.shift();
    const cs = curSpeed();
    if (cs > S.maxV) S.maxV = cs;
    checkSplits();
  }
  S.last = pt;
  if (S.pts.length < 30000) S.pts.push(pt);
}

function onPosErr(e) {
  setGps(999);
  if (e.code === 1) toast('Permiso de ubicación denegado. Actívalo en el navegador.');
  else if (S.status === 'running') $('gps-txt').textContent = 'buscando';
}

// En la versión nativa (APK) existe este plugin: GPS con servicio en primer plano,
// que sigue grabando con la pantalla apagada.
function nativeGeo() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackgroundGeolocation) || null;
}

function startWatch() {
  stopWatch();
  const bg = nativeGeo();
  if (bg) {
    bg.addWatcher({
      backgroundMessage: 'Pulso está grabando tu ruta',
      backgroundTitle: 'Pulso',
      requestPermissions: true,
      stale: false,
      distanceFilter: 5
    }, (loc, err) => {
      if (err || !loc) { onPosErr({ code: 2 }); return; }
      onPos({
        timestamp: loc.time || Date.now(),
        coords: {
          latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy,
          altitude: loc.altitude, speed: loc.speed
        }
      });
    }).then((id) => { S.watchId = id; })
      .catch(() => toast('Falta el permiso de ubicación en segundo plano', 4000));
    return;
  }
  if (!navigator.geolocation) { toast('Este navegador no tiene GPS disponible.'); return; }
  S.watchId = navigator.geolocation.watchPosition(onPos, onPosErr, {
    enableHighAccuracy: true, maximumAge: 1000, timeout: 20000
  });
}

function stopWatch() {
  const bg = nativeGeo();
  if (bg) {
    if (S.watchId) { try { bg.removeWatcher({ id: S.watchId }); } catch {} }
    S.watchId = null;
    return;
  }
  if (S.watchId !== null) { navigator.geolocation.clearWatch(S.watchId); S.watchId = null; }
}

/* ------------------------------ avisos ------------------------------- */
function say(txt) {
  if (!PREFS.voice || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = 'es-ES'; u.rate = 1.05;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}
let AC = null;
function beep(freq = 880, dur = 0.16, n = 1) {
  if (!PREFS.beep) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    for (let i = 0; i < n; i++) {
      const t0 = AC.currentTime + i * (dur + 0.09);
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    }
  } catch {}
  if (navigator.vibrate) navigator.vibrate([120, 70, 120]);
}

/* ------------------------------- vueltas ------------------------------ */
function paceTxt(spk) { return S.sport === 'bike' ? fmtSpeed(3600 / spk) + ' km/h' : fmtPace(spk) + '/km'; }

function checkSplits() {
  const km = Math.floor(S.dist / KM);
  while (km >= S.nextKm) {
    const t = elapsedMs() / 1000;
    const prev = S.splits.length ? S.splits[S.splits.length - 1].t : 0;
    const split = { km: S.nextKm, t, partial: t - prev };
    S.splits.push(split);
    S.nextKm++;
    const spk = split.partial;
    if (S.sport === 'bike') say(`Kilómetro ${split.km}. ${fmtSpeed(3600 / spk)} kilómetros por hora.`);
    else say(`Kilómetro ${split.km}. Ritmo ${Math.floor(spk / 60)} minutos ${Math.round(spk % 60)} segundos.`);
    beep(1046, 0.1, 1);
  }
}

function addLap() {
  if (S.status === 'idle') return;
  const last = S.laps.length ? S.laps[S.laps.length - 1] : { dist: 0, t: 0 };
  S.laps.push({
    n: S.laps.length + 1,
    dist: S.dist - last.dist,
    t: elapsedMs() / 1000 - last.t
  });
  beep(660, 0.08, 1);
  toast('Vuelta ' + S.laps.length + ' · ' + num2(S.laps[S.laps.length - 1].dist / KM) + ' km');
}

/* ------------------------------- arranque ----------------------------- */
async function startRun() {
  if (S.status === 'running' || S.status === 'paused') return;

  if (!window.isSecureContext && !nativeGeo()) {
    toast('Abre la app en https:// para poder usar el GPS.', 5000);
    return;
  }
  if (!navigator.geolocation && !nativeGeo()) { toast('Este navegador no soporta GPS.'); return; }

  planInputs();
  if (!plan.dist && !plan.time && plan.goal !== 'none') plan.goal = 'none';

  Object.assign(S, {
    status: 'running', sport: plan.sport, elapsed: 0, lastResume: Date.now(),
    dist: 0, last: null, pts: [], win: [], maxV: 0, laps: [], splits: [],
    nextKm: 1, autoPaused: false, kcal: 0, gaps: 0, moveMs: 0,
    startedAt: Date.now(),
    goal: {
      type: plan.goal,
      val: plan.goal === 'distance' ? plan.dist * KM : plan.goal === 'time' ? plan.time : 0,
      pace: derivedPace()
    }
  });

  $('btn-pp').textContent = 'Pausa';
  $('ring-cap').textContent = 'Restante';
  showView('run');
  setGps(999);
  drawTrace();
  requestWake();
  keepAlive(true);          // dentro del gesto del usuario: el navegador permite el audio
  if (PREFS.spcontrol) ensureSpotify();

  // primer fix antes de arrancar el reloj (en el APK/app iOS lo gestiona el plugin)
  if (!nativeGeo()) {
    toast('Buscando señal GPS…', 1800);
    try {
      await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {
        enableHighAccuracy: true, timeout: 12000, maximumAge: 0
      }));
      S.lastResume = Date.now();
    } catch (e) {
      if (e && e.code === 1) { toast('Sin permiso de ubicación no puedo medir. Actívalo.', 5000); endRun(true); showView('home'); return; }
      S.lastResume = Date.now();
      toast('GPS débil, empiezo igual. Buscando satélites…', 3000);
    }
  }
  startWatch();
  clearInterval(S.tick);
  S.tick = setInterval(loop, 200);
  keepAlive(true);
  autosave(true);
}

function pause(auto) {
  if (S.status !== 'running') return;
  S.elapsed += Date.now() - S.lastResume;
  S.status = 'paused';
  S.autoPaused = !!auto;
  $('view-run').classList.add('paused');
  $('btn-pp').textContent = 'Seguir';
  $('live-label').textContent = auto ? 'Pausa auto' : 'En pausa';
  if (auto) beep(440, 0.08, 1);
}
function resume(auto) {
  if (S.status !== 'paused') return;
  S.status = 'running';
  S.lastResume = Date.now();
  S.autoPaused = false;
  $('view-run').classList.remove('paused');
  $('btn-pp').textContent = 'Pausa';
  $('live-label').textContent = S.sport === 'bike' ? 'Pedaleando' : 'Corriendo';
  if (auto) beep(880, 0.06, 1);
}

/* -------------------------------- bucle ------------------------------- */
function loop() {
  if (S.status === 'paused' || S.status === 'running') renderLive();
  if (S.status !== 'running') return;

  if (PREFS.autopause) {
    const span = S.win.length ? (S.win[S.win.length - 1].t - S.win[0].t) / 1000 : 0;
    if (span > 8 && curSpeed() < 0.45) pause(true);
  }
  autosave();

  const g = S.goal;
  if (g.type === 'distance' && g.val > 0 && S.dist >= g.val) finish();
  else if (g.type === 'time' && g.val > 0 && elapsedMs() / 1000 >= g.val) finish();
}

function ring(p) {
  const C = 552.92;
  $('ring').style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, p))));
}

// ajusta el tamaño del número grande para que nunca se salga del círculo
function fitBig() {
  const el = $('ring-big');
  const t = (el.textContent || '').trim().replace(/[a-z]+$/i, '');
  el.style.fontSize = t.length > 7 ? '30px' : t.length > 5 ? '38px' : '';
}

let lastTrace = 0;
function renderLive() {
  const sec = elapsedMs() / 1000;
  const km = S.dist / KM;
  const avgSpk = S.dist > 0.5 ? sec / km : 0;            // s/km
  const avgKmh = km > 0.001 ? km / (sec / 3600) : 0;
  const cs = curSpeed();
  // ritmo instantáneo (s/km) a partir de m/s -> 1000/mps segundos
  const curPace = cs > 0.4 ? 1000 / cs : 0;

  $('m-time').textContent = fmtClock(sec);
  $('m-dist').textContent = num2(km);
  if (S.sport === 'bike') {
    $('m-cur').textContent = fmtSpeed(cs * 3.6);
    $('m-avg').textContent = fmtSpeed(avgKmh);
  } else {
    $('m-cur').textContent = fmtPace(curPace);
    $('m-avg').textContent = fmtPace(avgSpk);
  }

  const g = S.goal;
  if (g.type === 'distance' && g.val > 0) {
    const rem = Math.max(0, g.val - S.dist);
    ring(S.dist / g.val);
    $('ring-cap').textContent = 'Restante';
    $('ring-big').innerHTML = num2(rem / KM) + '<span class="u">km</span>';
    $('ring-sub').textContent = fmtClock(sec) + ' · ' + num2(km) + ' de ' + num2(g.val / KM) + ' km';
  } else if (g.type === 'time' && g.val > 0) {
    const rem = Math.max(0, g.val - sec);
    ring(sec / g.val);
    $('ring-cap').textContent = 'Restante';
    $('ring-big').innerHTML = fmtClock(rem);
    const targetKm = derivedDist();
    $('ring-sub').textContent = num2(km) + ' km' + (targetKm ? ' · meta ' + num2(targetKm) + ' km' : '');
  } else {
    ring(0);
    $('ring').style.strokeDashoffset = '552.92';
    $('ring-cap').textContent = 'Distancia';
    $('ring-big').innerHTML = num2(km) + '<span class="u">km</span>';
    $('ring-sub').textContent = fmtClock(sec) + (S.sport === 'bike' ? ' · ' + fmtSpeed(avgKmh) + ' km/h' : ' · ' + fmtPace(avgSpk) + '/km');
  }

  fitBig();
  if (Date.now() - lastTrace > 900) { drawTrace(); lastTrace = Date.now(); }
}

/* ---------------------------- dibujar ruta ---------------------------- */
function drawTrace() { drawPath($('trace'), S.pts); }

function drawPath(cv, rawPts) {
  if (!cv) return;
  const pts = (rawPts || []).map((p) => (Array.isArray(p) ? { lat: p[0], lon: p[1] } : p));
  const w = cv.clientWidth || 320, h = cv.clientHeight || 118;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (pts.length < 2) {
    ctx.strokeStyle = '#1a2432'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#33404f'; ctx.font = '11px -apple-system,system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('El recorrido aparecerá aquí', w / 2, h / 2 - 8);
    return;
  }

  let arr = pts;
  if (arr.length > 900) {
    const step = Math.ceil(arr.length / 900);
    arr = arr.filter((_, i) => i % step === 0);
    arr.push(pts[pts.length - 1]);
  }

  const midLat = (arr[0].lat + arr[arr.length - 1].lat) / 2 * Math.PI / 180;
  const kx = Math.cos(midLat);
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  const xy = arr.map((p) => {
    const x = p.lon * kx, y = -p.lat;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    return { x, y };
  });
  const dx = maxX - minX || 1e-6, dy = maxY - minY || 1e-6;
  const pad = 12;
  const s = Math.min((w - pad * 2) / dx, (h - pad * 2) / dy);
  const ox = (w - dx * s) / 2, oy = (h - dy * s) / 2;
  const proj = (p) => ({ x: (p.x - minX) * s + ox, y: (p.y - minY) * s + oy });

  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#ff5a3c';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = accent; ctx.globalAlpha = 0.18; ctx.lineWidth = 6;
  ctx.beginPath();
  xy.forEach((p, i) => { const q = proj(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
  ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineWidth = 2.2;
  ctx.beginPath();
  xy.forEach((p, i) => { const q = proj(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
  ctx.stroke();

  const a = proj(xy[0]), b = proj(xy[xy.length - 1]);
  ctx.fillStyle = '#34d399';
  ctx.beginPath(); ctx.arc(a.x, a.y, 3.6, 0, 7); ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(b.x, b.y, 4.6, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.arc(b.x, b.y, 1.8, 0, 7); ctx.fill();
}

/* ------------------------------- final -------------------------------- */
async function finish() {
  if (S.status === 'idle' || S.status === 'done') return;
  if (S.status === 'running') S.elapsed += Date.now() - S.lastResume;
  S.status = 'done';
  clearInterval(S.tick);
  stopWatch();
  releaseWake();
  keepAlive(false);

  const sec = S.elapsed / 1000, km = S.dist / KM;
  S.kcal = Math.round(km * (S.sport === 'bike' ? 28 : 62));
  beep(1200, 0.18, 3);
  if (PREFS.voice) say(`Terminaste. ${num2(km)} kilómetros en ${Math.floor(sec / 60)} minutos.`);

  const rec = buildRecord();
  S.lastRec = rec;
  renderSummary(rec);
  showView('summary');
  try {
    const saved = await Store.putSession(rec);
    await Store.clearActive();
    if (!saved) toast('Guardado sin recorrido: sin espacio en el móvil', 4000);
  } catch {
    toast('No se pudo guardar el recorrido', 4000);
  }
}

// arma el registro completo (estadísticas + recorrido simplificado)
function buildRecord() {
  const sec = S.elapsed / 1000;
  const el = Store.elevation(S.pts);
  return {
    id: S.startedAt || Date.now(),
    date: new Date(S.startedAt || Date.now()).toISOString(),
    sport: S.sport,
    dist: S.dist,
    dur: sec,
    move: S.moveMs / 1000,
    maxV: S.maxV,
    kcal: S.kcal,
    laps: S.laps,
    splits: S.splits,
    goal: { type: S.goal.type, val: S.goal.val },
    up: el.up, down: el.down, elev: el.known,
    gaps: S.gaps,
    track: Store.simplify(S.pts, 3)
  };
}

function renderSummary(rec) {
  const km = rec.dist / KM, sec = rec.dur;
  const avgSpk = km > 0.001 ? sec / km : 0;
  const avgKmh = km > 0.001 ? km / (sec / 3600) : 0;

  $('sum-cap').textContent = rec.sport === 'bike' ? 'Ciclismo' : 'Carrera';
  $('sum-big').innerHTML = num2(km) + ' <span style="font-size:.42em;color:var(--muted)">km</span>';
  const d = new Date(rec.date);
  $('sum-sub').textContent = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  $('sum-time').textContent = fmtClock(sec);
  $('sum-move').textContent = fmtClock(rec.move || sec);
  if ($('sum-elev')) $('sum-elev').textContent = rec.elev ? '+' + rec.up + ' m / -' + rec.down + ' m' : '—';
  if ($('sum-note')) {
    $('sum-note').textContent = rec.gaps
      ? `⚠ ${rec.gaps} tramo(s) sin señal GPS: la distancia en esos huecos es una estimación en línea recta.`
      : 'Recorrido guardado con todos los puntos GPS.';
  }
  if (rec.sport === 'bike') {
    $('sum-avg').textContent = fmtSpeed(avgKmh) + ' km/h';
    $('sum-best').textContent = bestSplit(rec, true);
    $('sum-max').textContent = fmtSpeed(rec.maxV * 3.6) + ' km/h';
  } else {
    $('sum-avg').textContent = fmtPace(avgSpk) + ' /km';
    $('sum-best').textContent = bestSplit(rec, false);
    $('sum-max').textContent = fmtSpeed(rec.maxV * 3.6) + ' km/h';
  }
  $('sum-kcal').textContent = rec.kcal + ' kcal';

  const laps = rec.laps || [];
  $('sum-laps-n').textContent = laps.length ? laps.length + ' vueltas' : '0';
  $('sum-laps').innerHTML = laps.length
    ? laps.map((l) => `<div class="stat" style="border-radius:0"><span>Vuelta ${l.n} · ${num2(l.dist / KM)} km</span><b>${fmtClock(l.t)}</b></div>`).join('')
    : 'Sin vueltas manuales.';
}

function bestSplit(rec, bike) {
  const sp = (rec.splits || []).filter((s) => s.km > 0);
  if (!sp.length) return '—';
  let best = sp[0];
  for (const s of sp) if (s.partial < best.partial) best = s;
  return bike ? fmtSpeed(3600 / best.partial) + ' km/h' : fmtPace(best.partial) + ' /km';
}

function endRun(silent) {
  S.status = 'idle';
  clearInterval(S.tick);
  stopWatch();
  releaseWake();
  keepAlive(false);
  Store.clearActive();
  $('view-run').classList.remove('paused');
  S.pts = []; S.dist = 0; S.elapsed = 0; S.moveMs = 0; S.gaps = 0;
  if (!silent) showView('home');
}

/* --------------------------- pantalla activa -------------------------- */
let wakeLock = null;
async function requestWake() {
  if (!PREFS.wake || !('wakeLock' in navigator)) return;
  try {
    if (wakeLock) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {}
}
function releaseWake() { try { if (wakeLock) wakeLock.release(); } catch {} wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (S.status === 'running') { requestWake(); keepAlive(true); }
  } else {
    autosave(true);                      // guarda antes de que el sistema nos duerma
  }
});
document.addEventListener('freeze', () => autosave(true));
window.addEventListener('pagehide', () => autosave(true));

/* ---------- mantener la grabación viva con la pantalla apagada ---------- */
const KA = { el: null, url: null, on: false };

// WAV de 1 segundo en silencio, generado en el móvil: 0 KB descargados.
function silentWav() {
  const rate = 8000, n = rate;
  const buf = new ArrayBuffer(44 + n), dv = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true); ws(36, 'data'); dv.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function keepAlive(on) {
  const native = !!nativeGeo();
  if (!on) {
    if (KA.el) { try { KA.el.pause(); } catch {} }
    KA.el = null; KA.on = false;
    if (KA.url) { try { URL.revokeObjectURL(KA.url); } catch {} KA.url = null; }
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'none'; } catch {} }
    if ($('live-note')) $('live-note').textContent = 'Pantalla activa para no perder el GPS';
    return;
  }
  if (native) {
    // En el APK el GPS corre en un servicio en primer plano: no necesita audio.
    setMediaSession();
    if ($('live-note')) $('live-note').textContent = 'Grabando en segundo plano · puedes apagar la pantalla';
    return;
  }
  if (KA.on) { setMediaSession(); return; }
  try {
    if (!KA.url) KA.url = silentWav();
    const a = new Audio(KA.url);
    a.loop = true; a.volume = 0.001;
    const done = () => {
      KA.el = a; KA.on = true; setMediaSession();
      if ($('live-note')) $('live-note').textContent = 'Grabando · no bloquees la pantalla';
    };
    const p = a.play();
    if (p && p.then) p.then(done).catch(() => {
      if ($('live-note')) $('live-note').textContent = 'Toca la pantalla una vez para mantener la grabación';
    });
    else done();
  } catch {}
}

// Controles en la pantalla de bloqueo / auriculares
function setMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    if (typeof MediaMetadata === 'function') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Grabando ruta',
        artist: 'Pulso',
        album: S.sport === 'bike' ? 'Ciclismo' : 'Carrera',
        artwork: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }]
      });
    }
    navigator.mediaSession.setActionHandler('play', () => { if (S.status === 'paused') resume(false); });
    navigator.mediaSession.setActionHandler('pause', () => { if (S.status === 'running') pause(false); });
    navigator.mediaSession.playbackState = S.status === 'running' ? 'playing' : 'paused';
  } catch {}
}

/* ---------- autoguardado: si el móvil cierra la app, no se pierde ---------- */
let lastAuto = 0;
function autosave(force) {
  if (S.status !== 'running' && S.status !== 'paused') return;
  const now = Date.now();
  if (!force && now - lastAuto < 12000) return;
  lastAuto = now;
  Store.setActive({
    v: 2, startedAt: S.startedAt, savedAt: now, sport: S.sport, status: S.status,
    elapsed: S.elapsed, lastResume: S.lastResume, dist: S.dist, moveMs: S.moveMs,
    maxV: S.maxV, gaps: S.gaps, laps: S.laps, splits: S.splits, nextKm: S.nextKm,
    goal: S.goal, pts: S.pts, kcal: S.kcal
  }).catch(() => {});
}

/* ---------- recuperar una sesión que quedó a medias ---------- */
function ago(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.floor(m / 60);
  if (h < 24) return 'hace ' + h + ' h';
  return 'hace ' + Math.floor(h / 24) + ' días';
}

async function checkRecovery() {
  let a = null;
  try { a = await Store.getActive(); } catch { return; }
  if (!a || !a.startedAt) return;
  if (Date.now() - (a.savedAt || a.startedAt) > 36 * 3600 * 1000) { Store.clearActive(); return; }
  $('recover-txt').textContent = num2((a.dist || 0) / KM) + ' km · ' +
    fmtClock((a.elapsed || 0) / 1000) + ' · ' + ago(Date.now() - (a.savedAt || a.startedAt));
  $('recover').style.display = 'flex';
  $('rec-go').onclick = () => saveRecovered(a);
  $('rec-drop').onclick = async () => {
    await Store.clearActive();
    $('recover').style.display = 'none';
    toast('Sesión descartada');
  };
}

async function saveRecovered(a) {
  const pts = a.pts || [];
  const el = Store.elevation(pts);
  const rec = {
    id: a.startedAt,
    date: new Date(a.startedAt).toISOString(),
    sport: a.sport || 'run',
    dist: a.dist || 0,
    dur: (a.elapsed || 0) / 1000,
    move: (a.moveMs || 0) / 1000,
    maxV: a.maxV || 0,
    kcal: Math.round(((a.dist || 0) / KM) * (a.sport === 'bike' ? 28 : 62)),
    laps: a.laps || [], splits: a.splits || [],
    goal: a.goal || { type: 'none', val: 0 },
    up: el.up, down: el.down, elev: el.known, gaps: a.gaps || 0,
    track: Store.simplify(pts, 3),
    recovered: true
  };
  await Store.putSession(rec);
  await Store.clearActive();
  $('recover').style.display = 'none';
  S.lastRec = rec;
  renderSummary(rec);
  showView('summary');
  toast('Sesión recuperada y guardada');
}

// trae al historial nuevo los entrenamientos de la versión anterior
async function migrateLegacy() {
  const old = LS.get('history', []);
  if (!old.length) return;
  const have = await Store.allSessions().catch(() => []);
  if (!have.length) {
    for (const r of old) {
      await Store.putSession({
        ...r, move: r.dur, track: [], up: 0, down: 0, elev: false, gaps: 0
      }).catch(() => {});
    }
  }
  LS.del('history');
}

/* ------------------------------ historial ----------------------------- */
async function renderHistory() {
  const hist = await Store.allSessions();
  const totKm = hist.reduce((a, r) => a + r.dist, 0) / KM;
  const totS = hist.reduce((a, r) => a + r.dur, 0);
  $('h-d1').textContent = hist.length;
  $('h-d2').textContent = num1(totKm);
  $('h-d3').textContent = totS >= 3600 ? num1(totS / 3600) + 'h' : Math.round(totS / 60) + 'm';

  const box = $('hist-list');
  if (!hist.length) {
    box.innerHTML = '<div class="empty">Aún no hay entrenamientos guardados.<br>Todo se queda en este teléfono.</div>';
    return;
  }
  box.innerHTML = hist.slice(0, 60).map((r) => {
    const d = new Date(r.date);
    const km = r.dist / KM, sec = r.dur;
    const pace = km > 0.01 ? (r.sport === 'bike' ? fmtSpeed(km / (sec / 3600)) + ' km/h' : fmtPace(sec / km) + '/km') : '—';
    const pts = (r.track || []).length;
    return `<div class="hitem" data-id="${r.id}">
      <div class="hico">${r.sport === 'bike' ? '🚴' : '🏃'}</div>
      <div class="n"><b>${num2(km)} km · ${fmtClock(sec)}</b>
        <i>${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} · ${pace}${pts ? ' · ruta' : ''}</i></div>
      <div class="r">${r.elev ? '+' + r.up + 'm' : r.kcal + ' kcal'}<br>
        <span class="dim" style="font-size:10px">${r.elev ? 'desnivel' : 'kcal'}</span></div>
    </div>`;
  }).join('');
}

/* ------------------------- detalle de un recorrido -------------------- */
let detailRec = null;

async function openDetail(id) {
  const rec = await Store.getSession(Number(id) || id);
  if (!rec) { toast('No se encontró ese recorrido'); return; }
  detailRec = rec;

  const km = rec.dist / KM, sec = rec.dur;
  const avgSpk = km > 0.001 ? sec / km : 0;
  const avgKmh = km > 0.001 ? km / (sec / 3600) : 0;
  const d = new Date(rec.date);

  $('d-cap').textContent = rec.sport === 'bike' ? 'Ciclismo' : 'Carrera';
  $('d-big').innerHTML = num2(km) + ' <span style="font-size:.42em;color:var(--muted)">km</span>';
  $('d-sub').textContent = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const rows = [
    ['Tiempo', fmtClock(sec)],
    ['En movimiento', fmtClock(rec.move || sec)],
    [rec.sport === 'bike' ? 'Velocidad media' : 'Ritmo medio', rec.sport === 'bike' ? fmtSpeed(avgKmh) + ' km/h' : fmtPace(avgSpk) + ' /km'],
    ['Mejor km', bestSplit(rec, rec.sport === 'bike')],
    ['Velocidad máxima', fmtSpeed(rec.maxV * 3.6) + ' km/h'],
    ['Desnivel', rec.elev ? '+' + rec.up + ' m / -' + rec.down + ' m' : 'sin altímetro'],
    ['Calorías', rec.kcal + ' kcal'],
    ['Puntos GPS', (rec.track || []).length + (rec.gaps ? ' · ' + rec.gaps + ' hueco(s)' : '')]
  ];
  $('d-stats').innerHTML = rows.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');

  const sp = rec.splits || [];
  $('d-splits').innerHTML = sp.length
    ? sp.map((s) => `<div class="stat" style="border-radius:0;padding:9px 0"><span>Km ${s.km}</span><b>${fmtClock(s.partial)}</b></div>`).join('')
    : 'Sin parciales registrados.';

  showView('detail');
  setTimeout(() => drawPath($('detail-map'), rec.track || []), 60);
}

function recToCSV(rec) {
  const km = rec.dist / KM, sec = rec.dur;
  const p = km > 0.01 ? (rec.sport === 'bike' ? num1(km / (sec / 3600)) + ' km/h' : fmtPace(sec / km) + '/km') : '';
  return [new Date(rec.date).toISOString(), rec.sport === 'bike' ? 'ciclismo' : 'carrera',
    km.toFixed(2), fmtClock(sec), p, (rec.maxV * 3.6).toFixed(1), rec.kcal || 0,
    rec.elev ? rec.up : '', (rec.laps || []).length].join(',');
}

function gpxBlob(rec) {
  return new Blob([Store.toGPX(rec)], { type: 'application/gpx+xml' });
}

function capPlugin(name) {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
}

function b64utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function gpxName(rec) {
  return 'pulso-' + new Date(rec.date).toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.gpx';
}

async function exportGPX(rec) {
  if (!rec || !(rec.track || []).length) { toast('Ese recorrido no tiene puntos GPS'); return; }
  const xml = Store.toGPX(rec);
  const Fs = capPlugin('Filesystem'), Sh = capPlugin('Share');

  // dentro del APK: escribe el archivo y abre el menú de compartir del sistema
  if (Fs && Sh) {
    try {
      const w = await Fs.writeFile({ path: gpxName(rec), data: b64utf8(xml), directory: 'CACHE', recursive: true });
      await Sh.share({ title: 'Recorrido Pulso', url: w.uri, dialogTitle: 'Compartir recorrido' });
      return;
    } catch {
      toast('No se pudo exportar el GPX');
      return;
    }
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(gpxBlob(rec));
  a.download = gpxName(rec);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('GPX descargado');
}

async function shareGPX(rec) {
  if (!rec || !(rec.track || []).length) { toast('Ese recorrido no tiene puntos GPS'); return; }
  const Sh = capPlugin('Share');
  if (Sh) return exportGPX(rec);
  const file = new File([Store.toGPX(rec)], 'pulso.gpx', { type: 'application/gpx+xml' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Recorrido Pulso' }); return; } catch {}
  }
  exportGPX(rec);
}

function csvOf(rows) {
  const head = ['fecha','deporte','distancia_km','duracion','ritmo_o_velocidad','vel_max_kmh','desnivel_m','calorias','vueltas','puntos_gps'];
  const lines = [head.join(',')];
  rows.forEach((r) => {
    const km = r.dist / KM, sec = r.dur;
    const p = km > 0.01 ? (r.sport === 'bike' ? num1(km / (sec / 3600)) + ' km/h' : fmtPace(sec / km) + '/km') : '';
    lines.push([
      new Date(r.date).toISOString(), r.sport === 'bike' ? 'ciclismo' : 'carrera',
      km.toFixed(2), fmtClock(sec), p, (r.maxV * 3.6).toFixed(1),
      r.elev ? r.up : '', r.kcal || 0, (r.laps || []).length, (r.track || []).length
    ].join(','));
  });
  return lines.join('\n');
}
function download(name, text) {
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ------------------------------- Spotify ------------------------------ */
const SPT = Object.assign({ at: null, rt: null, exp: 0 }, LS.get('spt', {}));
function spSave() { LS.set('spt', SPT); }
const SP_SCOPES = 'user-read-playback-state user-modify-playback-state';
function spRedirect() { return location.origin + location.pathname; }

function b64url(buf) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randStr(n) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const u = new Uint8Array(n); crypto.getRandomValues(u);
  return Array.from(u).map((x) => a[x % a.length]).join('');
}

async function spConnect() {
  const cid = ($('sp-cid') && $('sp-cid').value.trim()) || LS.get('sp_cid', '');
  if (!cid) { openSheet(); toast('Pega tu Client ID de Spotify primero'); if ($('sp-cid')) $('sp-cid').focus(); return; }
  LS.set('sp_cid', cid);
  if (!crypto.subtle) { toast('Necesita https:// para conectar Spotify'); return; }
  const verifier = randStr(96);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const st = randStr(12);
  localStorage.setItem('pulso.sp_verifier', verifier);
  localStorage.setItem('pulso.sp_state', st);
  const u = new URL('https://accounts.spotify.com/authorize');
  u.searchParams.set('client_id', cid);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', spRedirect());
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('scope', SP_SCOPES);
  u.searchParams.set('state', st);
  location.href = u.toString();
}

async function spToken(body) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body)
  });
  if (!r.ok) throw new Error('token ' + r.status);
  return r.json();
}

async function spHandleCallback() {
  const q = new URLSearchParams(location.search);
  const code = q.get('code'), err = q.get('error'), st = q.get('state');
  if (err) { history.replaceState({}, '', location.pathname); toast('Spotify: permiso cancelado'); return; }
  if (!code) return;
  const verifier = localStorage.getItem('pulso.sp_verifier');
  const savedState = localStorage.getItem('pulso.sp_state');
  history.replaceState({}, '', location.pathname);
  if (st !== savedState || !verifier) { toast('No pude validar la conexión, intenta otra vez'); return; }
  try {
    const t = await spToken({
      grant_type: 'authorization_code', code,
      redirect_uri: spRedirect(), client_id: LS.get('sp_cid', ''), code_verifier: verifier
    });
    SPT.at = t.access_token; SPT.rt = t.refresh_token || SPT.rt;
    SPT.exp = Date.now() + (t.expires_in || 3600) * 1000 - 30000;
    spSave();
    PREFS.spcontrol = true; savePrefs();
    document.querySelectorAll('[data-tg]').forEach((b) => { if (b.dataset.tg === 'spcontrol') b.classList.add('on'); });
    toast('Spotify conectado');
    spRefreshUI();
  } catch (e) { toast('No se pudo conectar: revisa el Client ID y la Redirect URI'); }
}

async function spAccess() {
  if (SPT.at && Date.now() < SPT.exp) return SPT.at;
  if (!SPT.rt) throw new Error('sin sesión');
  const cid = LS.get('sp_cid', '');
  const t = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: SPT.rt, client_id: cid })
  }).then((r) => r.json());
  if (!t.access_token) throw new Error('refresh');
  SPT.at = t.access_token; SPT.exp = Date.now() + (t.expires_in || 3600) * 1000 - 30000;
  if (t.refresh_token) SPT.rt = t.refresh_token;
  spSave();
  return SPT.at;
}

async function spApi(path, opts = {}) {
  const at = await spAccess();
  const r = await fetch('https://api.spotify.com/v1' + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' }
  });
  if (r.status === 204) return null;
  if (r.status === 403) throw new Error('premium');
  if (r.status === 404) throw new Error('dispositivo');
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

async function spRefreshUI() {
  const connected = !!(SPT.rt || SPT.at);
  $('sp-status').textContent = connected ? 'Spotify conectado' : 'Spotify no conectado';
  $('sp-hint').textContent = connected ? 'Control disponible durante el entrenamiento' : 'Conéctalo en Ajustes para controlarlo desde aquí';
  $('sp-live').style.display = connected && PREFS.spcontrol ? 'flex' : 'none';
  if (!connected || !PREFS.spcontrol) return;
  try {
    const st = await spApi('/me/player');
    if (!st || !st.item) {
      $('sp-live-title').textContent = 'Sin reproducción';
      $('sp-live-sub').textContent = 'Abre Spotify y dale play';
      return;
    }
    $('sp-live-title').textContent = st.item.name;
    $('sp-live-sub').textContent = (st.item.artists || []).map((a) => a.name).join(', ') + (st.is_playing ? ' · sonando' : ' · en pausa');
    $('sp-toggle').innerHTML = st.is_playing
      ? '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>';
  } catch (e) {
    $('sp-live-title').textContent = e.message === 'premium' ? 'Requiere Premium' : 'Spotify';
    $('sp-live-sub').textContent = e.message === 'premium' ? 'El control necesita Spotify Premium' : 'Abre Spotify para continuar';
  }
}

async function spCmd(cmd) {
  try {
    if (cmd === 'toggle') {
      const st = await spApi('/me/player');
      if (st && st.is_playing) await spApi('/me/player/pause', { method: 'PUT' });
      else await spApi('/me/player/play', { method: 'PUT' });
    } else if (cmd === 'next') await spApi('/me/player/next', { method: 'POST' });
    else if (cmd === 'prev') await spApi('/me/player/previous', { method: 'POST' });
    setTimeout(spRefreshUI, 700);
  } catch (e) {
    if (e.message === 'premium') toast('El control remoto necesita Spotify Premium');
    else if (e.message === 'dispositivo') toast('Abre Spotify y dale play primero');
    else toast('No se pudo controlar Spotify');
  }
}

let spPoll = 0;
function spStartPolling() {
  clearInterval(spPoll);
  if (!PREFS.spcontrol || !SPT.rt) return;
  spPoll = setInterval(() => { if (S.status === 'running' && document.visibilityState === 'visible') spRefreshUI(); }, 15000);
}
function ensureSpotify() { spRefreshUI(); spStartPolling(); }

function openSpotifyApp() {
  const url = LS.get('sp_playlist', '') || 'https://open.spotify.com';
  if (capPlugin('Share') || nativeGeo()) {
    window.open(url, '_system');            // en el APK: abre la app de Spotify
    return;
  }
  location.href = url;
}

/* ------------------------------- sheet -------------------------------- */
function openSheet() { $('sheet').classList.add('on'); $('sheet-back').classList.add('on'); }
function closeSheet() { $('sheet').classList.remove('on'); $('sheet-back').classList.remove('on'); }

/* -------------------------------- eventos ----------------------------- */
document.querySelectorAll('#seg-sport button').forEach((b) => b.addEventListener('click', () => setSport(b.dataset.sport)));
document.querySelectorAll('#seg-goal button').forEach((b) => b.addEventListener('click', () => {
  plan.goal = b.dataset.goal; syncGoalSeg(); LS.set('plan', plan);
}));

let inputT;
['in-dist', 'in-time', 'in-pace'].forEach((id) => $(id).addEventListener('input', () => {
  clearTimeout(inputT); inputT = setTimeout(renderPlan, 180);
}));

$('btn-start').addEventListener('click', startRun);
$('btn-pp').addEventListener('click', () => {
  if (S.status === 'running') pause(false);
  else if (S.status === 'paused') resume(false);
});
$('btn-lap').addEventListener('click', addLap);
$('btn-stop').addEventListener('click', () => {
  if (S.status === 'running' || S.status === 'paused') finish();
  else showView('home');
});

$('btn-done').addEventListener('click', () => { endRun(false); renderHistory(); });
$('btn-again').addEventListener('click', () => { endRun(false); renderHistory(); });
$('btn-history').addEventListener('click', () => { renderHistory(); showView('history'); });
$('btn-hist-back').addEventListener('click', () => showView('home'));

// abrir el detalle de un recorrido guardado
$('hist-list').addEventListener('click', (e) => {
  const row = e.target.closest ? e.target.closest('.hitem') : null;
  if (row && row.dataset.id) openDetail(row.dataset.id);
});
$('btn-detail-back').addEventListener('click', () => { renderHistory(); showView('history'); });
$('d-gpx').addEventListener('click', () => exportGPX(detailRec));
$('d-csv').addEventListener('click', () => {
  if (!detailRec) return;
  download('recorrido-' + new Date(detailRec.date).toISOString().slice(0, 10) + '.csv', csvOf([detailRec]));
  toast('CSV descargado');
});
$('d-share').addEventListener('click', () => shareGPX(detailRec));
$('d-del').addEventListener('click', async () => {
  if (!detailRec) return;
  if (!confirm('¿Borrar este recorrido? No se puede deshacer.')) return;
  await Store.delSession(detailRec.id);
  detailRec = null;
  toast('Recorrido borrado');
  renderHistory();
  showView('history');
});
$('btn-settings').addEventListener('click', openSheet);
$('btn-sheet-close').addEventListener('click', closeSheet);
$('sheet-back').addEventListener('click', closeSheet);

$('btn-export').addEventListener('click', () => {
  if (!S.lastRec) return;
  download('entrenamiento-' + new Date(S.lastRec.date).toISOString().slice(0, 10) + '.csv', csvOf([S.lastRec]));
  toast('CSV descargado');
});
$('btn-export-all').addEventListener('click', async () => {
  const h = await Store.allSessions();
  if (!h.length) { toast('Todavía no hay sesiones'); return; }
  download('pulso-historial.csv', csvOf(h));
  toast('Historial exportado');
});
$('btn-clear').addEventListener('click', async () => {
  if (!confirm('¿Borrar todo el historial de este teléfono? No se puede deshacer.')) return;
  await Store.clearSessions();
  renderHistory();
  toast('Historial borrado');
});

$('sp-open').addEventListener('click', openSpotifyApp);
$('sp-connect').addEventListener('click', spConnect);
$('sp-disconnect').addEventListener('click', () => {
  SPT.at = null; SPT.rt = null; SPT.exp = 0; spSave();
  PREFS.spcontrol = false; savePrefs();
  document.querySelectorAll('[data-tg]').forEach((b) => { if (b.dataset.tg === 'spcontrol') b.classList.remove('on'); });
  spRefreshUI(); spStartPolling(); toast('Spotify desconectado');
});
$('sp-toggle').addEventListener('click', () => spCmd('toggle'));
$('sp-next').addEventListener('click', () => spCmd('next'));
$('sp-prev').addEventListener('click', () => spCmd('prev'));

const plIn = $('sp-playlist');
plIn.value = LS.get('sp_playlist', '');
plIn.addEventListener('change', () => { LS.set('sp_playlist', plIn.value.trim()); toast('Enlace guardado'); });

/* -------------------------------- init -------------------------------- */
(function init() {
  // restaurar campos
  if (plan.dist) $('in-dist').value = String(plan.dist).replace('.', ',');
  if (plan.time) $('in-time').value = fmtTime(plan.time);
  if (plan.pace) $('in-pace').value = plan.sport === 'bike' ? num1(plan.pace) : fmtPace(plan.pace);

  setSport(plan.sport === 'bike' ? 'bike' : 'run');
  syncGoalSeg();
  $('sp-cid').value = LS.get('sp_cid', '');
  $('sp-redirect').textContent = spRedirect();

  // dentro del APK/app iOS la conexión OAuth no aplica: solo el atajo a la app de Spotify
  if (nativeGeo() && $('sp-oauth')) $('sp-oauth').style.display = 'none';

  // historial: migra lo viejo y ofrece recuperar una sesión que quedó a medias
  migrateLegacy().then(checkRecovery).catch(() => {});

  spRefreshUI();
  spHandleCallback();

  // tamaño del canvas cuando cambia la pantalla
  window.addEventListener('resize', () => setTimeout(drawTrace, 120));

  // service worker (caché offline)
  // en el APK no hace falta caché: los archivos ya viven dentro de la app
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !nativeGeo()) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // evitar zoom accidental con doble toque
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch < 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
})();
