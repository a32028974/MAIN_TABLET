// ============================
// Tablero semáforo + Auto-Refresh + Recientes + Pendientes arriba
// ============================

// <<< CAMBIAR SOLO ESTA LÍNEA SI TENÉS OTRO /exec >>>
const API_URL = 'https://script.google.com/macros/s/AKfycbybza1V9Om8MHI04iFBF4XM8I6am4QG3QOSr6tPnXV3vJwx5FhAzD21Iy8z6FJ1-3v3SQ/exec';

// ===== Config de actualización en tiempo real =====
const REFRESH_MS = 15000;     // 15s base
const REFRESH_MAX_MS = 60000; // 60s máx en backoff

// ===== Helpers DOM / UI =====
const $ = (id) => document.getElementById(id);
const logUI = (msg) => { const el = $('hint'); if (el) el.textContent = msg; };
const safe = (v) => (v ?? '').toString().trim();

// ===== Fechas =====
function todayLocal(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function fmtDMY(d){ const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); return `${dd}/${mm}/${d.getFullYear()}`; }

function parseAnyToDate(s){
  if (s instanceof Date && !isNaN(s)) { const d=new Date(s.getTime()); d.setHours(0,0,0,0); return d; }
  if (typeof s === 'number'){ const d=new Date(s); if(!isNaN(d)) { d.setHours(0,0,0,0); return d; } }
  const str=safe(s); if(!str) return null;

  // dd/mm/aa | dd-mm-aa | dd/mm/aaaa ...
  const m=str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if(m){
    let[,dd,mm,yy]=m;
    if(yy.length===2) yy='20'+yy;
    const d=new Date(+yy,+mm-1,+dd);
    d.setHours(0,0,0,0);
    return isNaN(d)?null:d;
  }
  const d=new Date(str);
  if(!isNaN(d)){ d.setHours(0,0,0,0); return d; }
  return null;
}
function toDMY(s){ const d=parseAnyToDate(s); return d?fmtDMY(d):''; }
function daysUntil(s){ const d=parseAnyToDate(s); if(!d) return Infinity; return Math.floor((d - todayLocal())/86400000); }

