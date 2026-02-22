/* LBI Draft (painel) — versão com UX do draft antigo (room.html)
   Ajustes:
   - Identificador é matchId (não existe "sala" gerada)
   - Não há OBS
   - CIV pick existe, mas NÃO existe atribuição civ->map (ASSIGN)
*/

(function () {
  const $ = (sel) => document.querySelector(sel);

  const els = {
    roleBox: $("#roleBox"),
    roleRid: $("#roleRid"),
    btnRoleA: $("#btnRoleA"),
    btnRoleB: $("#btnRoleB"),

    readyBox: $("#readyBox"),
    draftBox: $("#draftBox"),
    status: $("#status"),
    rid: $("#rid"),
    who: $("#who"),
    rP1: $("#rP1"),
    rP2: $("#rP2"),
    playerName: $("#playerName"),
    readyBtn: $("#readyBtn"),

    hdrId: $("#hdrId"),
    hdrSeries: $("#hdrSeries"),
    hdrStep: $("#hdrStep"),
    hdrTimer: $("#hdrTimer"),
    hdrTimerVal: $("#hdrTimerVal"),

    p1Sel: $("#p1Sel"),
    p1Ban: $("#p1Ban"),
    p2Sel: $("#p2Sel"),
    p2Ban: $("#p2Ban"),

    instruction: $("#instruction"),
    confirmBox: $("#confirmBox"),
    confirmText: $("#confirmText"),
    confirmBtn: $("#confirmBtn"),

    poolTitle: $("#poolTitle"),
    poolHint: $("#poolHint"),
    pool: $("#pool"),

    btnReset: $("#btnReset"),

    summaryBox: $("#summaryBox"),
    summaryImg: $("#summaryImg"),
    downloadSummary: $("#downloadSummary"),
    summaryCanvas: $("#summaryCanvas"),
  };

  function show(el, on = true) {
    if (!el) return;
    el.classList.toggle("hidden", !on);
  }

  function pill(text, cls = "") {
    const d = document.createElement("div");
    d.className = "miniPill " + cls;
    d.textContent = text;
    return d;
  }

  function qs() {
    const p = new URLSearchParams(location.search);
    const obj = {};
    for (const [k, v] of p.entries()) obj[k] = v;
    return obj;
  }

  const q = qs();

  // matchId vem do painel. fallback: roomId (compat)
  const matchId = String(q.matchId || q.roomId || "").trim().toUpperCase();
  if (!matchId) {
    alert("Draft sem matchId. Abra pelo Painel (Gerenciar Resultados / Abrir Draft).");
    return;
  }

  // ---------- Painel storage (para mostrar nomes, seeds e puxar template) ----------
  const LS_MATCHES = "lbi_matches";
  const LS_USERS = "lbi_users";
  const LS_SESSION = "lbi_session";
  const LS_DRAFT_TEMPLATES = "lbi_draft_templates_v1";

  function safeJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function getMatchInfo() {
    const arr = safeJson(LS_MATCHES, []);
    const m = arr.find((x) => String(x?.id || "").toUpperCase() === matchId) || null;
    return m;
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(LS_SESSION) || "null"); }
    catch { return null; }
  }

  function getUsers() {
    return safeJson(LS_USERS, []);
  }

  function findUserById(id) {
    if (!id) return null;
    const arr = getUsers();
    return arr.find(u => String(u?.id || "") === String(id)) || null;
  }

  function userNickname(u) {
    if (!u) return null;
    return u?.profile?.nickname || u?.profile?.nick || u?.nickname || u?.login || u?.profile?.fullName || null;
  }

  function getTemplateById(id) {
    const arr = safeJson(LS_DRAFT_TEMPLATES, []);
    return arr.find((t) => t && t.id === id) || null;
  }

  // match pode ser null (se abriu fora do painel/sem storage)
  const match = getMatchInfo();

  const session = getSession();
  const meUser = session?.userId ? findUserById(session.userId) : null;
  const meNick = userNickname(meUser) || session?.login || null;

  function asNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function pickFirstDefined(obj, keys) {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return null;
  }

  function extractSeed(m, side /* 'A'|'B' */) {
    if (!m) return null;
    if (side === "A") {
      return asNum(pickFirstDefined(m, ["seedA", "aSeed", "seed1", "p1Seed", "seedP1", "seed_a", "seed_left"]));
    }
    return asNum(pickFirstDefined(m, ["seedB", "bSeed", "seed2", "p2Seed", "seedP2", "seed_b", "seed_right"]));
  }

  function extractName(m, side /* 'A'|'B' */) {
    if (!m) return null;

    // Preferência: usando ids do painel (participantAId/BId) -> nickname do usuário
    const idA = pickFirstDefined(m, ["participantAId", "aId", "p1Id", "playerAId"]);
    const idB = pickFirstDefined(m, ["participantBId", "bId", "p2Id", "playerBId"]);

    if (side === "A" && idA) return userNickname(findUserById(idA));
    if (side === "B" && idB) return userNickname(findUserById(idB));

    // Fallback: campos legados
    if (side === "A") {
      return pickFirstDefined(m, ["aNick", "p1Nick", "aUser", "playerA", "p1User", "aName", "p1Name"]);
    }
    return pickFirstDefined(m, ["bNick", "p2Nick", "bUser", "playerB", "p2User", "bName", "p2Name"]);
  }

  // Draft A = MAIOR seed (menor número). Se não houver seed, cai no lado A/B original do match.
  function resolveDraftSides(m) {
    const seedA = extractSeed(m, "A");
    const seedB = extractSeed(m, "B");
    const nameA = extractName(m, "A") || "A";
    const nameB = extractName(m, "B") || "B";

    const idA = pickFirstDefined(m, ["participantAId", "aId", "p1Id", "playerAId"]) || null;
    const idB = pickFirstDefined(m, ["participantBId", "bId", "p2Id", "playerBId"]) || null;

    let draftA = { matchSide: "A", userId: idA, name: nameA, seed: seedA };
    let draftB = { matchSide: "B", userId: idB, name: nameB, seed: seedB };

    if (seedA !== null && seedB !== null) {
      // maior seed = menor número
      if (seedB < seedA) {
        draftA = { matchSide: "B", userId: idB, name: nameB, seed: seedB };
        draftB = { matchSide: "A", userId: idA, name: nameA, seed: seedA };
      }
    }
    return { draftA, draftB };
  }

  // role no painel: a/b (ou P1/P2). No socket usamos P1/P2.
  function normalizeRole(v) {
    const r = String(v || "").toUpperCase();
    if (r === "A") return "P1";
    if (r === "B") return "P2";
    if (r === "P") return "P1";
    if (r === "O") return "P2";
    if (r === "P1" || r === "P2") return r;
    if (r === "1") return "P1";
    if (r === "2") return "P2";
    return null;
  }
  let myRole = normalizeRole(q.role);

  // Se não veio role na URL, tenta resolver automaticamente pelo usuário logado no Painel.
  // Regra: A/B do draft já é definido por seed; então comparamos o userId do match com o draftA/draftB.
  if (!myRole) {
    const meId = session?.userId || null;
    if (meId && match) {
      const { draftA, draftB } = resolveDraftSides(match);
      if (String(draftA.userId || "") === String(meId)) myRole = "P1";
      else if (String(draftB.userId || "") === String(meId)) myRole = "P2";
    }
  }

  function setRoleAndReload(role) {
    const r = role === "P2" ? "b" : "a";
    const p = new URLSearchParams(location.search);
    p.set("role", r);
    const next = `${location.pathname}?${p.toString()}`;
    history.replaceState({}, "", next);
    // Recarrega pra inicializar tudo com o role definido (mais simples e robusto)
    location.reload();
  }

  function maybeShowRolePicker() {
    if (myRole) return false;
    show(els.roleBox, true);
    if (els.roleRid) els.roleRid.textContent = matchId;

    const { draftA, draftB } = resolveDraftSides(match);
    const seedTxtA = (draftA.seed !== null) ? ` • Seed ${draftA.seed}` : "";
    const seedTxtB = (draftB.seed !== null) ? ` • Seed ${draftB.seed}` : "";
    if (els.btnRoleA) els.btnRoleA.textContent = `Sou ${draftA.name} (A${seedTxtA})`;
    if (els.btnRoleB) els.btnRoleB.textContent = `Sou ${draftB.name} (B${seedTxtB})`;

    if (els.btnRoleA) els.btnRoleA.onclick = () => setRoleAndReload("P1");
    if (els.btnRoleB) els.btnRoleB.onclick = () => setRoleAndReload("P2");
    return true;
  }

  if (maybeShowRolePicker()) {
    // fallback raro: sem sessão/match. Mantemos o picker para não travar.
    return;
  }

  // tenta descobrir templateId (painel manda na URL; se não mandar, tenta achar por BO)
  const templateId = q.templateId || null;

  function inferSeriesFromMatch(m) {
    // painel costuma usar md (ex: 3,5,7)
    const md = Number(m?.md || m?.format || 0);
    if (md === 1) return "BO1";
    if (md === 2) return "BO2";
    if (md === 3) return "BO3";
    if (md === 5) return "BO5";
    if (md === 7) return "BO7";
    return null;
  }

  function inferTemplateIdBySeries(series) {
    const arr = safeJson(LS_DRAFT_TEMPLATES, []);
    // o painel costuma armazenar o template com series: "BO3" etc
    const t = arr.find((x) => (x?.series || x?.config?.series) === series) || null;
    return t ? t.id : null;
  }

  const inferredSeries = inferSeriesFromMatch(match) || q.series || null;
  const effectiveTemplateId = templateId || (inferredSeries ? inferTemplateIdBySeries(inferredSeries) : null);

  function buildConfigFromTemplate(tpl) {
    // aceitamos dois formatos: template pronto ou {config:{...}}
    const cfg = tpl?.config ? tpl.config : tpl;
    if (!cfg) return null;
    return {
      series: cfg.series,
      maps: Array.isArray(cfg.maps) ? cfg.maps : [],
      civs: Array.isArray(cfg.civs) ? cfg.civs : [],
      flow: Array.isArray(cfg.flow) ? cfg.flow : [],
    };
  }

  // ---------- init draft on server ----------
  async function initDraft() {
    const tpl = effectiveTemplateId ? getTemplateById(effectiveTemplateId) : null;
    const config = tpl ? buildConfigFromTemplate(tpl) : null;

    if (!config) {
      // ainda permite entrar, mas o draft não vai existir no servidor
      throw new Error("TEMPLATE_NOT_FOUND");
    }

    const { draftA, draftB } = resolveDraftSides(match);

    const meta = {
      eventId: q.eventId || match?.eventId || null,
      matchId,
      round: q.round || match?.round || null,
      templateId: effectiveTemplateId,
      series: config.series,
      players: {
        P1: draftA?.name || "A",
        P2: draftB?.name || "B",
      }
    };

    const resp = await fetch(`/api/drafts/${encodeURIComponent(matchId)}/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, meta }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      const err = data?.error || `HTTP_${resp.status}`;
      throw new Error(err);
    }
    return data;
  }

  // ---------- socket ----------
  const socket = io();

  let latestRoom = null;
  let timerTick = null;

  function setStatus(msg) {
    if (els.status) els.status.textContent = msg;
  }

  function formatStep(step) {
    if (!step) return "—";
    const t = step.type || "—";
    const m = step.mode ? ` (${step.mode})` : "";
    return t + m;
  }

  function myTurn(room) {
    const step = currentStep(room);
    if (!step) return false;
    if (room.state?.confirm?.needed) return false;
    if (step.mode === "TURN") return step.by === myRole;
    if (step.mode === "SIMUL") return true;
    return false;
  }

  function currentStep(room) {
    return room?.config?.flow?.[room?.state?.stepIndex || 0] || null;
  }

  function clearPool() {
    els.pool.innerHTML = "";
  }

  function renderMiniRow(el, items, kind = "") {
    el.innerHTML = "";
    if (!items || !items.length) {
      el.appendChild(pill("—", "muted"));
      return;
    }
    for (const it of items) {
      el.appendChild(pill(it, kind));
    }
  }

  function renderBoards(room) {
    const p1Picks = room?.state?.civs?.pickedBy?.P1 || [];
    const p2Picks = room?.state?.civs?.pickedBy?.P2 || [];
    const p1Bans = (room?.state?.civs?.bannedBy?.P1 || []).concat(room?.state?.civs?.snipedBy?.P1 || []);
    const p2Bans = (room?.state?.civs?.bannedBy?.P2 || []).concat(room?.state?.civs?.snipedBy?.P2 || []);

    renderMiniRow(els.p1Sel, p1Picks, "ok");
    renderMiniRow(els.p2Sel, p2Picks, "ok");
    renderMiniRow(els.p1Ban, p1Bans, "bad");
    renderMiniRow(els.p2Ban, p2Bans, "bad");
  }

  function renderTimer(room) {
    const endsAt = room?.state?.timer?.endsAt || null;
    if (!endsAt) {
      show(els.hdrTimer, false);
      return;
    }
    show(els.hdrTimer, true);

    const left = Math.max(0, Math.ceil((Number(endsAt) - Date.now()) / 1000));
    els.hdrTimerVal.textContent = `${left}s`;
  }

  function startTimerLoop() {
    if (timerTick) return;
    timerTick = setInterval(() => {
      if (latestRoom) renderTimer(latestRoom);
    }, 250);
  }

  function stopTimerLoop() {
    if (timerTick) clearInterval(timerTick);
    timerTick = null;
  }

  function stepInstruction(room) {
    const step = currentStep(room);
    if (!step) return "—";
    if (room.state?.confirm?.needed) return "Aguardando confirmação (OK) dos 2 jogadores…";

    const type = step.type;
    const by = step.by;
    const isMine = by === myRole;

    const base = {
      MAP_BAN: "BANIR um mapa",
      MAP_PICK: "ESCOLHER um mapa",
      MAP_RANDOM: "Mapa decisivo sendo sorteado…",
      CIV_BAN: "BANIR uma civilização",
      CIV_PICK: "ESCOLHER uma civilização",
      CIV_SNIPE: "SNIPE: remover 1 civ do oponente",
      CIV_REVEAL: "Revelando escolhas…",
      SUMMARY: "Draft concluído."
    }[type] || type;

    if (step.mode === "TURN") {
      return isMine ? `Sua vez: ${base}` : `Vez do oponente: ${base}`;
    }
    if (step.mode === "SIMUL") {
      return `Simultâneo: ${base}`;
    }
    return base;
  }

  function poolHintForStep(step) {
    if (!step) return "—";
    if (step.type === "MAP_BAN") return "Clique em um mapa para banir.";
    if (step.type === "MAP_PICK") return "Clique em um mapa para pickar.";
    if (step.type === "CIV_BAN") return "Clique em uma civilização para banir.";
    if (step.type === "CIV_PICK") return "Clique em uma civilização para pickar.";
    if (step.type === "CIV_SNIPE") return "Clique em uma civ pickada pelo oponente para snipe.";
    if (step.type === "SUMMARY") return "Draft finalizado.";
    return "—";
  }

  function isTakenMap(room, mapName) {
    const st = room.state?.maps;
    const picked = st?.picked || [];
    const bannedP1 = st?.bannedBy?.P1 || [];
    const bannedP2 = st?.bannedBy?.P2 || [];
    return picked.includes(mapName) || bannedP1.includes(mapName) || bannedP2.includes(mapName);
  }

  function renderPool(room) {
    const step = currentStep(room);
    clearPool();

    els.poolTitle.textContent = step ? (step.type.startsWith("MAP") ? "Pool de Mapas" : "Pool de Civs") : "Pool";
    els.poolHint.textContent = poolHintForStep(step);

    if (!step) return;

    // bloqueios
    const locked = !myTurn(room) && !(room.state?.confirm?.needed);

    if (step.type === "MAP_BAN" || step.type === "MAP_PICK") {
      const maps = room.config?.maps || [];
      for (const m of maps) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "poolItem";
        btn.textContent = m;

        const taken = isTakenMap(room, m);
        if (taken) btn.classList.add("disabled");

        btn.disabled = locked || taken;

        btn.addEventListener("click", () => {
          sendAction(step.type, m);
        });

        els.pool.appendChild(btn);
      }
      return;
    }

    if (step.type === "CIV_BAN" || step.type === "CIV_PICK") {
      const civs = room.config?.civs || [];
      const banned = room.state?.civs?.bannedGlobal || [];
      const myPicks = room.state?.civs?.pickedBy?.[myRole] || [];

      for (const c of civs) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "poolItem";
        btn.textContent = c;

        const isBanned = banned.includes(c);
        const alreadyMine = myPicks.includes(c);

        if (isBanned || alreadyMine) btn.classList.add("disabled");

        btn.disabled = locked || isBanned || alreadyMine;

        btn.addEventListener("click", () => {
          sendAction(step.type, c);
        });

        els.pool.appendChild(btn);
      }
      return;
    }

    if (step.type === "CIV_SNIPE") {
      const opp = myRole === "P1" ? "P2" : "P1";
      const oppPicks = room.state?.civs?.pickedBy?.[opp] || [];
      const alreadySniped = (room.state?.civs?.snipedBy?.P1 || []).concat(room.state?.civs?.snipedBy?.P2 || []);

      if (!oppPicks.length) {
        els.pool.appendChild(pill("O oponente ainda não tem picks.", "muted"));
        return;
      }

      for (const c of oppPicks) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "poolItem";
        btn.textContent = c;

        const sn = alreadySniped.includes(c);
        if (sn) btn.classList.add("disabled");
        btn.disabled = locked || sn;

        btn.addEventListener("click", () => {
          sendAction("CIV_SNIPE", c);
        });

        els.pool.appendChild(btn);
      }
      return;
    }

    if (step.type === "SUMMARY") {
      els.pool.appendChild(pill("—", "muted"));
      return;
    }
  }

  function renderHeader(room) {
    els.hdrId.textContent = room.id;
    els.hdrSeries.textContent = room.config?.series || "—";
    els.hdrStep.textContent = formatStep(currentStep(room));
    renderTimer(room);
  }

  function renderReady(room) {
    els.rid.textContent = room.id;

    const p1Name = (room.state?.players?.P1?.name || "").trim() || (room.state?.meta?.players?.P1 || "") || "—";
    const p2Name = (room.state?.players?.P2?.name || "").trim() || (room.state?.meta?.players?.P2 || "") || "—";

    els.rP1.textContent = p1Name;
    els.rP2.textContent = p2Name;

    const side = myRole === "P1" ? "A" : "B";
    const nick = (meNick || (side === "A" ? p1Name : p2Name) || "—").trim();
    els.who.textContent = `Você: ${nick} (${side})`;
  }

  function renderSummary(room) {
    const dataUrl = room.state?.summary?.dataUrl || null;
    if (!dataUrl) {
      show(els.summaryBox, false);
      return;
    }
    els.summaryImg.src = dataUrl;
    show(els.summaryBox, true);
  }

  function render(room) {
    latestRoom = room;

    if (!room.state?.started) {
      show(els.readyBox, true);
      show(els.draftBox, false);
      renderReady(room);
      setStatus("Aguardando os 2 jogadores ficarem PRONTOS…");
      startTimerLoop();
      return;
    }

    show(els.readyBox, false);
    show(els.draftBox, true);

    renderHeader(room);
    renderBoards(room);

    const instr = stepInstruction(room);
    els.instruction.textContent = instr;

    // confirm
    const needsConfirm = !!room.state?.confirm?.needed;
    show(els.confirmBox, needsConfirm);
    if (needsConfirm) {
      els.confirmText.textContent = "Etapa concluída. Clique OK (ambos os jogadores) para avançar.";
    }

    renderPool(room);
    renderSummary(room);

    startTimerLoop();
  }

  function sendAction(kind, item = null) {
    if (!latestRoom) return;
    const payload = { kind, by: myRole };
    if (item != null) payload.item = item;

    socket.emit("draft:action", { matchId, action: payload });
  }

  // ---------- events ----------
  els.readyBtn.addEventListener("click", () => {
    const name = String(els.playerName.value || "").trim();
    socket.emit("draft:action", {
      matchId,
      action: { kind: "READY", by: myRole, name }
    });
  });

  els.confirmBtn.addEventListener("click", () => {
    socket.emit("draft:action", { matchId, action: { kind: "CONFIRM", by: myRole } });
  });

  els.btnReset.addEventListener("click", () => {
    if (!confirm("Resetar o draft desta partida?")) return;
    socket.emit("draft:action", { matchId, action: { kind: "RESET", by: myRole } });
  });

  // download summary
  els.downloadSummary?.addEventListener("click", () => {
    const url = els.summaryImg?.src;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `draft_${matchId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  socket.on("connect", () => {
    setStatus("Conectado. Entrando no draft…");
    socket.emit("join", { matchId, role: myRole });
  });

  socket.on("room:error", (e) => {
    console.error("room:error", e);
    alert(`Erro ao entrar no draft: ${e?.error || "UNKNOWN"}`);
  });

  socket.on("draft:error", (e) => {
    console.warn("draft:error", e);
    const msg = e?.error || "Ação inválida";
    setStatus(`⚠️ ${msg}`);
  });

  socket.on("room:state", ({ room }) => {
    render(room);
  });

  // ---------- bootstrap ----------
  (async function boot() {
    try {
      await initDraft();
      // garante que a UI abre no modo certo mesmo antes do primeiro state
      show(els.readyBox, true);
      els.rid.textContent = matchId;
      const side = myRole === "P1" ? "A" : "B";
      if (els.playerName) {
        if (meNick) els.playerName.value = meNick;
        // como o painel já tem o nick do usuário, evitamos confusão
        if (meNick) els.playerName.disabled = true;
      }
      els.who.textContent = meNick ? `Você: ${meNick} (${side})` : `Você (${side})`;
      setStatus("Draft inicializado. Aguardando conexão…");
    } catch (err) {
      console.error(err);
      alert("Não foi possível inicializar o draft (template/config ausente no painel).");
    }
  })();

})();