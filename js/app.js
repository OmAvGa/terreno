// ─── INDEXEDDB ───────────────────────────────────────────
const DB_NAME  = 'milote';
const DB_VER   = 1;
const STORE    = 'abonos';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
    req.onerror   = e => reject(e.target.error);
  });
}

async function dbAdd(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).add({ ...data, createdAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function dbUpdate(id, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      const putReq = store.put({ ...existing, ...data });
      putReq.onsuccess = () => resolve();
      putReq.onerror   = e => reject(e.target.error);
    };
    getReq.onerror = e => reject(e.target.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

async function dbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

// ─── CONSTANTES ──────────────────────────────────────────
const TOTAL    = 215000;
const ENGANCHE = 10000;
const DEADLINE = new Date(2027, 9, 31);

// ─── ESTADO ──────────────────────────────────────────────
let abonos = [];

async function cargarAbonos() {
  abonos = await dbGetAll();
  render();
}

// ─── CÁLCULOS ────────────────────────────────────────────
const totalPagado   = () => ENGANCHE + abonos.reduce((s, a) => s + a.amount, 0);
const totalFalta    = () => Math.max(TOTAL - totalPagado(), 0);
const semanasLeft   = () => Math.max(Math.ceil((DEADLINE - Date.now()) / 6048e5), 0);
const ahorroSemanal = () => {
  const s = semanasLeft(), r = totalFalta();
  return (r <= 0) ? 0 : (s <= 0 ? r : Math.ceil(r / s));
};

// ─── FORMATO ─────────────────────────────────────────────
function $$(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}
function fmtFecha(str) {
  return new Date(str + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── IMAGEN: COMPRIMIR ───────────────────────────────────
function comprimirFoto(file, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 900;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ─── MODAL ───────────────────────────────────────────────
let fotoBase64  = null;
let editingId   = null;

function openOverlay() {
  document.getElementById('overlay').classList.add('open');
  const scrollY = window.scrollY;
  document.body.style.position  = 'fixed';
  document.body.style.top       = `-${scrollY}px`;
  document.body.style.width     = '100%';
  document.body.dataset.scrollY = scrollY;
  setTimeout(() => document.getElementById('inAmount').focus(), 360);
}

window.openModal = function () {
  editingId = null;
  document.getElementById('modalTitle').textContent  = 'Agregar abono';
  document.getElementById('btnGuardar').textContent  = 'Guardar abono';
  document.getElementById('inDate').value   = new Date().toISOString().split('T')[0];
  document.getElementById('inAmount').value = '';
  document.getElementById('inNote').value   = '';
  window.clearFoto();
  openOverlay();
};

window.openEditModal = function (id) {
  const a = abonos.find(x => x.id === id);
  if (!a) return;
  editingId = id;
  document.getElementById('modalTitle').textContent  = 'Editar abono';
  document.getElementById('btnGuardar').textContent  = 'Guardar cambios';
  document.getElementById('inDate').value   = a.date;
  document.getElementById('inAmount').value = a.amount;
  document.getElementById('inNote').value   = a.note !== 'Abono' ? a.note : '';
  if (a.photo) {
    fotoBase64 = a.photo;
    const prev = document.getElementById('fotoPreview');
    prev.src = a.photo;
    prev.classList.add('show');
    document.getElementById('fotoClear').classList.add('show');
    document.getElementById('fotoZone').style.display = 'none';
  } else {
    window.clearFoto();
  }
  openOverlay();
};

window.closeModal = function () {
  document.getElementById('overlay').classList.remove('open');
  const scrollY = parseInt(document.body.dataset.scrollY || '0');
  document.body.style.position = '';
  document.body.style.top      = '';
  document.body.style.width    = '';
  window.scrollTo(0, scrollY);
};

window.outsideClick = function (e) { if (e.target.id === 'overlay') window.closeModal(); };

window.onFotoChange = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  comprimirFoto(file, b64 => {
    fotoBase64 = b64;
    const prev = document.getElementById('fotoPreview');
    prev.src = b64;
    prev.classList.add('show');
    document.getElementById('fotoClear').classList.add('show');
    document.getElementById('fotoZone').style.display = 'none';
  });
};

window.clearFoto = function () {
  fotoBase64 = null;
  document.getElementById('fotoPreview').classList.remove('show');
  document.getElementById('fotoPreview').src = '';
  document.getElementById('fotoClear').classList.remove('show');
  document.getElementById('fotoZone').style.display = '';
};

// ─── ACCIONES ────────────────────────────────────────────
window.saveAbono = async function () {
  const amount = parseFloat(document.getElementById('inAmount').value);
  const date   = document.getElementById('inDate').value;
  const note   = document.getElementById('inNote').value.trim() || 'Abono';
  if (!amount || amount <= 0 || !date) { alert('Ingresa el monto y la fecha.'); return; }

  const btn = document.getElementById('btnGuardar');
  btn.disabled    = true;
  btn.textContent = 'Guardando…';
  try {
    if (editingId !== null) {
      await dbUpdate(editingId, { date, amount, note, photo: fotoBase64 ?? null });
    } else {
      await dbAdd({ date, amount, note, photo: fotoBase64 ?? null });
    }
    abonos = await dbGetAll();
    window.closeModal();
    render();
    if (editingId === null) confeti();
    editingId = null;
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  } finally {
    btn.disabled    = false;
    btn.textContent = editingId !== null ? 'Guardar cambios' : 'Guardar abono';
  }
};

window.eliminarAbono = async function (id) {
  if (!confirm('¿Eliminar este abono?')) return;
  try {
    await dbDelete(id);
    abonos = await dbGetAll();
    render();
  } catch (err) {
    alert('Error al eliminar: ' + err.message);
  }
};

window.confirmReset = async function () {
  if (!confirm('¿Reiniciar todo el progreso? Esta acción no se puede deshacer.')) return;
  try {
    await dbClear();
    abonos = [];
    render();
  } catch (err) {
    alert('Error al reiniciar: ' + err.message);
  }
};

// ─── LIGHTBOX ────────────────────────────────────────────
window.openLightbox = function (src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('open');
};
window.closeLightbox = function () { document.getElementById('lightbox').classList.remove('open'); };

// ─── CONFETI ─────────────────────────────────────────────
function confeti() {
  const cols = ['#2ec4b6', '#06d6a0', '#ffd166', '#ef476f', '#3b82f6', '#a78bfa'];
  for (let i = 0; i < 35; i++) {
    const el = document.createElement('div');
    el.className = 'conf';
    el.style.cssText = `
      left:${Math.random() * 100}vw; top:-12px;
      background:${cols[i % cols.length]};
      animation-duration:${1.5 + Math.random() * 1.2}s;
      animation-delay:${Math.random() * 0.5}s;
      width:${6 + Math.random() * 6}px; height:${6 + Math.random() * 6}px;
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

// ─── RENDER ──────────────────────────────────────────────
function render() {
  const paid    = totalPagado();
  const falta   = totalFalta();
  const pct     = Math.min((paid / TOTAL) * 100, 100);
  const sem     = semanasLeft();
  const semanal = ahorroSemanal();

  document.getElementById('pct').textContent        = pct.toFixed(1) + '%';
  document.getElementById('paidVal').textContent    = $$(paid);
  document.getElementById('progFill').style.width   = pct + '%';
  document.getElementById('statAbonos').textContent = abonos.length + 1;
  document.getElementById('statPaid').textContent   = $$(paid);
  document.getElementById('statRem').textContent    = $$(falta);

  document.getElementById('weeklyAmt').textContent  = $$(semanal);
  document.getElementById('weeklyNote').textContent = sem > 0
    ? `por semana · ${sem} semanas para el vencimiento`
    : (falta > 0 ? 'La fecha límite ya venció' : '¡Meta alcanzada!');
  document.getElementById('wgWeeks').textContent  = sem;
  document.getElementById('wgPagado').textContent = $$(paid);
  document.getElementById('wgFalta').textContent  = $$(falta);

  const cont = document.getElementById('abonosContainer');
  const ul   = document.createElement('ul');
  ul.className = 'abono-list';

  if (abonos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `<div class="empty-icon">🧾</div>No hay abonos registrados aún.<br>Agrega tu primer pago para empezar el seguimiento.`;
    ul.appendChild(empty);
  } else {
    abonos.forEach(a => {
      const li = document.createElement('li');
      li.className = 'abono-item';

      const fotoHtml = a.photo
        ? `<img class="abono-thumb" src="${a.photo}" alt="Comprobante" onclick="openLightbox('${a.photo.replace(/'/g, "\\'")}') ">`
        : `<div class="abono-no-photo">🧾</div>`;

      li.innerHTML = `
        ${fotoHtml}
        <div class="abono-info">
          <div class="abono-note">${esc(a.note)}</div>
          <div class="abono-date">${fmtFecha(a.date)}</div>
        </div>
        <div class="abono-right">
          <div class="abono-amt">+${$$(a.amount)}</div>
          <button class="abono-edit" title="Editar">✏</button>
          <button class="abono-del" title="Eliminar">✕</button>
        </div>`;

      li.querySelector('.abono-edit').onclick = () => window.openEditModal(a.id);
      li.querySelector('.abono-del').onclick = () => window.eliminarAbono(a.id);
      ul.appendChild(li);
    });
  }

  const liEng = document.createElement('li');
  liEng.className = 'abono-item enganche-fijo';
  liEng.innerHTML = `
    <div class="abono-no-photo" style="background:#d1fae5;border-color:#6ee7b7;">🔒</div>
    <div class="abono-info">
      <div class="abono-note">Enganche inicial</div>
      <div class="abono-date">Septiembre 2025</div>
      <div class="enganche-tag">Pagado · Requisito</div>
    </div>
    <div class="abono-right">
      <div class="abono-amt">+${$$(ENGANCHE)}</div>
    </div>`;
  ul.appendChild(liEng);

  cont.innerHTML = '';
  cont.appendChild(ul);

  if (paid >= TOTAL) document.getElementById('completion').classList.add('show');
}

// ─── INIT ─────────────────────────────────────────────────
cargarAbonos();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
