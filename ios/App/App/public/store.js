/* =====================================================================
   Pulso — almacenamiento de recorridos
   IndexedDB para las rutas (aguanta miles de puntos), con respaldo
   en localStorage si IndexedDB no está disponible.
   ===================================================================== */
'use strict';

const Store = (() => {
  const NAME = 'pulso-db', VER = 1;
  let dbp = null, broken = false;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!('indexedDB' in window)) { rej(new Error('sin indexedDB')); return; }
      let r;
      try { r = indexedDB.open(NAME, VER); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('idb'));
      r.onblocked = () => rej(new Error('idb bloqueado'));
    }).catch((e) => { broken = true; throw e; });
    return dbp;
  }

  function os(db, name, mode) { return db.transaction(name, mode).objectStore(name); }
  function wrap(request) {
    return new Promise((res, rej) => {
      request.onsuccess = () => res(request.result);
      request.onerror = () => rej(request.error);
    });
  }

  /* ---------- respaldo en localStorage ---------- */
  const LSK = 'pulso.sessions';
  function lsAll() { try { return JSON.parse(localStorage.getItem(LSK) || '[]'); } catch { return []; } }
  function lsSave(list) {
    try { localStorage.setItem(LSK, JSON.stringify(list)); return true; }
    catch {
      // sin espacio: guarda sin el recorrido, las estadísticas se conservan
      const slim = list.map((r) => { const c = { ...r }; delete c.track; return c; });
      try { localStorage.setItem(LSK, JSON.stringify(slim)); } catch {}
      return false;
    }
  }

  /* ---------- API ---------- */
  async function putSession(rec) {
    try {
      const db = await open();
      await wrap(os(db, 'sessions', 'readwrite').put(rec));
      return true;
    } catch {
      const list = lsAll().filter((r) => r.id !== rec.id);
      list.unshift(rec);
      return lsSave(list);
    }
  }

  async function allSessions() {
    try {
      const db = await open();
      const list = await wrap(os(db, 'sessions', 'readonly').getAll());
      return list.sort((a, b) => b.id - a.id);
    } catch {
      return lsAll().sort((a, b) => b.id - a.id);
    }
  }

  async function getSession(id) {
    try {
      const db = await open();
      return await wrap(os(db, 'sessions', 'readonly').get(id));
    } catch {
      return lsAll().find((r) => r.id === id) || null;
    }
  }

  async function delSession(id) {
    try {
      const db = await open();
      await wrap(os(db, 'sessions', 'readwrite').delete(id));
    } catch {
      lsSave(lsAll().filter((r) => r.id !== id));
    }
  }

  async function clearSessions() {
    try {
      const db = await open();
      await wrap(os(db, 'sessions', 'readwrite').clear());
    } catch {}
    try { localStorage.removeItem(LSK); } catch {}
  }

  /* ---------- sesión en curso (para recuperar si el móvil la cierra) ---------- */
  async function setActive(rec) {
    try {
      const db = await open();
      await wrap(os(db, 'meta', 'readwrite').put({ k: 'active', rec }));
    } catch {
      try { localStorage.setItem('pulso.active', JSON.stringify(rec)); } catch {}
    }
  }
  async function getActive() {
    try {
      const db = await open();
      const row = await wrap(os(db, 'meta', 'readonly').get('active'));
      return row ? row.rec : null;
    } catch {
      try { return JSON.parse(localStorage.getItem('pulso.active') || 'null'); } catch { return null; }
    }
  }
  async function clearActive() {
    try {
      const db = await open();
      await wrap(os(db, 'meta', 'readwrite').delete('active'));
    } catch {}
    try { localStorage.removeItem('pulso.active'); } catch {}
  }

  /* ---------- simplificar el recorrido (Douglas-Peucker) ---------- */
  const M_PER_DEG = 111320;

  function segDist2(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    return (px - cx) ** 2 + (py - cy) ** 2;
  }

  function simplify(pts, tolM = 3) {
    const n = pts.length;
    if (n <= 2) return pts.map((p) => [p.lat, p.lon, p.t, p.alt || 0]);
    const midLat = ((pts[0].lat + pts[n - 1].lat) / 2) * Math.PI / 180;
    const kx = Math.cos(midLat) || 1;
    const X = (i) => pts[i].lon * kx, Y = (i) => pts[i].lat;
    const tol2 = (tolM / M_PER_DEG) ** 2;
    const keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
      const pair = stack.pop(), a = pair[0], b = pair[1];
      let maxD = -1, idx = -1;
      for (let i = a + 1; i < b; i++) {
        const d = segDist2(X(i), Y(i), X(a), Y(a), X(b), Y(b));
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > tol2 && idx > a && idx < b) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    const out = [];
    for (let i = 0; i < n; i++) if (keep[i]) out.push([pts[i].lat, pts[i].lon, pts[i].t, pts[i].alt || 0]);
    if (out.length > 4000) {
      const step = Math.ceil(out.length / 4000);
      const dec = out.filter((_, i) => i % step === 0);
      if (dec[dec.length - 1] !== out[out.length - 1]) dec.push(out[out.length - 1]);
      return dec;
    }
    return out;
  }

  /* ---------- desnivel con filtro (el altímetro del móvil es ruidoso) ---------- */
  function elevation(pts) {
    const raw = pts.map((p) => (typeof p.alt === 'number' && isFinite(p.alt) ? p.alt : null)).filter((a) => a !== null && a !== 0);
    if (raw.length < 10) return { up: 0, down: 0, min: 0, max: 0, known: false };
    // media móvil de 5
    const s = [];
    for (let i = 0; i < raw.length; i++) {
      const a = raw[Math.max(0, i - 2)], b = raw[Math.min(raw.length - 1, i + 2)];
      s.push((a + raw[i] + b) / 3);
    }
    let up = 0, down = 0, min = Infinity, max = -Infinity, ref = s[0];
    for (const h of s) {
      if (h < min) min = h;
      if (h > max) max = h;
      const d = h - ref;
      if (d >= 3) { up += d; ref = h; }
      else if (d <= -3) { down += -d; ref = h; }
    }
    return { up: Math.round(up), down: Math.round(down), min: Math.round(min), max: Math.round(max), known: true };
  }

  /* ---------- GPX 1.1 (para Strava, Garmin, Google Earth…) ---------- */
  function toGPX(rec) {
    const pts = rec.track || [];
    const name = (rec.sport === 'bike' ? 'Bici ' : 'Carrera ') + new Date(rec.date).toISOString().slice(0, 16).replace('T', ' ');
    const trk = pts.map((p) => {
      const ele = p[3] ? '<ele>' + Math.round(p[3]) + '</ele>' : '';
      return '<trkpt lat="' + p[0].toFixed(6) + '" lon="' + p[1].toFixed(6) + '">' + ele +
        '<time>' + new Date(p[2]).toISOString() + '</time></trkpt>';
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<gpx version="1.1" creator="Pulso" xmlns="http://www.topografix.com/GPX/1/1">\n' +
      '<metadata><name>' + name.replace(/[<>&]/g, '') + '</name><time>' + new Date(rec.date).toISOString() + '</time></metadata>\n' +
      '<trk><name>' + name.replace(/[<>&]/g, '') + '</name><type>' + (rec.sport === 'bike' ? 'cycling' : 'running') + '</type>\n' +
      '<trkseg>' + trk + '</trkseg></trk>\n</gpx>\n';
  }

  return {
    putSession, allSessions, getSession, delSession, clearSessions,
    setActive, getActive, clearActive,
    simplify, elevation, toGPX
  };
})();