// ===== Normalización texto =====
function cleanInvisible(s){
  return safe(s)
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const norm = (s)=> cleanInvisible(s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // sin acentos
  .toUpperCase();

function isListo(estadoRaw){
  const e = norm(estadoRaw);
  return e.includes('LISTO') || e.includes('ENTREGADO');
}

// ===== Estado global =====
let state = {
  items: [],
  total: 0,
  page: 100,
  query: '',
  timer: null,
  backoff: REFRESH_MS,
  lastHash: ''
};
window._state = state; // debug desde consola

// ===== Mapear registros a columnas =====
function normalizeRecord(r){
  const C  = toDMY(r.retira   ?? r.C  ?? r.c  ?? r.fechaRetira ?? r['Fecha retira'] ?? '');
  const B  = toDMY(r.fecha    ?? r.B  ?? r.b  ?? r.fechaEncargo ?? r['Fecha encargo'] ?? '');
  const D  = safe(r.numero    ?? r.D  ?? r.d  ?? r['N° Trabajo'] ?? r.num ?? r.numeroTrabajo ?? '');
  const F  = safe(r.nombre    ?? r.F  ?? r.f  ?? r['Apellido y Nombre'] ?? r.apellidoNombre ?? '');
  const G  = safe(r.cristal   ?? r.G  ?? r.g  ?? r['Cristal'] ?? '');
  const K  = safe(r.armazon   ?? r.K  ?? r.k  ?? r.detalle ?? r['Armazón'] ?? '');
  const AF = safe(r.vendedor  ?? r.AF ?? r.af  ?? r['Vendedor'] ?? '');
  const AG = safe(r.telefono  ?? r.AG ?? r.ag  ?? r.tel ?? r['Teléfono'] ?? '');

  const estadoRaw = r.estado ?? r.Estado ?? r.status ?? r.STATUS ??
                    r.A ?? r.a ?? r.E ?? r.e ?? r['Estado'] ?? '';
  const A = cleanInvisible(estadoRaw);

  return { A,B,C,D,F,G,K,AF,AG, _dLeft: daysUntil(C) };
}

// ===== Orden =====
function cmpDateStr(a,b){
  const A = parseAnyToDate(a)?.getTime() ?? 9e15;
  const B = parseAnyToDate(b)?.getTime() ?? 9e15;
  return A-B;
}

// ranking de urgencia: menor = más arriba
function urgencyRank(it){
  if (isListo(it.A))     return 5;             // LISTO al final
  if (!isFinite(it._dLeft)) return 4;          // sin fecha
  if (it._dLeft <= 0)    return 0;             // vencidos / hoy (ROJO)
  if (it._dLeft <= 2)    return 1;             // muy próximos (AMARILLO)
  return 2;                                     // resto (CELESTE)
}

// ÚNICA función sortItems
function sortItems(){
  const mode = $('sort')?.value || 'pendientes';

  const by = {
    pendientes:   (a,b)=> urgencyRank(a) - urgencyRank(b)      // 1) urgencia
                           || (a._dLeft - b._dLeft)            // 2) más vencido primero
                           || ((b._row||0) - (a._row||0)),     // 3) más reciente del sheet
    recientes_desc: (a,b)=> (b._row||0) - (a._row||0),
    recientes_asc:  (a,b)=> (a._row||0) - (b._row||0),
    retira_asc:     (a,b)=> cmpDateStr(a.C,b.C),
    retira_desc:    (a,b)=> cmpDateStr(b.C,a.C),
    encargo_asc:    (a,b)=> cmpDateStr(a.B,b.B),
    encargo_desc:   (a,b)=> cmpDateStr(b.B,a.B),
  }[mode] || ((a,b)=> urgencyRank(a) - urgencyRank(b) || (a._dLeft - b._dLeft) || ((b._row||0) - (a._row||0)));

  state.items.sort(by);
}

// ===== Semáforo (clases CSS) =====
function rowClass(it){
  const dLeft  = it._dLeft;
  const estado = it.A;
  if (!isFinite(dLeft)) return 'gris';
  if (isListo(estado))  return 'verde';
  if (dLeft <= 0)       return 'rojo';
  if (dLeft <= 2)       return 'amarillo';
  return 'celeste';
}

// ===== Hash para evitar re-render si no cambió =====
function computeHash(arr){
  let s = arr.map(x => `${x.C}|${x.B}|${x.D}|${x.F}|${x.G}|${x.K}|${x.AF}|${x.AG}|${x.A}|${x._row||''}`).join('||');
  let h = 5381;
  for (let i=0;i<s.length;i++) h = ((h<<5)+h) ^ s.charCodeAt(i);
  return (h>>>0).toString(36);
}

// ===== Render =====
function getFiltered(){
  const q = $('q')?.value.trim().toUpperCase() || '';
  return q
    ? state.items.filter(x => (`${x.D} ${x.F} ${x.G} ${x.K} ${x.AF} ${x.AG}`).toUpperCase().includes(q))
    : state.items;
}

function render(){
  const tbody = $('tbody'); if(!tbody) return;
  const filtered = getFiltered();

  tbody.innerHTML = filtered.map(it => `
    <tr class="${rowClass(it)}">
      <td class="mono">${it.C}</td>
      <td class="mono">${it.B}</td>
      <td class="mono"><strong>${it.D}</strong></td>
      <td>${it.F}</td>
      <td>${it.G}</td>
      <td>${it.K}</td>
      <td>${it.AF}</td>
      <td class="mono">${it.AG}</td>
    </tr>
  `).join('') || `<tr><td colspan="8" class="empty">Sin resultados</td></tr>`;

  $('count') && ($('count').textContent = String(filtered.length));
  $('total') && ($('total').textContent = String(state.items.length));
  $('pageInfo') && ($('pageInfo').textContent = `Cargados: ${state.page}`);
  const btn = $('exportCsv'); if (btn) btn.disabled = filtered.length === 0;
}

async function fetchHistorial(limit, query){
  // anti-caché fuerte en cada request
  const ts = Date.now();
  const url = `${API_URL}?action=tablero&_ts=${ts}`;

  logUI('Cargando… (tablero)');
  const r = await fetch(url, { cache:'no-store' });

  // Si el server devolvió HTML (redir/404), lo detectamos y avisamos en pantalla
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`HTTP ${r.status}: ${text.slice(0,140)}…`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    // En móvil puede llegar una página HTML (consent/redirect). Lo mostramos.
    throw new Error(`Respuesta no JSON: ${text.slice(0,140)}…`);
  }

  const arr = Array.isArray(json) ? json : (Array.isArray(json.items) ? json.items : []);
  const total = arr.length;

  let list = arr;
  let base = 0; // índice inicial dentro del sheet (0-based)

  const q = (query || '').trim();
  if (q) {
    const Q = q.toUpperCase();
    list = arr.filter(o => (
      `${o.numero ?? o.D ?? ''} ${o.nombre ?? o.F ?? ''} ${o.cristal ?? o.G ?? ''} ${o.armazon ?? o.K ?? ''} ${o.vendedor ?? o.AF ?? ''} ${o.telefono ?? o.AG ?? ''}`
    ).toUpperCase().includes(Q));
  } else {
    list = arr.slice(-Number(limit || 100));
    base = total - list.length;
  }

  return { list, base, total };
}

// ===== Aplicar datos (mapea, calcula hash y renderiza solo si cambia) =====
function updateFrom(list, base, total){
  const items = list.map((r, i) => {
    const it = normalizeRecord(r);
    it._row = base + i + 1; // fila 1-based del sheet
    return it;
  });

  const hash = computeHash(items);
  if (hash === state.lastHash) {
    logUI(`Sin cambios. Reg: ${state.items.length}`);
    return;
  }

  state.items = items;
  state.total = total;
  state.lastHash = hash;

  sortItems();
  render();
  logUI(`OK. Registros: ${state.items.length} / Total hoja: ${total}`);
}

// ===== Cargar (manual) =====
async function cargar(){
  try{
    $('progress')?.classList.add('show');
    const q = $('q')?.value.trim() || '';
    const res = await fetchHistorial(state.page, q);
    window._lastData = res.list; // debug crudo
    updateFrom(res.list, res.base, res.total);
  }catch(err){
    logUI(`Error: ${err.message}`);
    console.error(err);
  }finally{
    $('progress')?.classList.remove('show');
  }
}

// ===== Auto-Refresh =====
function scheduleNextRefresh(ok){
  state.backoff = ok ? REFRESH_MS : Math.min(REFRESH_MAX_MS, state.backoff * 2);
  clearTimeout(state.timer);
  state.timer = setTimeout(tick, state.backoff);
}

async function tick(){
  if (document.hidden) { scheduleNextRefresh(true); return; }
  try{
    const q = $('q')?.value.trim() || '';
    const res = await fetchHistorial(state.page, q);
    window._lastData = res.list; // debug
    updateFrom(res.list, res.base, res.total);
    scheduleNextRefresh(true);
  }catch(err){
    console.error('Auto-refresh error:', err);
    logUI(`Reintentando en ${Math.round(state.backoff/1000)}s…`);
    scheduleNextRefresh(false);
  }
}

function startAutoRefresh(){
  clearTimeout(state.timer);
  state.backoff = REFRESH_MS;
  scheduleNextRefresh(true);
}

document.addEventListener('visibilitychange', ()=>{
  if (document.hidden) clearTimeout(state.timer);
  else startAutoRefresh();
});

// ===== Export CSV de lo que se ve =====
$('exportCsv')?.addEventListener('click', () => {
  const rows = getFiltered();
  if (!rows.length) return;

  const header = ['Fecha retira','Fecha encargo','N° Trabajo','Apellido y Nombre','Cristal','Armazón','Vendedor','Teléfono'];
  const csvRows = [
    header.join(','),
    ...rows.map(r => [
      r.C, r.B, r.D, r.F, r.G, r.K, r.AF, r.AG
    ].map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(','))
  ];
  const blob = new Blob([csvRows.join('\r\n')], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trabajos_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ===== Eventos =====
$('btnLoad')  ?.addEventListener('click', cargar);
$('btnClear') ?.addEventListener('click', ()=>{ const iq=$('q'); if(iq) iq.value=''; cargar(); });
$('sort')     ?.addEventListener('change', ()=>{ sortItems(); render(); });
$('limit')    ?.addEventListener('change', (e)=>{ state.page = Number(e.target.value||100); cargar(); });
$('q')        ?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') cargar(); });

// ===== Init =====
window.addEventListener('DOMContentLoaded', ()=>{
  state.page = Number($('limit')?.value || 100);
  logUI('Listo. Clic en Cargar o esperá la sincronización…');
  cargar();
  startAutoRefresh();
});

// ===== Debug helpers =====
window._debug = { cargar, fetchHistorial, parseAnyToDate, daysUntil, rowClass, normalizeRecord, computeHash, updateFrom, getFiltered, urgencyRank };
