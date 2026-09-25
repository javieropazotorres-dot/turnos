/*
 * Store: capa de datos de la app (window.Store).
 * Local-first: todo se guarda en localStorage y la app funciona sin conexión.
 * Con sesión iniciada en Supabase, cada cambio entra a una cola (outbox) que se sube cuando hay red,
 * y luego se descarga el estado de la nube, que pasa a ser la verdad.
 */
(function () {
  var KEY = 'turnos:v1', OUTBOX_KEY = 'turnos:outbox', LINK_KEY = 'turnos:linked', LASTSYNC_KEY = 'turnos:lastSync';
  var PAGE = 1000;
  var listeners = [];

  var SEED = {
    version: 1,
    places: [
      { id: 'sar-san-clemente', name: 'SAR San Clemente', rate: 0, color: 0, order: 1 },
      { id: 'sar-la-florida', name: 'SAR La Florida', rate: 0, color: 1, order: 2 },
      { id: 'clinica-los-andes', name: 'Clínica Los Andes', rate: 0, color: 2, order: 3 }
    ],
    shifts: [],
    perfil: { nombre: 'María Fernanda Urrutia Bucarey', titulo: 'doctora' },
    lastBackup: null
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function lsGet(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }

  var cfg = window.TURNOS_CONFIG || {};
  var sb = null;
  if (cfg.supabaseUrl && cfg.supabaseKey && window.supabase && window.supabase.createClient) {
    try {
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'turnos:auth' }
      });
    } catch (e) { console.error(e); sb = null; }
  }

  var data = null;
  var outbox = lsGet(OUTBOX_KEY, []);
  var user = null;
  var running = null, again = false;
  // status: off (sin Supabase) · out (sin sesión) · syncing · ok · offline · error
  var sync = { status: sb ? 'out' : 'off', email: '', lastSync: lsGet(LASTSYNC_KEY, null) };

  function load() {
    data = lsGet(KEY, null);
    if (!data || !Array.isArray(data.places) || !Array.isArray(data.shifts)) {
      data = clone(SEED);
      persist();
    }
  }
  function persist() {
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  }
  function emit() {
    var snap = Store.getState();
    listeners.forEach(function (fn) { try { fn(snap); } catch (e) { console.error(e); } });
  }
  function save() { persist(); emit(); }
  function setStatus(s) { if (sync.status !== s) { sync.status = s; emit(); } }

  function validBackup(o) {
    return o && Array.isArray(o.places) && Array.isArray(o.shifts) && o.places.every(function (p) {
      return p && typeof p.id === 'string' && typeof p.name === 'string';
    }) && o.shifts.every(function (s) {
      return s && typeof s.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && Number(s.hours) > 0;
    });
  }

  // --- Conversión local ↔ nube ---
  function placeRow(p) {
    return { user_id: user.id, id: p.id, name: p.name, rate: Math.max(0, Math.round(Number(p.rate) || 0)), color: Number(p.color) || 0, sort: Number(p.order) || 0 };
  }
  function shiftRow(s) {
    return { user_id: user.id, id: s.id, date: s.date, start: s.start || '08:00', hours: Number(s.hours), place_id: s.placeId, place_name: s.placeName || '', created_at: s.createdAt || new Date().toISOString() };
  }
  function perfilRow(p) { return { user_id: user.id, nombre: p.nombre || '', titulo: p.titulo === 'Dra.' ? 'Dra.' : 'doctora' }; }
  function fromPlace(r) { return { id: r.id, name: r.name, rate: Number(r.rate) || 0, color: Number(r.color) || 0, order: Number(r.sort) || 0 }; }
  function fromShift(r) { return { id: r.id, date: r.date, start: r.start, hours: Number(r.hours), placeId: r.place_id, placeName: r.place_name, createdAt: r.created_at }; }

  // --- Llamadas a Supabase ---
  function check(res) { if (res.error) { throw res.error; } return res.data; }
  // Un error con código SQLSTATE (ej. 23514, 42501) no se arregla reintentando.
  function permanent(err) { return !!(err && typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code) && /^\d/.test(err.code)); }

  async function fetchAll(table) {
    var out = [], from = 0;
    for (;;) {
      var rows = check(await sb.from(table).select('*').order('id').range(from, from + PAGE - 1));
      out = out.concat(rows);
      if (rows.length < PAGE) { return out; }
      from += PAGE;
    }
  }
  async function insertMissing(table, rows) {
    for (var i = 0; i < rows.length; i += PAGE) {
      check(await sb.from(table).upsert(rows.slice(i, i + PAGE), { onConflict: 'user_id,id', ignoreDuplicates: true }));
    }
  }

  async function run(op) {
    if (op.t === 'shift') { check(await sb.from('shifts').upsert(shiftRow(op.row), { onConflict: 'user_id,id' })); }
    else if (op.t === 'delShift') { check(await sb.from('shifts').delete().eq('user_id', user.id).eq('id', op.id)); }
    else if (op.t === 'place') { check(await sb.from('places').upsert(placeRow(op.row), { onConflict: 'user_id,id' })); }
    else if (op.t === 'perfil') { check(await sb.from('perfil').upsert(perfilRow(data.perfil), { onConflict: 'user_id' })); }
    else if (op.t === 'replaceAll') {
      check(await sb.from('shifts').delete().eq('user_id', user.id));
      check(await sb.from('places').delete().eq('user_id', user.id));
      await insertMissing('places', data.places.map(placeRow));
      await insertMissing('shifts', data.shifts.map(shiftRow));
      check(await sb.from('perfil').upsert(perfilRow(data.perfil), { onConflict: 'user_id' }));
    }
  }

  async function flush() {
    while (outbox.length) {
      try { await run(outbox[0]); }
      catch (err) {
        if (!permanent(err)) { throw err; }
        console.error('Cambio descartado por la nube', outbox[0], err);
      }
      outbox.shift();
      persist();
    }
  }

  async function pull() {
    var places = await fetchAll('places');
    var shifts = await fetchAll('shifts');
    var perfil = check(await sb.from('perfil').select('nombre,titulo').maybeSingle());
    if (outbox.length) { again = true; return; }
    data.places = places.map(fromPlace);
    data.shifts = shifts.map(fromShift);
    if (perfil) { data.perfil = { nombre: perfil.nombre, titulo: perfil.titulo }; }
    persist();
  }

  // Primera vez que este dispositivo entra a la cuenta: sube lo que tenga y la nube no, sin pisar nada.
  async function link() {
    if (lsGet(LINK_KEY, null) === user.id) { return; }
    await insertMissing('places', data.places.map(placeRow));
    await insertMissing('shifts', data.shifts.map(shiftRow));
    var perfil = check(await sb.from('perfil').select('user_id').maybeSingle());
    if (!perfil) { check(await sb.from('perfil').insert(perfilRow(data.perfil))); }
    outbox = [];
    persist();
    localStorage.setItem(LINK_KEY, JSON.stringify(user.id));
  }

  function syncNow() {
    if (!sb || !user) { return Promise.resolve(); }
    if (running) { again = true; return running; }
    running = (async function () {
      setStatus('syncing');
      try {
        do { again = false; await link(); await flush(); await pull(); } while (again);
        sync.lastSync = new Date().toISOString();
        localStorage.setItem(LASTSYNC_KEY, JSON.stringify(sync.lastSync));
        sync.status = 'ok';
      } catch (err) {
        console.error('Sincronización', err);
        sync.status = navigator.onLine === false || !permanent(err) ? 'offline' : 'error';
      } finally {
        running = null;
        emit();
      }
    })();
    return running;
  }

  function enqueue(op) {
    if (!user) { return; }
    if (op.t === 'replaceAll') { outbox = []; }
    outbox.push(op);
    persist();
    syncNow();
  }

  function onSession(session) {
    var next = session && session.user ? session.user : null;
    if ((next && next.id) === (user && user.id)) { return; }
    user = next;
    sync.email = user ? (user.email || '') : '';
    if (user) { syncNow(); } else { sync.status = 'out'; emit(); }
  }

  var Store = {
    init: async function () {
      load();
      try { if (navigator.storage && navigator.storage.persist) { await navigator.storage.persist(); } } catch (e) {}
      if (sb) {
        sb.auth.onAuthStateChange(function (event, session) { setTimeout(function () { onSession(session); }, 0); });
        window.addEventListener('online', syncNow);
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { syncNow(); } });
      }
      return Store.getState();
    },
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    getState: function () {
      return {
        places: data.places.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }),
        shifts: data.shifts.slice(),
        perfil: Object.assign({ nombre: '', titulo: 'doctora' }, data.perfil),
        lastBackup: data.lastBackup || null,
        sync: { status: sync.status, email: sync.email, pending: outbox.length, lastSync: sync.lastSync }
      };
    },
    addShift: async function (s) {
      var row = Object.assign({ id: uid() }, s);
      data.shifts.push(row); save(); enqueue({ t: 'shift', row: row });
      return row.id;
    },
    updateShift: async function (id, patch) {
      var row = null;
      data.shifts = data.shifts.map(function (s) { if (s.id !== id) { return s; } row = Object.assign({}, s, patch, { id: id }); return row; });
      if (!row) { return false; }
      save(); enqueue({ t: 'shift', row: row });
      return true;
    },
    deleteShift: async function (id) {
      data.shifts = data.shifts.filter(function (s) { return s.id !== id; }); save();
      enqueue({ t: 'delShift', id: id });
    },
    newPlaceId: function () { return 'p-' + uid(); },
    addPlace: async function (p) {
      var row = Object.assign({ id: 'p-' + uid() }, p);
      data.places.push(row); save(); enqueue({ t: 'place', row: row });
    },
    updatePlace: async function (id, patch) {
      var row = null;
      data.places = data.places.map(function (p) { if (p.id !== id) { return p; } row = Object.assign({}, p, patch); return row; });
      save();
      if (row) { enqueue({ t: 'place', row: row }); }
    },
    setPerfil: async function (perfil) {
      data.perfil = Object.assign({}, data.perfil, perfil); save();
      enqueue({ t: 'perfil' });
    },
    exportJSON: function () {
      data.lastBackup = new Date().toISOString(); save();
      return JSON.stringify({ app: 'turnos-mf', exportedAt: data.lastBackup, version: 1, places: data.places, shifts: data.shifts, perfil: data.perfil }, null, 2);
    },
    importJSON: async function (text) {
      var o = JSON.parse(text);
      if (!validBackup(o)) { throw new Error('invalid_backup'); }
      data = { version: 1, places: o.places, shifts: o.shifts, perfil: o.perfil || data.perfil, lastBackup: o.exportedAt || null };
      save();
      enqueue({ t: 'replaceAll' });
    },

    // --- Cuenta ---
    signIn: async function (email, password) {
      var res = await sb.auth.signInWithPassword({ email: email, password: password });
      if (res.error) { throw res.error; }
    },
    signUp: async function (email, password) {
      var res = await sb.auth.signUp({ email: email, password: password });
      if (res.error) { throw res.error; }
      // Sin sesión significa que Supabase tiene activada la confirmación por correo.
      if (!res.data || !res.data.session) { var e = new Error('confirm_required'); e.code = 'confirm_required'; throw e; }
    },
    signOut: async function () {
      await syncNow();
      await sb.auth.signOut({ scope: 'local' });
      outbox = [];
      localStorage.removeItem(LINK_KEY);
      persist();
    },
    syncNow: syncNow
  };

  window.Store = Store;
})();
