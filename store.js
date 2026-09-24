/*
 * Store: capa de datos de la app.
 * Hoy guarda todo en localStorage del dispositivo. La interfaz (métodos async + subscribe)
 * está pensada para poder reemplazarla por Supabase/Firebase sin tocar app.js.
 */
(function () {
  var KEY = 'turnos:v1';
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

  var data = null;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { data = JSON.parse(raw); }
    } catch (e) { data = null; }
    if (!data || !Array.isArray(data.places) || !Array.isArray(data.shifts)) {
      data = clone(SEED);
      save();
    }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
    var snap = Store.getState();
    listeners.forEach(function (fn) { try { fn(snap); } catch (e) { console.error(e); } });
  }
  function validBackup(o) {
    return o && Array.isArray(o.places) && Array.isArray(o.shifts) && o.places.every(function (p) {
      return p && typeof p.id === 'string' && typeof p.name === 'string';
    }) && o.shifts.every(function (s) {
      return s && typeof s.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && Number(s.hours) > 0;
    });
  }

  var Store = {
    init: async function () {
      load();
      // Pide al navegador que no borre los datos si falta espacio.
      try { if (navigator.storage && navigator.storage.persist) { await navigator.storage.persist(); } } catch (e) {}
      return Store.getState();
    },
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    getState: function () {
      return {
        places: data.places.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }),
        shifts: data.shifts.slice(),
        perfil: Object.assign({ nombre: '', titulo: 'doctora' }, data.perfil),
        lastBackup: data.lastBackup || null
      };
    },
    addShift: async function (s) { var row = Object.assign({ id: uid() }, s); data.shifts.push(row); save(); return row.id; },
    deleteShift: async function (id) { data.shifts = data.shifts.filter(function (s) { return s.id !== id; }); save(); },
    newPlaceId: function () { return 'p-' + uid(); },
    addPlace: async function (p) { data.places.push(Object.assign({ id: 'p-' + uid() }, p)); save(); },
    updatePlace: async function (id, patch) { data.places = data.places.map(function (p) { return p.id === id ? Object.assign({}, p, patch) : p; }); save(); },
    setPerfil: async function (perfil) { data.perfil = Object.assign({}, data.perfil, perfil); save(); },
    exportJSON: function () {
      data.lastBackup = new Date().toISOString(); save();
      return JSON.stringify({ app: 'turnos-mf', exportedAt: data.lastBackup, version: 1, places: data.places, shifts: data.shifts, perfil: data.perfil }, null, 2);
    },
    importJSON: async function (text) {
      var o = JSON.parse(text);
      if (!validBackup(o)) { throw new Error('invalid_backup'); }
      data = { version: 1, places: o.places, shifts: o.shifts, perfil: o.perfil || data.perfil, lastBackup: o.exportedAt || null };
      save();
    }
  };

  window.Store = Store;
})();
