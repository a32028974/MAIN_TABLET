// js/main.js — Lista de trabajos con búsqueda, orden y semáforo

// ====== CONFIG ======
const API_URL = "https://script.google.com/macros/s/AKfycbybza1V9Om8MHI04iFBF4XM8I6am4QG3QOSr6tPnXV3vJwx5FhAzD21Iy8z6FJ1-3v3SQ/exec";
// Si necesitás usar otro endpoint, cambiá la línea de arriba.

// ====== Helpers ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const fmtDate = (str) => {
  // Admite "dd/mm/aa" o ISO. Si no puede, devuelve vacío.
  if (!str) return "";
  const s = String(str).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const [d,m,y] = s.split("/").map(n=>parseInt(n,10));
    const year = y < 100 ? 2000 + y : y;
    const dt = new Date(year, m-1, d);
    return isNaN(dt) ? "" : `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${String(year).slice(-2)}`;
  }
  const dt = new Date(s);
  if (isNaN(dt)) return "";
  const d = String(dt.getDate()).padStart(2,"0");
  const m = String(dt.getMonth()+1).padStart(2,"0");
  const y = String(dt.getFullYear()).slice(-2);
  return `${d}/${m}/${y}`;
};

const parseDateDMY = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(String(s||"").trim());
  if (!m) return null;
  const d = +m[1], mo = +m[2], yy = +m[3]; const y = yy<100 ? 2000+yy : yy;
  const dt = new Date(y, mo-1, d);
  return isNaN(dt) ? null : dt;
};
const daysFromToday = (dt) => {
  if (!dt) return null;
  const a = new Date(); a.setHours(0,0,0,0);
  const b = new Date(dt); b.setHours(0,0,0,0);
  return Math.round((b - a)/86400000);
};

