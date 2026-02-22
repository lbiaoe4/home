/* LBI • Draft Templates (UI builder, sem JSON obrigatório)
   Storage: localStorage["lbi_draft_templates_v1"]
*/
(() => {
  const KEY = "lbi_draft_templates_v1";

  const $ = (id) => document.getElementById(id);

  const el = {
    filter: $("filter"),
    count: $("count"),
    list: $("list"),

    name: $("name"),
    id: $("id"),
    idPreview: $("idPreview"),

    maps: $("maps"),
    civs: $("civs"),

    mirrorAllowed: $("mirrorAllowed"),
    mapRepeat: $("mapRepeat"),
    civRepeat: $("civRepeat"),

    bo3_mapBans: $("bo3_mapBans"),
    bo3_civBans: $("bo3_civBans"),
    bo5_mapBans: $("bo5_mapBans"),
    bo5_civBans: $("bo5_civBans"),
    bo7_mapBans: $("bo7_mapBans"),
    bo7_civBans: $("bo7_civBans"),

    json: $("json"),
    jsonStatus: $("jsonStatus"),

    btnSave: $("btnSave"),
    btnCancel: $("btnCancel"),
    btnDelete: $("btnDelete"),
    btnCopyId: $("btnCopyId"),
    btnCopyJson: $("btnCopyJson"),

    // top controls (optional)
    btnNewTop: $("btnNewTop"),
    btnPresetTop: $("btnPresetTop"),

    // simulate
    simBo: $("simBo"),
    btnSimulate: $("btnSimulate"),
  };

  const uid = () => "tpl_" + Math.random().toString(16).slice(2, 10) + "_" + Date.now().toString(16).slice(-4);

  const LS = {
    get() {
      try {
        const raw = localStorage.getItem(KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    },
    set(arr) {
      localStorage.setItem(KEY, JSON.stringify(arr || []));
    },
  };

  let templates = LS.get();
  let currentId = null;

  function escapeHtml(s) {
    return (s ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function linesToArr(t) {
    return (t || "").split("\n").map(s => s.trim()).filter(Boolean);
  }

  function defaultMaps() {
    return ["Arabia","Lipany","Dry Arabia","High View","Cliffside","Altai","Hill and Dale","Golden Pit","King of the Hill"];
  }
  function defaultCivs() {
    return [
      "English","French","Holy Roman Empire","Rus","Mongols","Delhi Sultanate","Abbasid Dynasty","Chinese",
      "Ottomans","Malians","Byzantines","Japanese","Ayyubids","Zhu Xi's Legacy","Jeanne d'Arc","Order of the Dragon"
    ];
  }

  function buildFlow(series, mapBansPerPlayer, civBansPerPlayer) {
    const flow = [];
    const picksNeeded = series - 1; // last is decider

    // Map bans (pre-series)
    for (let i = 0; i < mapBansPerPlayer; i++) {
      flow.push({ type: "MAP_BAN", mode: "alternating", by: "A", count: 1 });
      flow.push({ type: "MAP_BAN", mode: "alternating", by: "B", count: 1 });
    }
    // Picks alternating A/B
    for (let i = 0; i < picksNeeded; i++) {
      flow.push({ type: "MAP_PICK", mode: "alternating", by: (i % 2 === 0 ? "A" : "B"), count: 1 });
    }
    flow.push({ type: "MAP_DECIDER", mode: "auto", by: "AUTO", count: 1 });

    // Civ per game
    for (let g = 1; g <= series; g++) {
      for (let i = 0; i < civBansPerPlayer; i++) {
        flow.push({ type: "CIV_BAN", mode: "alternating", by: "A", count: 1, game: g });
        flow.push({ type: "CIV_BAN", mode: "alternating", by: "B", count: 1, game: g });
      }
      flow.push({ type: "CIV_PICK", mode: "simul", by: "BOTH", count: 1, game: g });
    }
    return flow;
  }

  function readBuilderFromUI() {
    return {
      mirrorAllowed: !!el.mirrorAllowed?.checked,
      mapRepeat: el.mapRepeat?.value || "no",
      civRepeat: el.civRepeat?.value || "allow",
      bo3_mapBans: Number(el.bo3_mapBans?.value ?? 1),
      bo3_civBans: Number(el.bo3_civBans?.value ?? 0),
      bo5_mapBans: Number(el.bo5_mapBans?.value ?? 1),
      bo5_civBans: Number(el.bo5_civBans?.value ?? 0),
      bo7_mapBans: Number(el.bo7_mapBans?.value ?? 1),
      bo7_civBans: Number(el.bo7_civBans?.value ?? 0),
    };
  }

  function writeBuilderToUI(b) {
    const bb = b || {};
    if (el.mirrorAllowed) el.mirrorAllowed.checked = !!bb.mirrorAllowed;
    if (el.mapRepeat) el.mapRepeat.value = bb.mapRepeat || "no";
    if (el.civRepeat) el.civRepeat.value = bb.civRepeat || "allow";

    if (el.bo3_mapBans) el.bo3_mapBans.value = String(bb.bo3_mapBans ?? 1);
    if (el.bo3_civBans) el.bo3_civBans.value = String(bb.bo3_civBans ?? 0);
    if (el.bo5_mapBans) el.bo5_mapBans.value = String(bb.bo5_mapBans ?? 1);
    if (el.bo5_civBans) el.bo5_civBans.value = String(bb.bo5_civBans ?? 0);
    if (el.bo7_mapBans) el.bo7_mapBans.value = String(bb.bo7_mapBans ?? 1);
    if (el.bo7_civBans) el.bo7_civBans.value = String(bb.bo7_civBans ?? 0);
  }

  function buildConfigFromBuilder(b) {
    const rules = {
      mirrorAllowed: !!b.mirrorAllowed,
      mapRepeat: b.mapRepeat || "no",
      civRepeat: b.civRepeat || "allow",
    };
    const flows = {
      BO3: buildFlow(3, Number(b.bo3_mapBans || 1), Number(b.bo3_civBans || 0)),
      BO5: buildFlow(5, Number(b.bo5_mapBans || 1), Number(b.bo5_civBans || 0)),
      BO7: buildFlow(7, Number(b.bo7_mapBans || 1), Number(b.bo7_civBans || 0)),
    };
    return { rules, flows };
  }

  function humanRules(cfg) {
    const r = (cfg && cfg.rules) || {};
    const a = [];
    a.push(r.mirrorAllowed ? "Mirror: Sim" : "Mirror: Não");
    a.push((r.mapRepeat || "no") === "allow" ? "Mapa: repete" : "Mapa: não repete");
    a.push((r.civRepeat || "allow") === "no" ? "Civ: não repete" : "Civ: repete");
    return a.join(" • ");
  }

  function getById(id) {
    return templates.find(t => t.id === id) || null;
  }

  function getEffectiveConfig(t) {
    // priority: configJson valid -> generatedConfig -> build from builder
    if (t && t.configJson) {
      try {
        const obj = JSON.parse(t.configJson);
        if (obj && obj.flows) return obj;
      } catch {}
    }
    if (t && t.generatedConfig && t.generatedConfig.flows) return t.generatedConfig;
    return buildConfigFromBuilder(t?.builder || readBuilderFromUI());
  }

  function validateJson() {
    if (!el.jsonStatus) return true;
    const raw = (el.json?.value || "").trim();
    if (!raw) {
      el.jsonStatus.innerHTML = `<span class="muted">Vazio (usaremos o builder)</span>`;
      return true;
    }
    try {
      const obj = JSON.parse(raw);
      if (!obj || !obj.flows) {
        el.jsonStatus.innerHTML = `<span style="color: var(--warn); font-weight:900;">JSON válido, mas faltou "flows"</span>`;
        return true;
      }
      el.jsonStatus.innerHTML = `<span style="color: var(--ok); font-weight:900;">JSON válido ✓</span>`;
      return true;
    } catch (e) {
      el.jsonStatus.innerHTML = `<span style="color: var(--danger); font-weight:900;">JSON inválido: ${escapeHtml(e.message)}</span>`;
      return false;
    }
  }

  function setIdPreview(val) {
    if (el.idPreview) el.idPreview.textContent = val || "—";
  }

  function clearEditor() {
    currentId = null;
    if (el.name) el.name.value = "";
    if (el.id) el.id.value = "";
    setIdPreview("—");
    if (el.maps) el.maps.value = defaultMaps().join("\n");
    if (el.civs) el.civs.value = defaultCivs().join("\n");
    writeBuilderToUI({
      mirrorAllowed: false, mapRepeat: "no", civRepeat: "allow",
      bo3_mapBans: 1, bo3_civBans: 0,
      bo5_mapBans: 1, bo5_civBans: 0,
      bo7_mapBans: 1, bo7_civBans: 0,
    });
    if (el.json) el.json.value = "";
    validateJson();
  }

  function openEditor(id) {
    const t = getById(id);
    if (!t) return;
    currentId = id;
    if (el.name) el.name.value = t.name || "";
    if (el.id) el.id.value = t.id || "";
    setIdPreview(t.id || "—");
    if (el.maps) el.maps.value = (t.maps || []).join("\n");
    if (el.civs) el.civs.value = (t.civs || []).join("\n");
    writeBuilderToUI(t.builder || {});
    if (el.json) el.json.value = t.configJson || "";
    validateJson();
  }

  function renderList() {
    const q = (el.filter?.value || "").trim().toLowerCase();
    const rows = templates
      .filter(t => !q || (t.name || "").toLowerCase().includes(q) || (t.id || "").toLowerCase().includes(q))
      .sort((a,b) => (a.name||"").localeCompare(b.name||""));

    if (el.count) el.count.textContent = String(rows.length);
    if (!el.list) return;
    el.list.innerHTML = "";

    if (!rows.length) {
      el.list.innerHTML = `<div class="tpl-item"><div class="muted">Nenhum template</div></div>`;
      return;
    }

    for (const t of rows) {
      const cfg = getEffectiveConfig(t);
      const div = document.createElement("div");
      div.className = "tpl-item";
      div.innerHTML = `
        <div style="min-width:0; flex:1">
          <div class="name">${escapeHtml(t.name || "(sem nome)")}</div>
          <div class="id mono">${escapeHtml(t.id)}</div>
        </div>
        <div class="muted small" style="width:150px">${escapeHtml(humanRules(cfg))}</div>
        <div class="tpl-actions" style="width:170px">
          <button class="btn2 sm" data-act="edit" data-id="${t.id}">Editar</button>
          <button class="btn2 sm" data-act="dup" data-id="${t.id}">Duplicar</button>
        </div>
      `;
      el.list.appendChild(div);
    }

    el.list.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        if (act === "edit") openEditor(id);
        if (act === "dup") duplicate(id);
      });
    });
  }

  function duplicate(id) {
    const t = getById(id);
    if (!t) return;
    const copy = JSON.parse(JSON.stringify(t));
    copy.id = uid();
    copy.name = (copy.name || "Template") + " (cópia)";
    copy.updatedAt = new Date().toISOString();
    templates.push(copy);
    LS.set(templates);
    renderList();
    openEditor(copy.id);
  }

  function presetLBI() {
    const t = {
      id: uid(),
      name: "LBI Padrão (Mapa + Civ) — Base",
      maps: defaultMaps(),
      civs: defaultCivs(),
      builder: { mirrorAllowed: false, mapRepeat: "no", civRepeat: "allow", bo3_mapBans: 1, bo3_civBans: 0, bo5_mapBans: 1, bo5_civBans: 0, bo7_mapBans: 1, bo7_civBans: 0 },
      configJson: "",
      generatedConfig: buildConfigFromBuilder({ mirrorAllowed: false, mapRepeat: "no", civRepeat: "allow", bo3_mapBans: 1, bo3_civBans: 0, bo5_mapBans: 1, bo5_civBans: 0, bo7_mapBans: 1, bo7_civBans: 0 }),
      updatedAt: new Date().toISOString(),
    };
    templates.push(t);
    LS.set(templates);
    renderList();
    openEditor(t.id);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copiado!");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      alert("Copiado!");
    }
  }

  function saveCurrent() {
    const name = (el.name?.value || "").trim();
    if (!name) return alert("Informe o nome do template.");
    const maps = linesToArr(el.maps?.value || "");
    const civs = linesToArr(el.civs?.value || "");
    if (maps.length < 3) return alert("Informe pelo menos 3 mapas (1 por linha).");
    if (civs.length < 2) return alert("Informe pelo menos 2 civs (1 por linha).");

    const builder = readBuilderFromUI();
    const generatedConfig = buildConfigFromBuilder(builder);

    const rawJson = (el.json?.value || "").trim();
    if (rawJson && !validateJson()) return;

    const obj = {
      id: currentId || uid(),
      name,
      maps,
      civs,
      builder,
      configJson: rawJson || "",
      generatedConfig,
      updatedAt: new Date().toISOString(),
    };

    const idx = templates.findIndex(t => t.id === obj.id);
    if (idx >= 0) templates[idx] = obj;
    else templates.push(obj);

    LS.set(templates);
    renderList();
    openEditor(obj.id);
  }

  function deleteCurrent() {
    if (!currentId) return;
    const t = getById(currentId);
    if (!t) return;
    if (!confirm(`Excluir template "${t.name}"?`)) return;
    templates = templates.filter(x => x.id !== currentId);
    LS.set(templates);
    clearEditor();
    renderList();
  }

  function simulate() {
    const id = currentId || (el.id?.value || "").trim();
    if (!id) return alert("Salve o template antes de simular.");
    const bo = el.simBo?.value || "BO3";
    window.open(`./draft.html?simulate=1&templateId=${encodeURIComponent(id)}&bo=${encodeURIComponent(bo)}`, "_blank");
  }

  // Bind
  el.filter?.addEventListener("input", renderList);
  el.json?.addEventListener("input", validateJson);

  el.btnSave?.addEventListener("click", saveCurrent);
  el.btnCancel?.addEventListener("click", () => { currentId ? openEditor(currentId) : clearEditor(); });
  el.btnDelete?.addEventListener("click", deleteCurrent);
  el.btnCopyId?.addEventListener("click", () => {
    const id = currentId || (el.id?.value || "");
    if (!id) return alert("Salve o template primeiro.");
    copyText(id);
  });
  el.btnCopyJson?.addEventListener("click", () => {
    const t = currentId ? getById(currentId) : null;
    const cfg = t ? getEffectiveConfig(t) : buildConfigFromBuilder(readBuilderFromUI());
    copyText(JSON.stringify(cfg, null, 2));
  });

  el.btnNewTop?.addEventListener("click", () => { clearEditor(); if (el.id) el.id.value = ""; setIdPreview("—"); });
  el.btnPresetTop?.addEventListener("click", presetLBI);

  el.btnSimulate?.addEventListener("click", simulate);

  // Init
  renderList();
  clearEditor();
})();
