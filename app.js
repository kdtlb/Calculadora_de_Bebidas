(() => {
  const $ = (s) => document.querySelector(s);
  const STORAGE_KEY = "calc_bebidas_db_v1";

  // ====== DB por defecto (sin ID/activo, formato original) ======
  const DEFAULT_DB = {
    bebidas: [
      { bebida: "CERVEZA",     ml_por_botella: 1000,  ml_por_persona: 710 },
      { bebida: "VINO TINTO",  ml_por_botella: 750,   ml_por_persona: 250 },
      { bebida: "GIN",         ml_por_botella: 1000,  ml_por_persona: 200 },
      { bebida: "SINGANI",     ml_por_botella: 1000,  ml_por_persona: 150 },
      { bebida: "FERNET",      ml_por_botella: 1000,  ml_por_persona: 100 },
      { bebida: "WHISKY",      ml_por_botella: 1000,  ml_por_persona: 80  },
      { bebida: "RON",         ml_por_botella: 1000,  ml_por_persona: 150 },
      { bebida: "VODKA",       ml_por_botella: 1000,  ml_por_persona: 150 },
      { bebida: "TEQUILA",     ml_por_botella: 750,   ml_por_persona: 50  },
      { bebida: "JAGGER",      ml_por_botella: 700,   ml_por_persona: 50  },
      { bebida: "CHAMPAGNE",   ml_por_botella: 750,   ml_por_persona: 95  },
      { bebida: "AGUA",        ml_por_botella: 20000, ml_por_persona: 1000 },
    ],
    mezcladores: [
      { mezclador: "COCA COLA",   ml_por_botella: 2000, ml_por_persona: 300 },
      { mezclador: "AGUA TONICA", ml_por_botella: 2000, ml_por_persona: 150 },
      { mezclador: "GINGER ALE",  ml_por_botella: 2000, ml_por_persona: 120 },
    ],
    hielo: [
      { item: "Hielo (cubos)",  kg_por_persona: 0.4, kg_por_bolsa: 5 },
      { item: "Hielo (molido)", kg_por_persona: 0.2, kg_por_bolsa: 5 },
    ],
  };

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

  function loadDB(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return clone(DEFAULT_DB);
      const parsed = JSON.parse(raw);
      return {
        bebidas: Array.isArray(parsed.bebidas) ? parsed.bebidas : clone(DEFAULT_DB).bebidas,
        mezcladores: Array.isArray(parsed.mezcladores) ? parsed.mezcladores : clone(DEFAULT_DB).mezcladores,
        hielo: Array.isArray(parsed.hielo) ? parsed.hielo : clone(DEFAULT_DB).hielo,
      };
    }catch(e){
      console.warn("DB corrupta, usando default", e);
      return clone(DEFAULT_DB);
    }
  }

  function saveDB(db){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function n(v){
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  function ceilDiv(a,b){
    a = n(a); b = n(b);
    if(b <= 0) return 0;
    return Math.ceil(a / b);
  }

  function compute(P, db){
    P = Math.max(0, parseInt(P || "0", 10) || 0);

    const bebidas = (db.bebidas || []).map(x => {
      const totalMl = P * n(x.ml_por_persona);
      const botellas = ceilDiv(totalMl, n(x.ml_por_botella));
      return { ...x, botellas };
    });

    const mezcladores = (db.mezcladores || []).map(x => {
      const totalMl = P * n(x.ml_por_persona);
      const botellas = ceilDiv(totalMl, n(x.ml_por_botella));
      return { ...x, botellas };
    });

    const hielo = (db.hielo || []).map(x => {
      const totalKg = P * n(x.kg_por_persona);
      const bolsas = ceilDiv(totalKg, n(x.kg_por_bolsa));
      return { ...x, bolsas };
    });

    return { P, bebidas, mezcladores, hielo };
  }

  // ====== Estado global ======
  let DB = loadDB();

  function setStatus(msg){
    $("#status").textContent = msg;
  }

  // ====== 🔧 FIX MÓVIL: recalculo suave (no re-render por tecla) ======
  let _debTimer = null;

  function debounceSoftRecalc(){
    clearTimeout(_debTimer);
    _debTimer = setTimeout(softRecalc, 140);
  }

  function softRecalc(){
    const P = parseInt($("#inp-personas").value || "0", 10) || 0;
    const calc = compute(P, DB);

    updateComputedCells("bebidas", "botellas", calc.bebidas.map(x => x.botellas ?? 0));
    updateComputedCells("mezcladores", "botellas", calc.mezcladores.map(x => x.botellas ?? 0));
    updateComputedCells("hielo", "bolsas", calc.hielo.map(x => x.bolsas ?? 0));

    setStatus(`Listo. Calculado para ${P} persona(s).`);
  }

  function updateComputedCells(section, key, values){
    const table = document.querySelector(`table[data-section="${section}"]`);
    if(!table) return;
    const tds = table.querySelectorAll(`td[data-comp="${key}"]`);
    tds.forEach((td, i) => { td.textContent = String(values[i] ?? 0); });
  }

  // ====== Render tablas EDITABLES ======
  function tdInput({value, type="text", cls="", step=null, min=null, inputmode=null}, onInput){
    const input = document.createElement("input");
    input.className = `cell-input ${cls}`.trim();
    input.type = type;
    input.value = value ?? "";
    if(step !== null) input.step = String(step);
    if(min !== null) input.min = String(min);
    if(inputmode) input.setAttribute("inputmode", inputmode);

    // ✅ No refrescar tabla aquí (evita perder foco en móvil)
    input.addEventListener("input", () => onInput(input.value));

    return input;
  }

  function renderEditableTable(containerSel, config){
    const el = $(containerSel);
    if(!el) return;

    const { section, rows, cols, computedCols, onDeleteRow } = config;

    if(!rows || rows.length === 0){
      el.innerHTML = `<div style="padding:16px; text-align:center; color:var(--muted); font-family:var(--font-alt)">Sin datos</div>`;
      return;
    }

    const table = document.createElement("table");
    table.dataset.section = section;

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");

    const headers = [
      { label: "#"},
      ...cols.map(c => ({ label: c.label })),
      ...computedCols.map(c => ({ label: c.label })),
      { label: "Acciones" }
    ];

    headers.forEach(h => {
      const th = document.createElement("th");
      th.textContent = h.label;
      trh.appendChild(th);
    });

    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.forEach((row, idx) => {
      const tr = document.createElement("tr");

      const tdIndex = document.createElement("td");
      tdIndex.textContent = String(idx + 1);
      tr.appendChild(tdIndex);

      cols.forEach(c => {
        const td = document.createElement("td");
        const val = row[c.key];

        const isNum = c.type === "number";
        const input = tdInput(
          {
            value: val,
            type: isNum ? "number" : "text",
            cls: isNum ? "cell-num" : "",
            step: c.step ?? (isNum ? "any" : null),
            min: c.min ?? (isNum ? 0 : null),
            inputmode: isNum ? (c.inputmode || "decimal") : null,
          },
          (newVal) => {
            row[c.key] = isNum ? n(newVal) : newVal;
            debounceSoftRecalc(); // ✅ recalculo suave, mantiene foco
          }
        );

        td.appendChild(input);
        tr.appendChild(td);
      });

      computedCols.forEach(c => {
        const td = document.createElement("td");
        td.textContent = String(row[c.key] ?? "");
        td.dataset.comp = c.key; // para actualizar sin re-render
        tr.appendChild(td);
      });

      const tdAct = document.createElement("td");
      const box = document.createElement("div");
      box.className = "actions";

      const del = document.createElement("button");
      del.className = "icon-btn";
      del.type = "button";
      del.textContent = "Eliminar";
      del.addEventListener("click", () => onDeleteRow(idx));

      box.appendChild(del);
      tdAct.appendChild(box);
      tr.appendChild(tdAct);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    el.innerHTML = "";
    el.appendChild(table);
  }

  function refresh(){
    const P = parseInt($("#inp-personas").value || "0", 10) || 0;
    const calc = compute(P, DB);

    renderEditableTable("#tabla-bebidas", {
      section: "bebidas",
      rows: DB.bebidas.map((r, i) => Object.assign(r, { botellas: calc.bebidas[i]?.botellas ?? 0 })),
      cols: [
        { label: "Bebida", key: "bebida", type: "text" },
        { label: "Cant. x per. (ml)", key: "ml_por_persona", type: "number", step: "any", min: 0, inputmode: "numeric" },
        { label: "Botella (ml)", key: "ml_por_botella", type: "number", step: "any", min: 0, inputmode: "numeric" },
      ],
      computedCols: [{ label: "Total bot.", key: "botellas" }],
      onDeleteRow: (idx) => { DB.bebidas.splice(idx, 1); refresh(); }
    });

    renderEditableTable("#tabla-mezcladores", {
      section: "mezcladores",
      rows: DB.mezcladores.map((r, i) => Object.assign(r, { botellas: calc.mezcladores[i]?.botellas ?? 0 })),
      cols: [
        { label: "Mezclador", key: "mezclador", type: "text" },
        { label: "Cant. x per. (ml)", key: "ml_por_persona", type: "number", step: "any", min: 0, inputmode: "numeric" },
        { label: "Botella (ml)", key: "ml_por_botella", type: "number", step: "any", min: 0, inputmode: "numeric" },
      ],
      computedCols: [{ label: "Total bot.", key: "botellas" }],
      onDeleteRow: (idx) => { DB.mezcladores.splice(idx, 1); refresh(); }
    });

    renderEditableTable("#tabla-hielo", {
      section: "hielo",
      rows: DB.hielo.map((r, i) => Object.assign(r, { bolsas: calc.hielo[i]?.bolsas ?? 0 })),
      cols: [
        { label: "Tipo", key: "item", type: "text" },
        { label: "Kg x per.", key: "kg_por_persona", type: "number", step: "any", min: 0, inputmode: "decimal" },
        { label: "Present. (kg)", key: "kg_por_bolsa", type: "number", step: "any", min: 0, inputmode: "decimal" },
      ],
      computedCols: [{ label: "Total bol.", key: "bolsas" }],
      onDeleteRow: (idx) => { DB.hielo.splice(idx, 1); refresh(); }
    });

    setStatus(`Listo. Calculado para ${P} persona(s).`);
  }

  // ====== Acciones ======
  function addRow(type){
    if(type === "bebidas") DB.bebidas.push({ bebida:"Nueva bebida", ml_por_persona:0, ml_por_botella:1000 });
    if(type === "mezcladores") DB.mezcladores.push({ mezclador:"Nuevo mezclador", ml_por_persona:0, ml_por_botella:2000 });
    if(type === "hielo") DB.hielo.push({ item:"Nuevo hielo", kg_por_persona:0, kg_por_bolsa:5 });
    refresh();
  }

  function handleGuardar(){
    saveDB(DB);
    setStatus("Guardado.");
  }

  function handleRecargar(){
    DB = loadDB();
    refresh();
    setStatus("Recargado desde el navegador.");
  }

  function handleReset(){
    localStorage.removeItem(STORAGE_KEY);
    DB = loadDB();
    refresh();
    setStatus("Reset a valores iniciales.");
  }

  // ====== PDF bonito (blanco, imprimible, inspirado en CSS) ======
  function cssVar(name, fallback = "") {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function hexToRgb(hex) {
    const h = String(hex).trim().replace("#", "");
    if (![3, 6].includes(h.length)) return [0, 0, 0];
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function safeText(v){
    return String(v ?? "").replace(/\s+/g, " ").trim();
  }

  function descargarPDF(){
    // cálculo al momento (sin depender de celdas)
    const P = parseInt($("#inp-personas").value || "0", 10) || 0;
    const calc = compute(P, DB);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const accent = cssVar("--accent", "#c7a27c");
    const text = cssVar("--text", "#4a3b2f");
    const muted = cssVar("--muted", "#9b8a7c");
    const border = cssVar("--border", "#e8ded5");

    const ACC = hexToRgb(accent);
    const TXT = hexToRgb(text);
    const MUT = hexToRgb(muted);
    const BOR = hexToRgb(border);

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;

    // Fondo blanco
    doc.setFillColor(255,255,255);
    doc.rect(0, 0, pageW, pageH, "F");

    // Header minimalista
    doc.setDrawColor(...ACC);
    doc.setLineWidth(2);
    doc.line(margin, 40, pageW - margin, 40);

    doc.setTextColor(...TXT);
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.text("Calculadora de Bebidas", margin, 66);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUT);
    doc.text(`Personas: ${P}`, margin, 86);

    const now = new Date();
    doc.text(`Generado: ${now.toLocaleString()}`, pageW - margin, 86, { align: "right" });

    doc.setDrawColor(...BOR);
    doc.setLineWidth(1);
    doc.line(margin, 98, pageW - margin, 98);

    const baseTable = {
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 10,
        textColor: TXT,
        lineColor: BOR,
        lineWidth: 0.6,
        cellPadding: 7,
        valign: "middle",
      },
      headStyles: {
        fillColor: [255,255,255],
        textColor: ACC,
        fontStyle: "bold",
        halign: "center",
        lineColor: BOR,
        lineWidth: 0.8,
      },
      alternateRowStyles: {
        fillColor: [252, 250, 248],
      },
      margin: { left: margin, right: margin },
    };

    function sectionTitle(label, y){
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...ACC);
      doc.text(label, margin, y);
      doc.setDrawColor(...ACC);
      doc.setLineWidth(1.2);
      doc.line(margin, y + 6, margin + 240, y + 6);
      doc.setTextColor(...TXT);
    }

    let y = 122;

    sectionTitle("Cantidades estimadas (Bebidas)", y);
    y += 12;

    doc.autoTable({
      ...baseTable,
      startY: y,
      head: [[ "Bebida", "Ml/persona", "Ml/botella", "Total botellas" ]],
      body: calc.bebidas.map(b => ([
        safeText(b.bebida),
        String(Math.round(Number(b.ml_por_persona || 0))),
        String(Math.round(Number(b.ml_por_botella || 0))),
        String(b.botellas ?? 0),
      ])),
      columnStyles: {
        0: { cellWidth: 230 },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
    });

    y = doc.lastAutoTable.finalY + 22;

    sectionTitle("Cantidad de Mezcladores", y);
    y += 12;

    doc.autoTable({
      ...baseTable,
      startY: y,
      head: [[ "Mezclador", "Ml/persona", "Ml/botella", "Total botellas" ]],
      body: calc.mezcladores.map(m => ([
        safeText(m.mezclador),
        String(Math.round(Number(m.ml_por_persona || 0))),
        String(Math.round(Number(m.ml_por_botella || 0))),
        String(m.botellas ?? 0),
      ])),
      columnStyles: {
        0: { cellWidth: 230 },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
    });

    y = doc.lastAutoTable.finalY + 22;

    sectionTitle("Cantidad de Hielo", y);
    y += 12;

    doc.autoTable({
      ...baseTable,
      startY: y,
      head: [[ "Tipo", "Kg/persona", "Kg/bolsa", "Total bolsas" ]],
      body: calc.hielo.map(h => ([
        safeText(h.item),
        String(Number(h.kg_por_persona || 0).toFixed(2)),
        String(Number(h.kg_por_bolsa || 0).toFixed(2)),
        String(h.bolsas ?? 0),
      ])),
      columnStyles: {
        0: { cellWidth: 230 },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
    });

    const pageCount = doc.getNumberOfPages();
    for(let i=1; i<=pageCount; i++){
      doc.setPage(i);
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();

      doc.setDrawColor(...BOR);
      doc.setLineWidth(1);
      doc.line(margin, h - 46, w - margin, h - 46);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUT);
      doc.text(`Página ${i} / ${pageCount}`, w - margin, h - 28, { align: "right" });
      doc.text("Programa echo por Matías López Bertram", margin, h - 28);

      doc.setTextColor(...TXT);
    }

    doc.save(`calculadora_bebidas_${P}_personas.pdf`);
    setStatus("PDF descargado");
  }

  // ====== Init ======
  window.addEventListener("DOMContentLoaded", () => {
    $("#btn-calcular")?.addEventListener("click", () => refresh());
    $("#btn-guardar")?.addEventListener("click", handleGuardar);
    $("#btn-recargar")?.addEventListener("click", handleRecargar);
    $("#btn-reset")?.addEventListener("click", handleReset);
    $("#btn-descargar")?.addEventListener("click", descargarPDF);

    $("#add-bebida")?.addEventListener("click", () => addRow("bebidas"));
    $("#add-mezclador")?.addEventListener("click", () => addRow("mezcladores"));
    $("#add-hielo")?.addEventListener("click", () => addRow("hielo"));

    // Recalcular al cambiar personas (sin re-render)
    $("#inp-personas")?.addEventListener("input", debounceSoftRecalc);

    refresh();
  });
})();