const csvEscape = (v) => {
  const s = String(v==null?"":v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
};

// ====== Estado UI ======
const els = {
  q: $("#q"),
  limit: $("#limit"),
  sort: $("#sort"),
  btnLoad: $("#btnLoad"),
  btnClear: $("#btnClear"),
  exportCsv: $("#exportCsv"),
  progress: $("#progress"),
  tbody: $("#tbody"),
  count: $("#count"),
  total: $("#total"),
  hint: $("#hint"),
  pageInfo: $("#pageInfo")
};

let allItems = [];    // data cruda (todas las coincidencias del fetch)
let viewItems = [];   // data después de ordenar/filtrar para la vista

function showProgress(on){ els.progress.classList.toggle("show", !!on); }
function setHint(msg){ els.hint.textContent = msg || "Listo."; }

// ====== Fetch ======
async function fetchItems({ q="", limit=100 } = {}) {
  showProgress(true);
  setHint("Cargando…");
  try {
    // El backend puede aceptar q y limit. Si no, igual lo filtramos/ordenamos client-side.
    const url = new URL(API_URL);
    url.searchParams.set("fn", "list");
    if (q) url.searchParams.set("q", q);
    if (limit) url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), { method:"GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Normalizamos resultado: admitimos {items:[...], total:n} o un array directo
    const items = Array.isArray(data) ? data : (data.items || data.rows || []);
    const total = data.total ?? items.length;

    allItems = items.map(normalizeRow).filter(Boolean);
    els.total.textContent = String(total);
    setHint(`Listo. ${allItems.length} elementos.`);
  } catch (e) {
    console.error(e);
    setHint("Error al cargar. Revisá el endpoint.");
    allItems = [];
  } finally {
    showProgress(false);
  }
  refresh();
}

// Convierte una fila a un objeto con las claves que usamos.
// Soporta dos formatos:
// 1) Objeto con headers: { "Fecha retira (C)": "...", "N° Trabajo (D)": "...", ... }
// 2) Array posicional:           [  B,  C,  D,  F,  G,  K,      AF,      AG,  ...]
function normalizeRow(row) {
  if (!row) return null;

  // Caso 1: objeto por headers
  if (!Array.isArray(row)) {
    const get = (kArr) => {
      for (const k of kArr) if (row[k]!=null && row[k]!="") return row[k];
      return "";
    };
    return {
      retira: fmtDate(get(["Fecha retira (C)", "RETIRA", "RETIRA (C)", "RETIRA C"])),
      encargo: fmtDate(get(["Fecha encargo (B)", "ENCARGO", "ENCARGO (B)", "ENCARGO B"])),
      trabajo: get(["N° Trabajo (D)", "N°", "N", "TRABAJO", "NUMERO"]),
      nombre: get(["Apellido y Nombre (F)", "PACIENTE", "NOMBRE"]),
      cristal: get(["Cristal (G)", "CRISTAL"]),
      armazon: get(["Armazón (K)", "ARMAZON", "ARMAZÓN"]),
      vendedor: get(["Vendedor (AF)", "VENDEDOR"]),
      telefono: get(["Teléfono (AG)", "TELEFONO", "TEL"]),
      estado: (get(["Estado", "ESTADO"])||"").toUpperCase()
    };
  }

  // Caso 2: array posicional — ajustá los índices si tu Apps Script cambia
  // Índices recomendados: B=0, C=1, D=2, F=3, G=4, K=5, AF=6, AG=7 (ejemplo)
  const B = row[0], C = row[1], D = row[2], F = row[3], G = row[4], K = row[5], AF = row[6], AG = row[7], EST = row[8];
  return {
    retira: fmtDate(C),
    encargo: fmtDate(B),
    trabajo: D ?? "",
    nombre: F ?? "",
    cristal: G ?? "",
    armazon: K ?? "",
    vendedor: AF ?? "",
    telefono: AG ?? "",
    estado: String(EST||"").toUpperCase()
  };
}

// ====== Orden + Semáforo ======
function sortItems(items, mode) {
  const byDate = (a, b, key, asc=true) => {
    const da = parseDateDMY(a[key]); const db = parseDateDMY(b[key]);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return asc ? da - db : db - da;
  };
  const byTrabajoDesc = (a,b) => String(b.trabajo).localeCompare(String(a.trabajo), undefined, {numeric:true});
  const byTrabajoAsc  = (a,b) => String(a.trabajo).localeCompare(String(b.trabajo), undefined, {numeric:true});

  switch (mode) {
    case "recientes_desc": return items.slice().sort(byTrabajoDesc);
    case "recientes_asc":  return items.slice().sort(byTrabajoAsc);
    case "retira_asc":     return items.slice().sort((a,b)=>byDate(a,b,"retira",true));
    case "retira_desc":    return items.slice().sort((a,b)=>byDate(a,b,"retira",false));
    case "encargo_asc":    return items.slice().sort((a,b)=>byDate(a,b,"encargo",true));
    case "encargo_desc":   return items.slice().sort((a,b)=>byDate(a,b,"encargo",false));
    case "pendientes":
    default:
      return items.slice().sort((a,b)=>{
        const pa = isPending(a) ? 0 : 1;
        const pb = isPending(b) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        // Dentro de pendientes, los más vencidos (más rojos) primero
        const ca = colorCode(a); const cb = colorCode(b);
        const rank = (c)=> c==="danger"?0 : c==="warn"?1 : 2;
        if (rank(ca) !== rank(cb)) return rank(ca)-rank(cb);
        // Por fecha retira asc
        return byDate(a,b,"retira",true);
      });
  }
}

function isPending(item) {
  const est = (item.estado||"").toUpperCase();
  return !(est.includes("LISTO") || est.includes("ENTREG") || est.includes("RETIR"));
}

function colorCode(item) {
  // Reglas de semáforo:
  // LISTO → ok
  // Pendiente:
  //   retira < hoy  → danger
  //   retira en 0..2 días → warn
  //   sin fecha → gray
  //   else → ok (verde suave)
  const est = (item.estado||"").toUpperCase();
  if (est.includes("LISTO") || est.includes("ENTREG")) return "ok";

  const dt = parseDateDMY(item.retira);
  if (!dt) return "gray";
  const d = daysFromToday(dt);
  if (d < 0) return "danger";
  if (d <= 2) return "warn";
  return "ok";
}

// ====== Render ======
function render(items) {
  const rows = items.map((it)=>{
    const c = colorCode(it);
    const clsRow = `state-${c}`;
    const badgeClass = c==="danger" ? "badge danger"
                     : c==="warn"   ? "badge warn"
                     : c==="ok"     ? "badge ok"
                     : "badge gray";
    const badgeText = (it.estado && it.estado.trim()) ? it.estado
                    : (c==="danger" ? "VENCIDO"
                      : c==="warn" ? "PRÓXIMO"
                      : c==="ok" ? "OK"
                      : "SIN FECHA");

    return `
      <tr class="${clsRow}">
        <td class="rowFlag"></td>
        <td>${it.retira || ""} <br><span class="${badgeClass}">${badgeText}</span></td>
        <td>${it.encargo || ""}</td>
        <td><strong>${it.trabajo||""}</strong></td>
        <td>${it.nombre||""}</td>
        <td>${it.cristal||""}</td>
        <td>${it.armazon||""}</td>
        <td>${it.vendedor||""}</td>
        <td>${it.telefono||""}</td>
      </tr>
    `;
  }).join("");

  // Aseguramos columna del flag al principio
  els.tbody.innerHTML = rows;

  // Ajuste de header para incluir la columna del flag (sólo si no está)
  const thead = document.querySelector("#lista-trabajos thead tr");
  if (thead && !thead.dataset.flagged) {
    const th = document.createElement("th");
    th.className = "rowFlag";
    th.style.width = "6px";
    thead.prepend(th);
    thead.dataset.flagged = "1";
  }

  els.count.textContent = String(items.length);
  els.exportCsv.disabled = items.length === 0;
}

// ====== Refresh (aplica sort y búsqueda local si hace falta) ======
function refresh() {
  // Filtro local por q si el backend no lo aplicó
  const q = (els.q.value||"").trim().toLowerCase();
  let base = allItems;
  if (q) {
    base = base.filter(it=>{
      return [it.trabajo, it.nombre, it.telefono]
        .some(v => String(v||"").toLowerCase().includes(q));
    });
  }

  // Orden
  viewItems = sortItems(base, els.sort.value);
  render(viewItems);
}

// ====== CSV ======
function exportCSV() {
  if (!viewItems.length) return;
  const headers = ["RETIRA","ENCARGO","N_TRABAJO","NOMBRE","CRISTAL","ARMAZON","VENDEDOR","TELEFONO","ESTADO"];
  const lines = [
    headers.join(","),
    ...viewItems.map(r => [
      r.retira, r.encargo, r.trabajo, r.nombre, r.cristal, r.armazon, r.vendedor, r.telefono, r.estado
    ].map(csvEscape).join(","))
  ];
  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `lista_trabajos_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ====== Eventos ======
els.btnLoad.addEventListener("click", () => {
  fetchItems({ q: els.q.value.trim(), limit: parseInt(els.limit.value,10)||100 });
});
els.btnClear.addEventListener("click", () => {
  els.q.value = "";
  els.limit.value = "100";
  els.sort.value = "pendientes";
  fetchItems({ q:"", limit:100 });
});
els.sort.addEventListener("change", refresh);
els.q.addEventListener("keydown", (e) => { if (e.key === "Enter") els.btnLoad.click(); });
els.exportCsv.addEventListener("click", exportCSV);

// ====== Primera carga ======
fetchItems({ q:"", limit: parseInt(els.limit.value,10)||100 });
