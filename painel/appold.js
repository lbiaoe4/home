/* LBI Painel 2.0 — MVP front-end (localStorage)
   Observação: isto é PROTÓTIPO. Depois migramos para API + DB + hash de senha.
*/

(function () {
  const LS_USERS = "lbi_users";
  const LS_SESSION = "lbi_session";
  const LS_LAST = "lbi_last_user";

  const LS_EVENTS = "lbi_events";
  const LS_REGS = "lbi_regs";
  const LS_MATCHES = "lbi_matches";

  // Draft templates (admin-defined) stored locally (same origin) for MVP.
  const LS_DRAFT_TEMPLATES = "lbi_draft_templates_v1";

  // UI helpers
  const LS_UI_LAST_EVENT = "lbi_ui_lastEventId";


  function nowISO() {
    return new Date().toISOString();
  }

  // ---------- Storage helpers ----------
  function loadUsers() {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_USERS) || "[]");
      // MIGRAÇÃO: garantir profile.nickname usando campos antigos
      let changed = false;
      for (const u of arr) {
        if (!u.profile) u.profile = {};
        const legacy = u.nickname || u.profile.nick || u.profile.displayName;
        if (!u.profile.nickname && legacy) {
          u.profile.nickname = legacy;
          changed = true;
        }
      }
      if (changed) localStorage.setItem(LS_USERS, JSON.stringify(arr));
      return arr;
    } catch {
      return [];
    }
  }
  function saveUsers(users) {
    localStorage.setItem(LS_USERS, JSON.stringify(users));
  }

  function loadEvents() {
    try {
      return JSON.parse(localStorage.getItem(LS_EVENTS) || "[]");
    } catch {
      return [];
    }
  }
  function saveEvents(items) {
    localStorage.setItem(LS_EVENTS, JSON.stringify(items));
  }

  function loadMatches(){
    try { return JSON.parse(localStorage.getItem(LS_MATCHES) || "[]"); }
    catch { return []; }
  }

  function saveMatches(items){
    localStorage.setItem(LS_MATCHES, JSON.stringify(items));
  }

  function loadDraftTemplates() {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_DRAFT_TEMPLATES) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function findDraftTemplateById(id) {
    if (!id) return null;
    return loadDraftTemplates().find((t) => t && t.id === id) || null;
  }

  function loadRegs() {
    try {
      return JSON.parse(localStorage.getItem(LS_REGS) || "[]");
    } catch {
      return [];
    }
  }
  function saveRegs(items) {
    localStorage.setItem(LS_REGS, JSON.stringify(items));
  }



  // ---------- Seed ----------
  function ensureSeed() {
    const users = loadUsers();

    // Seed admin (só cria se não existir nenhum usuário)
    if (!users.length) {
      users.push({
        id: crypto.randomUUID(),
        login: "admin",
        password: "admin123",
        accessLevel: "admin",
        points: 0,
        profile: { completed: true, nickname: "Administrador", fullName: "Administrador" },
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });
      saveUsers(users);
    }

    // Seed de evento (só cria se não existir nenhum evento)
    const evs = loadEvents();
    if (!evs.length) {
      evs.push({
        id: crypto.randomUUID(),
        title: "LBI • Evento Teste 1v1",
        type: "1v1",
        status: "Inscrições abertas",
        startDate: "",
        description: "Evento de teste para validar fluxo de inscrição.",
        rulesUrl: "",
        termsUrl: "",
        bracketCap: 32,
        formatByRound: { R64:"MD3", R32:"MD3", R16:"MD3", R8:"MD5", R4:"MD5", R2:"MD7" },
        pointsTable: {},
        prizeTable: {},
        splitTeamsEqually: true,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });
      saveEvents(evs);
    }
  }

  // ---------- Session ----------
  function setSession(user) {
    localStorage.setItem(
      LS_SESSION,
      JSON.stringify({
        userId: user.id,
        login: user.login,
        accessLevel: user.accessLevel,
        createdAt: nowISO(),
      })
    );
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(LS_SESSION) || "null");
    } catch {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(LS_SESSION);
  }

  // ---------- Utils ----------
  function findUserByLogin(login) {
    const users = loadUsers();
    return users.find(
      (u) => (u.login || "").toLowerCase() === (login || "").toLowerCase()
    );
  }

  function updateUser(id, patch) {
    const users = loadUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx < 0) return null;
    users[idx] = { ...users[idx], ...patch, updatedAt: nowISO() };
    saveUsers(users);
    return users[idx];
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m]));
  }



function parseKVLines(text){
  const out = {};
  const raw = String(text||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  for(const line of raw){
    const m = line.match(/^\s*(\d+)\s*[=:]\s*([\d.,]+)\s*$/);
    if(!m) continue;
    const k = Number(m[1]);
    const v = Number(String(m[2]).replace(",", "."));
    if(Number.isFinite(k) && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function serializeKVLines(obj){
  if(!obj || typeof obj !== "object") return "";
  const keys = Object.keys(obj).map(x=>Number(x)).filter(Number.isFinite).sort((a,b)=>a-b);
  return keys.map(k=>`${k}=${obj[k]}`).join("\n");
}

function normalizeBracketCap(capSel, capCustom){
  let cap = 32;
  if(capSel === "custom"){
    const n = Number(String(capCustom||"").replace(/[^\d]/g,""));
    if(Number.isFinite(n) && n>=2 && n<=64) cap = n;
  } else {
    const n = Number(capSel);
    if(Number.isFinite(n) && n>=2 && n<=64) cap = n;
  }
  // trava nos valores válidos de chave (potências de 2) quando custom não for potência?
  // Para MVP, permitimos custom: o sistema vai arredondar para a próxima potência de 2 para gerar matches,
  // mas o "cap" serve como limite de seeds (1..cap).
  return cap;
}

function pow2Ceil(n){
  let p = 1;
  while(p < n) p *= 2;
  return Math.min(64, Math.max(2, p));
}

function setLastEventId(eventId){
  if(!eventId) return;
  localStorage.setItem(LS_UI_LAST_EVENT, String(eventId));
}

function getLastEventId(){
  return localStorage.getItem(LS_UI_LAST_EVENT) || "";
}



// ---------- Bracket / Matches ----------
function nextPow2Cap(n) {
  if (n <= 32) return 32;
  return 64; // limite atual
}

function roundNameFromSize(size) {
  if (size === 64) return "R64";
  if (size === 32) return "R32";
  if (size === 16) return "R16";
  if (size === 8) return "R8";
  if (size === 4) return "R4";
  if (size === 2) return "R2";
  return `R${size}`;
}

// Gera a ordem de seeds padrão do bracket
// Ex 32: [1,32,16,17,8,25,9,24,4,29,...] (bate com seu AA/AB/AC...)
function seedOrder(size) {
  let order = [1, 2];
  while (order.length < size) {
    const m = order.length * 2;
    const next = [];
    for (const s of order) next.push(s, m + 1 - s);
    order = next;
  }
  return order;
}

function mdForEvent(ev, round){
  const r = String(round||"").toUpperCase();
  const cfg = ev?.formatByRound || ev?.mdByRound || null;
  const fromCfg = cfg && (cfg[r] || cfg[r.replace(/^R/, "R")] );
  if(fromCfg) return String(fromCfg).toUpperCase();
  // fallback padrão
  if (r === "R64") return "MD3";
  if (r === "R32") return "MD3";
  if (r === "R16") return "MD3";
  if (r === "R8") return "MD5";
  if (r === "R4") return "MD5";
  if (r === "R2") return "MD7";
  return "MD3";
}

function propagateWinner(matches, match) {
  if (!match.nextMatchId) return;
  const next = matches.find((m) => m.id === match.nextMatchId);
  if (!next) return;

  if (match.nextSlot === "A") {
    next.participantAId = match.winnerId;
    next.seedA = match.winnerSeed;
  } else {
    next.participantBId = match.winnerId;
    next.seedB = match.winnerSeed;
  }
  next.updatedAt = nowISO();
}

function generateBracketForEvent(eventId) {
  const events = loadEvents();
  const ev = events.find((e) => e.id === eventId);
  if (!ev) return false;

  // pega inscrições aprovadas
  const regs = loadRegs().filter(
    (r) => r.eventId === eventId && r.status === "Aprovado"
  );

  const N = regs.length;
  if (N < 2) return false;

  // valida seeds duplicadas
  const used = new Set();
  for (const r of regs) {
    if (!r.seed) continue;
    if (used.has(r.seed)) return false;
    used.add(r.seed);
  }

const capLimit = Number(ev.bracketCap || 32);
if (Number.isFinite(capLimit) && N > capLimit) return false;
const bracketSize = pow2Ceil(Number.isFinite(capLimit) ? capLimit : N);

  const rounds = [];
  let size = bracketSize;
  while (size >= 2) {
    rounds.push({ round: roundNameFromSize(size), size });
    size = size / 2;
  }

  // cria matches de todas as fases
  const allMatches = [];
  for (let ri = 0; ri < rounds.length; ri++) {
    const r = rounds[ri];
    const count = r.size / 2;
    for (let i = 0; i < count; i++) {
      allMatches.push({
        id: crypto.randomUUID(),
        eventId,
        round: r.round,
        index: i,
        code: `${r.round}-${String(i + 1).padStart(2, "0")}`,
        md: mdForEvent(ev, r.round),
        participantAId: null,
        participantBId: null,
        seedA: null,
        seedB: null,
        scheduledAt: "",
        status: "Não agendada",
        checkinAAt: "",
        checkinBAt: "",
        scoreA: 0,
        scoreB: 0,
        winnerId: null,
        winnerSeed: null,
        validatedAt: "",
        createdAt: nowISO(),
        updatedAt: nowISO(),
        nextMatchId: null,
        nextSlot: null,
      });
    }
  }

  // linka para próxima fase
  for (let ri = 0; ri < rounds.length - 1; ri++) {
    const curRound = rounds[ri];
    const nextRound = rounds[ri + 1];

    const curMatches = allMatches
      .filter((m) => m.round === curRound.round)
      .sort((a, b) => a.index - b.index);
    const nextMatches = allMatches
      .filter((m) => m.round === nextRound.round)
      .sort((a, b) => a.index - b.index);

    curMatches.forEach((m, i) => {
      const target = nextMatches[Math.floor(i / 2)];
      m.nextMatchId = target ? target.id : null;
      m.nextSlot = i % 2 === 0 ? "A" : "B";
    });
  }

  // ordena inscritos por seed (sem seed vai para o fim)
  const orderedRegs = regs.slice().sort((a, b) => {
    const sa = a.seed ? Number(a.seed) : 9999;
    const sb = b.seed ? Number(b.seed) : 9999;
    if (sa !== sb) return sa - sb;
    return (a.createdAt || "").localeCompare(b.createdAt || "");
  });

  // seed -> participantId (MVP: 1v1 = userId)
  const entrants = new Map();
  let autoSeed = 1;
  for (const r of orderedRegs) {
    let s = r.seed ? Number(r.seed) : null;
    if (!s) {
      while (entrants.has(autoSeed)) autoSeed++;
      s = autoSeed;
    }
    if (s < 1 || s > bracketSize) continue;

    // MVP: para equipe no futuro, trocar para r.teamId
    entrants.set(s, r.userId || null);
  }

  // preenche primeira fase
  const firstRoundName = roundNameFromSize(bracketSize);
  const firstRoundMatches = allMatches
    .filter((m) => m.round === firstRoundName)
    .sort((a, b) => a.index - b.index);

  const order = seedOrder(bracketSize);

  for (let i = 0; i < firstRoundMatches.length; i++) {
    const m = firstRoundMatches[i];
    const seedA = order[i * 2];
    const seedB = order[i * 2 + 1];

    const pa = entrants.get(seedA) || null;
    const pb = entrants.get(seedB) || null;

    m.seedA = seedA;
    m.seedB = seedB;
    m.participantAId = pa;
    m.participantBId = pb;
    m.updatedAt = nowISO();

    // BYE automático
    if (pa && !pb) {
      m.status = "BYE";
      m.winnerId = pa;
      m.winnerSeed = seedA;
      m.validatedAt = nowISO();
      propagateWinner(allMatches, m);
    } else if (!pa && pb) {
      m.status = "BYE";
      m.winnerId = pb;
      m.winnerSeed = seedB;
      m.validatedAt = nowISO();
      propagateWinner(allMatches, m);
    } else if (!pa && !pb) {
      m.status = "Vazio";
    } else {
      m.status = "Não agendada";
    }
  }

  // salva: remove matches antigos do evento e grava novos
  const existing = loadMatches().filter((x) => x.eventId !== eventId);
  saveMatches([...existing, ...allMatches]);

  return true;
}

function hasLockedMatches(eventId){
  // Considera "travado" se houver qualquer partida validada ou WO.
  const ms = loadMatches().filter(m=>m.eventId===eventId);
  return ms.some(m=>{
    const s = String(m.status||"").toLowerCase();
    if(s.includes("valid")) return true;
    if(s === "wo") return true;
    if(m.validatedAt) return true;
    return false;
  });
}

function cloneEventForRegen(eventId){
  const events = loadEvents();
  const src = events.find(e=>e.id===eventId);
  if(!src) return null;

  const newId = crypto.randomUUID();
  const clone = {
    ...src,
    id: newId,
    title: `${src.title || "Evento"} (Clone)`,
    status: "Em breve",
    // reset locks/resultados no clone
    locked: false,
    startedAt: "",
    completedAt: "",
    results: null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  events.unshift(clone);
  saveEvents(events);

  // clona inscrições (mantém status/seed)
  const regs = loadRegs();
  const srcRegs = regs.filter(r=>r.eventId===eventId);
  const clonedRegs = srcRegs.map(r=>({
    ...r,
    id: crypto.randomUUID(),
    eventId: newId,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }));
  saveRegs([...regs, ...clonedRegs]);

  // NÃO clona matches (zera a chave)
  return clone;
}

function safeRegenerateBracket(eventId){
  const ev = loadEvents().find(e=>e.id===eventId);
  if(!ev) return { ok:false, msg:"Evento não encontrado." };

  if(!hasLockedMatches(eventId)){
    const ok = generateBracketForEvent(eventId);
    if(ok) setLastEventId(eventId);
    return {
      ok,
      msg: ok ? "Chave (re)gerada com sucesso!" : "Não foi possível gerar a chave. Verifique seeds duplicadas, cap e mínimo de aprovados."
    };
  }

  // Evento já tem partidas validadas: oferece clonar.
  const goClone = confirm(
    "Este evento já tem partidas validadas/WO.\n\nPara preservar o histórico, a opção segura é CLONAR o evento e gerar a chave no clone.\n\nDeseja clonar agora?"
  );
  if(!goClone) return { ok:false, msg:"Ação cancelada (evento travado por resultados)." };

  const cloned = cloneEventForRegen(eventId);
  if(!cloned) return { ok:false, msg:"Falha ao clonar evento." };

  const ok = generateBracketForEvent(cloned.id);
  if(ok) setLastEventId(cloned.id);
  return {
    ok,
    msg: ok
      ? `Evento clonado e chave gerada: ${cloned.title}`
      : `Evento clonado (${cloned.title}), mas não foi possível gerar a chave. Verifique seeds/cap.`
  };
}



  // ---------- Views ----------
  function renderMeusDados(user) {
    const p = user.profile || {};
    const requiredHint = `<div class="muted small">Campos com * são obrigatórios.</div>`;

    return `
      <div class="row">
        <div class="field">
          <label>Nome completo*</label>
          <input class="input" id="fullName" value="${esc(p.fullName || "")}" />
        </div>
        <div class="field">
          <label>Nick (nome exibido)*</label>
          <input class="input" id="nickname" placeholder="ex: Gui / Rafacomando" value="${esc(p.nickname || user.nickname || "")}" />
          <div class="muted small">Esse é o nome que aparece na bracket, resultados e inscrições.</div>
        </div>
        <div class="field">
          <label>Data de nascimento*</label>
          <input class="input" id="birthDate" type="date" value="${esc(
            p.birthDate || ""
          )}" />
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label>CPF*</label>
          <input class="input" id="cpf" inputmode="numeric" placeholder="somente números" value="${esc(
            p.cpf || ""
          )}" />
        </div>
        <div class="field">
          <label>Email</label>
          <input class="input" id="email" type="email" value="${esc(
            p.email || ""
          )}" />
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label>WhatsApp</label>
          <input class="input" id="whatsapp" placeholder="ex: 55DDD9XXXXYYYY" value="${esc(
            p.whatsapp || ""
          )}" />
        </div>
        <div class="field">
          <label>Discord</label>
          <input class="input" id="discord" placeholder="ex: nick#0000" value="${esc(
            p.discord || ""
          )}" />
        </div>
      </div>

      <div class="field">
        <label>Link AoE4World da conta principal*</label>
        <input class="input" id="aoe4Main" placeholder="https://aoe4world.com/players/..." value="${esc(
          p.aoe4Main || ""
        )}" />
      </div>

      <div class="field">
        <label>Link AoE4World de outras contas (smurf)</label>
        <textarea class="textarea" id="aoe4Smurfs" placeholder="1 link por linha">${esc(
          p.aoe4Smurfs || ""
        )}</textarea>
      </div>

      <div class="field">
        <label>Chave Pix para premiações*</label>
        <input class="input" id="pixKey" value="${esc(p.pixKey || "")}" />
      </div>

      <div id="minorBox"></div>

      ${requiredHint}

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top: 14px;">
        <button class="btn2 primary" id="saveProfile">Salvar</button>
        <span class="muted small" id="profileMsg"></span>
      </div>
    `;
  }

  function renderInscricoes(user) {
  const events = loadEvents();
  const regs = loadRegs();
  const users = loadUsers();

  const myRegs = regs.filter((r) => r.userId === user.id);

  const open = events.filter((e) => e.status === "Inscrições abertas");
  const soon = events.filter((e) => e.status === "Em breve");
  const closed = events.filter(
    (e) => e.status !== "Inscrições abertas" && e.status !== "Em breve"
  );

  function teamSizeFromType(t) {
    const s = String(t || "").toLowerCase().trim();
    if (s === "2v2") return 2;
    if (s === "3v3") return 3;
    return 1;
  }

  function teamUI(e) {
    const size = teamSizeFromType(e.type);
    if (size <= 1) return "";

    const options = users
      .filter((u) => u.id !== user.id)
      .map((u) => {
        const label = u.profile?.nickname || u.profile?.fullName || u.login;
        return `<option value="${esc(u.id)}">${esc(label)} (${esc(u.login)})</option>`;
      })
      .join("");

    // Para 2v2: 1 parceiro; para 3v3: 2 parceiros
    const partners = Array.from({ length: size - 1 }).map((_, i) => `
      <div class="field">
        <label>Parceiro ${i + 1}</label>
        <select class="select" id="teamMate_${e.id}_${i}">
          <option value="">Selecionar…</option>
          ${options}
        </select>
      </div>
    `).join("");

    return `
      <div class="row" style="margin-top:10px;">
        <div class="field" style="min-width:260px;">
          <label>Nome do time</label>
          <input class="input" id="teamName_${e.id}" placeholder="Ex: IMBR Legends" />
          <div class="muted small">Você será o capitão desta inscrição.</div>
        </div>
        ${partners}
      </div>
    `;
  }

  function cardEvent(e) {
    const reg = myRegs.find((r) => r.eventId === e.id);
    const already = !!reg;
    const status = reg?.status || "";

    return `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-h">
          <div>
            <div class="kicker">${esc(e.status)}</div>
            <div class="h1like" style="margin:0;">${esc(e.title)}</div>
          </div>
          <span class="p-pill">${esc(e.type || "")}</span>
        </div>

        <div class="card-b">
          <div class="muted" style="margin-bottom:10px;">${esc(
            e.description || ""
          )}</div>

          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
            ${e.rulesUrl ? `<a class="btn2" target="_blank" href="${esc(
              e.rulesUrl
            )}">Livro de Regras</a>` : ``}
            ${e.termsUrl ? `<a class="btn2" target="_blank" href="${esc(
              e.termsUrl
            )}">Termos de Uso</a>` : ``}
          </div>

          ${
            e.status === "Inscrições abertas"
              ? `
            ${teamUI(e)}

            <div class="field" style="margin-top:10px;">
              <label style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" id="agree_${e.id}"/>
                <span>Li e concordo com o livro de regras e termos (quando existirem).</span>
              </label>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn2 ${already ? "ok" : "primary"}" data-ev-join="${e.id}" ${already ? "disabled" : ""}>
                ${already ? "Inscrito" : "Inscrever"}
              </button>
              <span class="muted small">${
                already ? `Você já está inscrito. Status: ${esc(status || "Pendente")}` : ""
              }</span>
            </div>
          `
              : `
            <div class="muted small">Este evento não está com inscrições abertas.</div>
          `
          }
        </div>
      </div>
    `;
  }

  return `
    <div class="muted" style="margin-bottom:12px;">
      Inscreva-se nos eventos com status <strong>Inscrições abertas</strong>.
    </div>

    ${
      open.length
        ? `<div>${open.map(cardEvent).join("")}</div>`
        : `<div class="muted">Nenhum evento com inscrições abertas.</div>`
    }

    ${
      soon.length
        ? `
      <div style="margin-top:16px;">
        <div class="kicker">Em breve</div>
        ${soon.map(cardEvent).join("")}
      </div>
    `
        : ""
    }

    ${
      closed.length
        ? `
      <div style="margin-top:16px;">
        <div class="kicker">Outros status</div>
        ${closed.map(cardEvent).join("")}
      </div>
    `
        : ""
    }
  `;
}

function renderResultados() { }

  function renderResultados() {
    return `
      <div class="muted">
        <strong>Resultados (MVP)</strong><br/>
        Aqui vamos mostrar: eventos que você participou, histórico de partidas, posição final, pontos e premiação.
      </div>
    `;
  }

  function renderPartidas(user) {
  return `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-h">
        <div>
          <div class="kicker">Partidas</div>
          <h3 class="h1like" style="margin:0;">Partidas disponíveis</h3>
        </div>
        <span class="p-pill">User</span>
      </div>

      <div class="card-b">
        <div class="row">
          <div class="field">
            <label>Evento</label>
            <select class="select" id="uMatchEvent">
              <option value="">Todos</option>
            </select>
            <div class="muted small">Mostra partidas onde você é A ou B (1v1).</div>
          </div>

          <div class="field">
            <label>Status</label>
            <select class="select" id="uMatchStatus">
              <option value="">Todos</option>
              <option value="checkin">Check-in aberto</option>
              <option value="upcoming">Agendadas</option>
              <option value="pending">Aguardando validação</option>
              <option value="done">Finalizadas</option>
            </select>
          </div>
        </div>

        <div class="row">
          <div class="field">
            <label>Buscar</label>
            <input class="input" id="uMatchSearch" placeholder="código (R32-01), adversário..." />
          </div>

          <div class="field" style="display:flex; align-items:flex-end; gap:10px; justify-content:space-between;">
            <label style="display:flex; align-items:center; gap:10px; margin:0;">
              <input type="checkbox" id="uMatchShowAll" />
              <span class="muted small">Mostrar histórico (inclui fases futuras já definidas)</span>
            </label>
            <button class="btn2" id="uMatchRefresh">Atualizar</button>
          </div>
        </div>

        <div class="muted small" id="uMatchMsg"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">
        <div>
          <div class="kicker">Lista</div>
          <h3 class="h1like" style="margin:0;">Suas partidas</h3>
        </div>
      </div>
      <div class="card-b" style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width: 1100px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Fase</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Código</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Você</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Oponente</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Quando</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Janela</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">MD</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Status</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Ações</th>
            </tr>
          </thead>
          <tbody id="uMatchTbody">
            <tr><td colspan="9" class="muted" style="padding:10px;">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal matchroom -->
    <div id="uRoomModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9999; padding:24px;">
      <div class="card" style="max-width:920px; margin:0 auto;">
        <div class="card-h">
          <div>
            <div class="kicker">Matchroom</div>
            <h3 class="h1like" style="margin:0;" id="uRoomTitle">Partida</h3>
          </div>
          <button class="btn2" id="uRoomClose">Fechar</button>
        </div>

        <div class="card-b">
          <div class="muted" id="uRoomInfo" style="margin-bottom:12px;"></div>

          <div class="card" style="margin-bottom:12px;">
            <div class="card-h">
              <div>
                <div class="kicker">Draft</div>
                <h3 class="h1like" style="margin:0;">Abrir draft</h3>
              </div>
            </div>
            <div class="card-b">
              <a class="btn2 primary" id="uRoomDraftLink" target="_blank" href="#">Abrir Draft</a>
              <div class="muted small" style="margin-top:8px;">
                MVP: este link será apontado para o sistema de draft (vamos integrar depois).
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-h">
              <div>
                <div class="kicker">Resultado</div>
                <h3 class="h1like" style="margin:0;">Reportar (pré-validação)</h3>
              </div>
            </div>
            <div class="card-b">
              <div class="muted small" id="uRoomSeriesHint" style="margin-bottom:10px;"></div>

              <div id="uRoomGames" style="display:flex; flex-direction:column; gap:10px;"></div>

              <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:12px;">
                <span class="pill" id="uRoomAutoScore">Placar: —</span>
                <button class="btn2" id="uRoomClear" type="button">Limpar</button>
              </div>

              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn2" id="uRoomSave">Salvar reporte</button>
                <span class="muted small" id="uRoomMsg"></span>
              </div>

              <div class="muted small" style="margin-top:8px;">
                O admin ainda precisa <strong>validar</strong> para avançar na chave.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

  function renderAdminHome() {
    return `
      <div class="muted">
        <strong>Admin (MVP)</strong><br/>
        Clique nos cards do menu à esquerda para abrir cada módulo.
        <br/><br/>
        Próximos módulos que vamos construir:
        Gerenciar Usuários (tabela + editar/excluir), Gerenciar Eventos (status), Gerenciar Inscrições, Gerenciar Resultados.
      </div>
    `;
  }

  function renderAdminUsuarios(){
  const users = loadUsers().slice().sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));

  const rows = users.map(u=>{
    const name = u.profile?.fullName || "";
    const cpf = u.profile?.cpf ? String(u.profile.cpf).replace(/\D/g,"") : "";
    const email = u.profile?.email || "";
    const points = Number(u.points || 0);
    return `
      <tr>
        <td>${esc(u.login || "")}</td>
        <td>${esc(name)}</td>
        <td>${esc(u.accessLevel || "user")}</td>
        <td>${esc(cpf)}</td>
        <td>${esc(email)}</td>
        <td>${esc(points)}</td>
        <td style="white-space:nowrap;">
          <button class="btn2" data-user-edit="${u.id}">Editar</button>
          <button class="btn2" data-user-del="${u.id}">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-h">
        <div>
          <div class="kicker">Usuários</div>
          <h3 class="h1like" style="margin:0;">Gerenciar usuários</h3>
        </div>
        <span class="p-pill">Admin</span>
      </div>

      <div class="card-b">
        <div class="row">
          <div class="field">
            <label>Buscar</label>
            <input class="input" id="userSearch" placeholder="login, nome, cpf, email..." />
          </div>
          <div class="field">
            <label>Filtrar access level</label>
            <select class="select" id="userFilterLevel">
              <option value="">Todos</option>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>
        <div class="muted small" id="userMsg"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">
        <div>
          <div class="kicker">Lista</div>
          <h3 class="h1like" style="margin:0;">Usuários cadastrados</h3>
        </div>
      </div>

      <div class="card-b" style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width: 980px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Login</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Nome</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Level</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">CPF</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Email</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Pontos</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Ações</th>
            </tr>
          </thead>
          <tbody id="userTbody">
            ${rows || `<tr><td colspan="7" class="muted" style="padding:10px;">Nenhum usuário.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal editar usuário -->
    <div id="userModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9999; padding:24px;">
      <div class="card" style="max-width:860px; margin:0 auto;">
        <div class="card-h">
          <div>
            <div class="kicker">Editar</div>
            <h3 class="h1like" style="margin:0;">Editar Usuário</h3>
          </div>
          <button class="btn2" id="userModalClose">Fechar</button>
        </div>

        <div class="card-b">
          <input type="hidden" id="editUserId"/>

          <div class="row">
            <div class="field">
              <label>Login</label>
              <input class="input" id="editLogin" />
              <div class="muted small">Atenção: login precisa ser único.</div>
            </div>
            <div class="field">
              <label>Senha</label>
              <input class="input" id="editPassword" />
              <div class="muted small">Neste MVP, a senha é texto simples (depois vamos hashear no back-end).</div>
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>Access level</label>
              <select class="select" id="editAccess">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div class="field">
              <label>Pontos</label>
              <input class="input" id="editPoints" inputmode="numeric" />
            </div>
          </div>

          <hr style="border:none; border-top:1px solid rgba(255,255,255,.10); margin:14px 0;"/>

          <div class="row">
            <div class="field">
              <label>Nome completo</label>
              <input class="input" id="editFullName" />
            </div>
            <div class="field">
              <label>Data de nascimento</label>
              <input class="input" id="editBirthDate" type="date"/>
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>Nick (nome exibido)</label>
              <input class="input" id="editNickname" placeholder="ex: Rafacomando" />
              <div class="muted small">Esse nome é o que aparece no topo do painel e na bracket.</div>
            </div>
            <div class="field">
              <label class="muted">&nbsp;</label>
              <div class="muted small" style="padding:10px 0;">&nbsp;</div>
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>CPF</label>
              <input class="input" id="editCPF" inputmode="numeric" placeholder="somente números"/>
            </div>
            <div class="field">
              <label>Email</label>
              <input class="input" id="editEmail" type="email"/>
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>WhatsApp</label>
              <input class="input" id="editWhatsapp" />
            </div>
            <div class="field">
              <label>Discord</label>
              <input class="input" id="editDiscord" />
            </div>
          </div>

          <div class="field">
            <label>AoE4World (principal)</label>
            <input class="input" id="editAoe4Main" />
          </div>

          <div class="field">
            <label>AoE4World (smurfs)</label>
            <textarea class="textarea" id="editAoe4Smurfs" placeholder="1 link por linha"></textarea>
          </div>

          <div class="field">
            <label>Chave Pix</label>
            <input class="input" id="editPixKey" />
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px;">
            <button class="btn2 primary" id="userSave">Salvar alterações</button>
            <span class="muted small" id="userEditMsg"></span>
          </div>
        </div>
      </div>
    </div>
  `;
}


  function renderAdminEventos() {
    const events = loadEvents().sort((a, b) =>
      (b.updatedAt || "").localeCompare(a.updatedAt || "")
    );

    const rows = events
      .map(
        (e) => `
      <tr>
        <td>${esc(e.title)}</td>
        <td>${esc(e.type || "")}</td>
        <td>${esc(e.status || "")}</td>
        <td>${esc(e.startDate || "")}</td>
        <td style="white-space:nowrap;">
          <button class="btn2" data-ev-edit="${e.id}">Editar</button>
          <button class="btn2" data-ev-del="${e.id}">Excluir</button>
          <button class="btn2" data-ev-bracket="${e.id}">Regerar Chave</button>
        </td>
      </tr>
    `
      )
      .join("");

    return `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-h">
          <div>
            <div class="kicker">Eventos</div>
            <h3 class="h1like" style="margin:0;">Cadastrar / Editar</h3>
          </div>
          <span class="p-pill">Admin</span>
        </div>

        <div class="card-b">
          <input type="hidden" id="evId" value=""/>

          <div class="field">
            <label>Título do evento</label>
            <input class="input" id="evTitle" placeholder="Ex: LBI Master 2026 #1" />
          </div>

          <div class="row">
            <div class="field">
              <label>Formato</label>
              <select class="select" id="evType">
                <option value="1v1">1v1</option>
                <option value="2v2">2v2</option>
                <option value="3v3">3v3</option>
              </select>
            </div>

            <div class="field">
              <label>Status</label>
              <select class="select" id="evStatus">
                <option>Em breve</option>
                <option>Inscrições abertas</option>
                <option>Inscrições encerradas</option>
                <option>Evento em andamento</option>
                <option>Evento concluído</option>
              </select>
            
<div class="card" style="margin:14px 0 10px; background: rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);">
  <div class="card-h" style="padding:12px 14px;">
    <div>
      <div class="kicker">Configuração do evento</div>
      <div class="muted small">Cap da chave, MD por fase, pontos e premiação.</div>
    </div>
  </div>
  <div class="card-b" style="padding:12px 14px;">
    <div class="row">
      <div class="field">
        <label>Cap da Bracket</label>
        <select class="select" id="evBracketCap">
          <option value="8">8</option>
          <option value="16">16</option>
          <option value="32" selected>32</option>
          <option value="64">64</option>
          <option value="custom">Custom (até 64)</option>
        </select>
      </div>
      <div class="field">
        <label>Cap custom</label>
        <input class="input" id="evBracketCapCustom" placeholder="Ex: 24" />
      </div>
      <div class="field">
        <label>Dividir igualmente (2v2/3v3)</label>
        <select class="select" id="evSplitTeams">
          <option value="yes" selected>Sim</option>
          <option value="no">Não</option>
        </select>
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>MD R64+</label>
        <select class="select" id="evMdR64">
          <option>MD1</option><option selected>MD3</option><option>MD5</option><option>MD7</option>
        </select>
      </div>
      <div class="field">
        <label>MD R32</label>
        <select class="select" id="evMdR32">
          <option>MD1</option><option selected>MD3</option><option>MD5</option><option>MD7</option>
        </select>
      </div>
      <div class="field">
        <label>MD R16</label>
        <select class="select" id="evMdR16">
          <option>MD1</option><option selected>MD3</option><option>MD5</option><option>MD7</option>
        </select>
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>MD R8</label>
        <select class="select" id="evMdR8">
          <option>MD1</option><option>MD3</option><option selected>MD5</option><option>MD7</option>
        </select>
      </div>
      <div class="field">
        <label>MD R4</label>
        <select class="select" id="evMdR4">
          <option>MD1</option><option>MD3</option><option selected>MD5</option><option>MD7</option>
        </select>
      </div>
      <div class="field">
        <label>MD Final (R2)</label>
        <select class="select" id="evMdR2">
          <option>MD1</option><option>MD3</option><option>MD5</option><option selected>MD7</option>
        </select>
      </div>
    </div>

    <div class="row">
      <div class="field" style="flex:1;">
        <label>Tabela de pontos (uma linha por posição: ex 1=25)</label>
        <textarea class="textarea" id="evPointsTable" placeholder="1=25&#10;2=18&#10;3=15&#10;4=12"></textarea>
      </div>
      <div class="field" style="flex:1;">
        <label>Premiação (uma linha por posição: ex 1=1000)</label>
        <textarea class="textarea" id="evPrizeTable" placeholder="1=1000&#10;2=500&#10;3=250&#10;4=250"></textarea>
      </div>
    </div>
  </div>
</div>

</div>

<div class="card" style="margin:14px 0 10px; background: rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);">
  <div class="card-h" style="padding:12px 14px;">
    <div>
      <div class="kicker">Configuração do Draft</div>
      <div class="muted small">Seleciona um template (Mapa + Civil) para BO3/BO5/BO7.</div>
    </div>
    <div style="display:flex; gap:8px; align-items:center;">
      <button class="btn2" type="button" id="evOpenDraftTemplates">Abrir templates</button>
    </div>
  </div>
  <div class="card-b" style="padding:12px 14px;">
    <div class="row">
      <div class="field">
        <label>Draft habilitado</label>
        <select class="select" id="evDraftEnabled">
          <option value="no" selected>Não</option>
          <option value="yes">Sim</option>
        </select>
      </div>
      <div class="field" style="flex:1;">
        <label>Template de Draft</label>
        <select class="select" id="evDraftTemplateId">
          <option value="">(nenhum)</option>
        </select>
        <div class="muted small" id="evDraftTplHint" style="margin-top:6px;">Crie templates em /painel/draft-templates.html</div>
      </div>
    </div>
  </div>
</div>

</div>
          </div>

          <div class="row">
            <div class="field">
              <label>Data (opcional)</label>
              <input class="input" id="evStart" type="date"/>
            </div>

            <div class="field">
              <label>Link do Livro de Regras (opcional)</label>
              <input class="input" id="evRules" placeholder="https://..." />
            </div>
          </div>

          <div class="field">
            <label>Link dos Termos de Uso (opcional)</label>
            <input class="input" id="evTerms" placeholder="https://..." />
          </div>

          <div class="field">
            <label>Descrição</label>
            <textarea class="textarea" id="evDesc" placeholder="Resumo do evento..."></textarea>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn2 primary" id="evSave">Salvar</button>
            <button class="btn2" id="evClear">Limpar</button>
            <span class="muted small" id="evMsg"></span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-h">
          <div>
            <div class="kicker">Lista</div>
            <h3 class="h1like" style="margin:0;">Eventos cadastrados</h3>
          </div>
        </div>

        <div class="card-b" style="overflow:auto;">
          <table style="width:100%; border-collapse:collapse; min-width: 720px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Evento</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Formato</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Status</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Data</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows ||
                `<tr><td colspan="6" class="muted" style="padding:10px;">Nenhum evento cadastrado.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderAdminInscricoes() {
    const regs = loadRegs();
    const users = loadUsers();
    const events = loadEvents();

    const eventOptions = events
      .map((e) => `<option value="${esc(e.id)}">${esc(e.title)}</option>`)
      .join("");

    const userOptions = users
      .map((u) => {
        const label = u.profile?.nickname || u.profile?.fullName || u.login;
        return `<option value="${esc(u.id)}">${esc(label)} (${esc(u.login)})</option>`;
      })
      .join("");

    const rows = regs
      .slice()
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .map((r) => {
        const u = users.find((x) => x.id === r.userId);
        const e = events.find((x) => x.id === r.eventId);

        const userLabel = (r.teamName ? r.teamName : (u ? participantLabel(null, u.id) : "(usuário removido)"));
        const eventLabel = e ? e.title : "(evento removido)";

        return `
          <tr>
            <td>${esc(userLabel)}</td>
            <td>${esc(eventLabel)}</td>
            <td>${regStatusPill(r.status || "Pendente")}</td>
            <td>${esc(r.seed ?? "")}</td>
            <td>${esc(r.agreedAt || "")}</td>
            <td style="white-space:nowrap;">
              <button class="btn2" data-reg-approve="${r.id}">Aprovar</button>
              <button class="btn2" data-reg-pending="${r.id}">Pendente</button>
              <button class="btn2" data-reg-edit="${r.id}">Editar</button>
              <button class="btn2" data-reg-del="${r.id}">Excluir</button>
            </td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-h">
          <div>
            <div class="kicker">Inscrições</div>
            <h3 class="h1like" style="margin:0;">Gerenciar inscrições</h3>
          </div>
          <span class="p-pill">Admin</span>
        </div>

        <div class="card-b">
          <div class="row">
            <div class="field">
              <label>Filtro por Evento</label>
              <select class="select" id="regFilterEvent">
                <option value="">Todos</option>
                ${eventOptions}
              </select>
            </div>

            <div class="field">
              <label>Buscar (usuário)</label>
              <input class="input" id="regSearch" placeholder="nome ou login..." />
            
<div class="field">
  <label>Ordenar</label>
  <select class="select" id="regSort">
    <option value="recent" selected>Mais recentes</option>
    <option value="seedAsc">Seed (crescente)</option>
    <option value="seedDesc">Seed (decrescente)</option>
    <option value="nameAsc">Nome (A→Z)</option>
  </select>
</div>

<div class="field" style="align-self:flex-end; min-width:180px;">
  <label>&nbsp;</label>
  <button class="btn2 primary" id="btnSeedBulk">Definir seeds</button>
</div>

</div>
          </div>

          <div class="muted small" id="regMsg"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-h">
          <div>
            <div class="kicker">Lista</div>
            <h3 class="h1like" style="margin:0;">Inscrições registradas</h3>
          </div>
        </div>

        <div class="card-b" style="overflow:auto;">
          <table style="width:100%; border-collapse:collapse; min-width: 860px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Usuário</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Evento</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Status</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Seed</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Concordou em</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Ações</th>
              </tr>
            </thead>
            <tbody id="regTbody">
              ${
                rows ||
                `<tr><td colspan="6" class="muted" style="padding:10px;">Nenhuma inscrição.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- modal simples de edição -->
      <div id="regModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9999; padding:24px;">
        <div class="card" style="max-width:720px; margin:0 auto;">
          <div class="card-h">
            <div>
              <div class="kicker">Editar</div>
              <h3 class="h1like" style="margin:0;">Editar Inscrição</h3>
            </div>
            <button class="btn2" id="regModalClose">Fechar</button>
          </div>
          <div class="card-b">
            <input type="hidden" id="regEditId"/>

            <div class="row">
              <div class="field">
                <label>Usuário</label>
                <select class="select" id="regEditUser">
                  ${userOptions}
                </select>
              </div>

              <div class="field">
                <label>Evento</label>
                <select class="select" id="regEditEvent">
                  ${eventOptions}
                </select>
              </div>
            </div>

            <div class="row">
              <div class="field">
                <label>Status</label>
                <select class="select" id="regEditStatus">
                  <option>Pendente</option>
                  <option>Aprovado</option>
                  <option>Rejeitado</option>
                </select>
              </div>
              <div class="field">
                <label>Concordou em (ISO)</label>
                <input class="input" id="regEditAgreedAt" placeholder="YYYY-MM-DDTHH:mm:ss.sssZ" />
              </div>
            </div>

<div class="row">
  <div class="field">
    <label>Seed</label>
    <input class="input" id="regEditSeed" placeholder="Ex: 1" />
    <div class="muted small">Opcional. Use 1…cap do evento.</div>
  </div>

  <div class="field" style="min-width:260px;">
    <label>Nome do time (2v2/3v3)</label>
    <input class="input" id="regEditTeamName" placeholder="Ex: IMBR Legends" />
    <div class="muted small">Em 1v1 pode deixar vazio.</div>
  </div>
</div>

<div class="row" id="regEditTeamMembersRow" style="display:none;">
  <div class="field" style="flex:1;">
    <label>Membros do time (IDs de usuário, separados por vírgula)</label>
    <input class="input" id="regEditMemberIds" placeholder="id1,id2,id3" />
    <div class="muted small">Inclua o capitão também. Ex.: 2v2 = 2 IDs, 3v3 = 3 IDs.</div>
  </div>
</div>

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px;">
              <button class="btn2 primary" id="regEditSave">Salvar alterações</button>
              <span class="muted small" id="regEditMsg"></span>
            </div>
          </div>
        </div>


      <!-- modal seeds em massa -->
      <div id="seedBulkModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9999; padding:24px;">
        <div class="card" style="max-width:920px; margin:0 auto;">
          <div class="card-h">
            <div>
              <div class="kicker">Seeds</div>
              <h3 class="h1like" style="margin:0;">Definir seeds (em massa)</h3>
              <div class="muted small" id="seedBulkSubtitle" style="margin-top:4px;"></div>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
              <button class="btn2" id="btnSeedBulkAuto">Auto (ordem da lista)</button>
              <button class="btn2" id="btnSeedBulkClear">Limpar</button>
              <button class="btn2" id="seedBulkClose">Fechar</button>
            </div>
          </div>
          <div class="card-b">
            <div class="muted small" id="seedBulkMsg" style="margin-bottom:10px;"></div>
            <div id="seedBulkBody" style="overflow:auto; max-height:60vh;"></div>

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; align-items:center;">
              <button class="btn2 primary" id="btnSeedBulkSave">Salvar seeds</button>
              <span class="muted small">Dica: seeds repetidas ou fora do cap serão bloqueadas.</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    `;
  }

  
  function formatDTLocal(iso){
    if(!iso) return "";
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())) return "";
    const pad = (n)=> String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function prettyWhen(iso){
    if(!iso) return "";
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  function userLabelById(userId){
    const u = loadUsers().find(x=>x.id===userId);
    if(!u) return "(desconhecido)";
    return u.profile?.nickname || u.profile?.fullName || u.login || "(sem login)";
  }

  function participantLabel(evOrId, participantId){
    // participantId pode ser userId (1v1) OU registrationId (times / inscrições).
    const evId = (typeof evOrId === "string") ? evOrId : (evOrId && evOrId.id ? evOrId.id : null);

    // tenta encontrar inscrição pelo id do participante (registrationId)
    try{
      const regs = loadRegs();
      const reg = regs.find(r => r.id === participantId && (!evId || r.eventId === evId));
      if(reg){
        // Se for time, prioriza teamName. Caso contrário, usa o nickname do usuário da inscrição.
        if(reg.teamName) return reg.teamName;
        if(reg.userId) return userLabelById(reg.userId);
      }
    }catch(e){}

    // fallback: trata como userId
    return userLabelById(participantId);
  }

  function getRegById(evId, regId){
    try{
      const regs = loadRegs();
      return regs.find(r => r.id === regId && (!evId || r.eventId === evId)) || null;
    }catch(e){
      return null;
    }
  }


  function matchStatusPill(status){
  const raw = (status||"");
  const s = raw.toLowerCase();
  // Paleta por status (resultados)
  if(s.includes("valid")) return `<span class="p-pill ok">Validada</span>`;
  if(s.includes("andamento") || s.includes("em andamento") || s.includes("running")) return `<span class="p-pill warn">Em andamento</span>`;
  if(s.includes("agend")) return `<span class="p-pill info">Agendada</span>`;
  if(s.includes("não agendada") || s.includes("nao agendada")) return `<span class="p-pill">Não agendada</span>`;
  if(s.includes("bye")) return `<span class="p-pill">BYE</span>`;
  if(s.includes("vazio")) return `<span class="p-pill bad">Vazio</span>`;
  if(s.includes("wo")) return `<span class="p-pill bad">WO</span>`;
  return `<span class="p-pill">${esc(raw)}</span>`;
}

function regStatusPill(status){
  const raw = (status||"");
  const s = raw.toLowerCase();
  // Paleta por status (inscrições)
  if(s.includes("aprov")) return `<span class="p-pill ok">Aprovado</span>`;
  if(s.includes("pend")) return `<span class="p-pill warn">Pendente</span>`;
  if(s.includes("reprov") || s.includes("neg")) return `<span class="p-pill bad">Reprovado</span>`;
  if(s.includes("cancel")) return `<span class="p-pill bad">Cancelado</span>`;
  return `<span class="p-pill">${esc(raw)}</span>`;
}

function playerNameHtml(ev, userId, cssClass){
  const name = participantLabel(ev, userId);
  const cls = cssClass ? `p-name ${cssClass}` : "p-name";
  return `<span class="${cls}">${esc(name || "—")}</span>`;
}

// Para tabela de resultados e bracket: pinta vencedor/perdedor quando houver winnerId
function playerNameHtmlInMatch(match, userId, displayName){
  const name = displayName || participantLabel(match?.eventId || null, userId) || "—";
  if(!userId) return `<span class="p-name empty">—</span>`;
  const status = (match?.status || "").toLowerCase();
  const winnerId = match?.winnerId || null;
  const decided = !!winnerId && (status.includes("valid") || status.includes("wo"));
  if(!decided) return `<span class="p-name">${esc(name)}</span>`;
  const cls = (userId === winnerId) ? "p-name win" : "p-name lose";
  return `<span class="${cls}">${esc(name)}</span>`;
}


  function ensureCascadeByes(eventId, matches){
    // Resolve BYEs em cascata, mas SOMENTE quando o lado ausente é
    // definitivamente vazio (ou seja: vem de um feeder com status "Vazio").
    // Isso evita avançar indevidamente quando o oponente ainda depende de um jogo real pendente.
    const evMatches = matches.filter(m => m.eventId === eventId);

    // Mapear feeders: para cada match alvo, qual match alimenta slot A/B
    const feederByTarget = new Map(); // targetId -> {A: feederMatch, B: feederMatch}
    for(const fm of evMatches){
      if(!fm.nextMatchId || !fm.nextSlot) continue;
      if(!feederByTarget.has(fm.nextMatchId)) feederByTarget.set(fm.nextMatchId, {});
      feederByTarget.get(fm.nextMatchId)[fm.nextSlot] = fm;
    }

    const isDefEmptySide = (targetMatch, slot) => {
      // Se já tem participante, não é vazio.
      if(slot === "A"){
        if(!!targetMatch.participantAId) return false;
      } else {
        if(!!targetMatch.participantBId) return false;
      }
      const feeders = feederByTarget.get(targetMatch.id) || {};
      const feeder = feeders[slot];
      // Só é "definitivamente vazio" se existir feeder e ele for Vazio (quadrante vazio).
      return !!feeder && String(feeder.status||"").toLowerCase() === "vazio";
    };

    let changed = true;
    while(changed){
      changed = false;

      for(const m of evMatches){
        if(m.winnerId) continue;

        const hasA = !!m.participantAId;
        const hasB = !!m.participantBId;

        const emptyA = isDefEmptySide(m, "A");
        const emptyB = isDefEmptySide(m, "B");

        // Se ambos lados são definitivamente vazios, marca Vazio
        if(!hasA && !hasB && emptyA && emptyB && m.status !== "Vazio"){
          m.status = "Vazio";
          m.updatedAt = nowISO();
          changed = true;
          continue;
        }

        // BYE apenas quando um lado tem jogador e o outro é definitivamente vazio
        if(hasA && !hasB && emptyB){
          m.status = "BYE";
          m.winnerId = m.participantAId;
          m.winnerSeed = m.seedA ?? null;
          m.validatedAt = nowISO();
          m.updatedAt = nowISO();
          propagateWinner(matches, m);
          changed = true;
          continue;
        }

        if(!hasA && hasB && emptyA){
          m.status = "BYE";
          m.winnerId = m.participantBId;
          m.winnerSeed = m.seedB ?? null;
          m.validatedAt = nowISO();
          m.updatedAt = nowISO();
          propagateWinner(matches, m);
          changed = true;
          continue;
        }
      }
    }
  }


  
  // ---------- Pós-evento (fechamento automático) ----------
  function isValidatedStatus(st){
    const s = String(st||"").toLowerCase();
    return s.includes("valid") || s === "wo";
  }

  function eventHasStarted(eventId){
    const ms = loadMatches().filter(m=>m.eventId===eventId);
    return ms.some(m=>isValidatedStatus(m.status));
  }

  function markEventStarted(eventId){
    const events = loadEvents();
    const idx = events.findIndex(e=>e.id===eventId);
    if(idx < 0) return null;
    const ev = events[idx];

    if(!ev.startedAt){
      if(eventHasStarted(eventId)){
        ev.startedAt = nowISO();
        ev.locked = true;
        ev.updatedAt = nowISO();
        events[idx] = ev;
        saveEvents(events);
      }
    } else if(!ev.locked){
      ev.locked = true;
      ev.updatedAt = nowISO();
      events[idx] = ev;
      saveEvents(events);
    }
    return ev;
  }

  function computeStandingsSingleElim(ev, matches){
    // Apenas matches com 2 participantes e decididos (Validada/WO/BYE com winnerId)
    const ms = matches
      .filter(m=>m.eventId===ev.id)
      .filter(m=>m.participantAId && m.participantBId)
      .filter(m=>m.winnerId && isValidatedStatus(m.status));

    const elimRound = new Map(); // participantId -> roundNumber (2,4,8,16...)
    const elimSeed  = new Map(); // participantId -> seed (para ordenar dentro do range)
    const addElim = (pid, roundNum, seed)=>{
      if(!pid) return;
      if(!elimRound.has(pid) || roundNum < elimRound.get(pid)){
        elimRound.set(pid, roundNum);
        if(seed != null) elimSeed.set(pid, seed);
      }
    };

    const roundNum = (r)=>{
      const m = String(r||"").match(/R(\d+)/);
      return m ? Number(m[1]) : 999;
    };

    for(const m of ms){
      const rn = roundNum(m.round);
      const loserId = (m.winnerId === m.participantAId) ? m.participantBId : m.participantAId;
      const loserSeed = (m.winnerId === m.participantAId) ? (m.seedB ?? null) : (m.seedA ?? null);
      addElim(loserId, rn, loserSeed);
    }

    // coletar participantes do evento (aprovados + quem apareceu nos matches)
    const regs = loadRegs().filter(r=>r.eventId===ev.id && String(r.status||"").toLowerCase().includes("aprov"));
    const participants = new Set(regs.map(r=>r.userId).filter(Boolean));
    for(const m of matches.filter(x=>x.eventId===ev.id)){
      if(m.participantAId) participants.add(m.participantAId);
      if(m.participantBId) participants.add(m.participantBId);
    }

    // campeão/vice pela final (R2)
    const final = matches
      .filter(m=>m.eventId===ev.id && m.round==="R2")
      .slice()
      .sort((a,b)=>(a.index||0)-(b.index||0))[0] || null;

    const out = [];
    const used = new Set();

    if(final && final.winnerId && isValidatedStatus(final.status) && final.participantAId && final.participantBId){
      const champ = final.winnerId;
      const vice = (champ === final.participantAId) ? final.participantBId : final.participantAId;

      const champSeed = (champ === final.participantAId) ? (final.seedA ?? null) : (final.seedB ?? null);
      const viceSeed  = (vice  === final.participantAId) ? (final.seedA ?? null) : (final.seedB ?? null);

      out.push({ participantId: champ, position: 1, seed: champSeed });
      out.push({ participantId: vice,  position: 2, seed: viceSeed  });

      used.add(champ); used.add(vice);
    }

    // grupos por round que perdeu
    const byRound = new Map(); // rn -> [{id,seed}]
    for(const pid of participants){
      if(used.has(pid)) continue;
      const rn = elimRound.get(pid); // pode ser undefined (não perdeu ainda, mas isso só acontece se final não validada)
      if(!rn) continue;
      if(!byRound.has(rn)) byRound.set(rn, []);
      byRound.get(rn).push({ participantId: pid, seed: elimSeed.get(pid) ?? null });
    }

    const rounds = Array.from(byRound.keys()).sort((a,b)=>a-b); // 4,8,16...
    for(const rn of rounds){
      const list = byRound.get(rn) || [];
      // range: rn==4 => 3-4; rn==8 => 5-8; rn==16 => 9-16; rn==32 => 17-32; rn==64 => 33-64
      const startPos = (rn/2) + 1; // 4->3, 8->5, 16->9
      // ordena por seed asc (menor seed = melhor) e fallback por nome
      list.sort((a,b)=>{
        const sa = (a.seed==null)? 9999 : a.seed;
        const sb = (b.seed==null)? 9999 : b.seed;
        const d = sa - sb;
        if(d!==0) return d;
        const na = userLabelById(a.participantId).toLowerCase();
        const nb = userLabelById(b.participantId).toLowerCase();
        return na.localeCompare(nb);
      });
      for(let i=0;i<list.length;i++){
        out.push({ participantId: list[i].participantId, position: startPos + i, seed: list[i].seed });
        used.add(list[i].participantId);
      }
    }

    // ordenar por posição
    out.sort((a,b)=>a.position-b.position);
    return out;
  }

  function applyEventPointsAndPrizes(ev, standings){
    const points = ev.pointsTable || {};
    const prizes = ev.prizeTable || {};
    return standings.map(row=>{
      const pos = row.position;
      const pts = Number(points[pos] ?? 0) || 0;
      const prize = Number(prizes[pos] ?? 0) || 0;
      return { ...row, points: pts, prize: prize };
    });
  }

  function finalizeEventIfFinal(evId, finalMatch, matches){
    const events = loadEvents();
    const idx = events.findIndex(e=>e.id===evId);
    if(idx < 0) return null;
    const ev = events[idx];

    // já concluído
    if(String(ev.status||"").toLowerCase().includes("concl")) return ev;

    // precisa ser final decidida
    if(!finalMatch || finalMatch.round !== "R2") return null;
    if(!finalMatch.winnerId || !isValidatedStatus(finalMatch.status)) return null;
    if(!finalMatch.participantAId || !finalMatch.participantBId) return null;

    const base = computeStandingsSingleElim(ev, matches);
    const enriched = applyEventPointsAndPrizes(ev, base);

// atualizar usuários (pontos)
const users = loadUsers();
const uMap = new Map(users.map(u=>[u.id,u]));
for(const row of enriched){
  const pts = Number(row.points || 0) || 0;
  if(!pts) continue;

  // tenta mapear para inscrição (times/individuais)
  const reg = getRegById(ev.id, row.participantId);

  // 2v2/3v3: pontos para cada membro (se houver memberIds); senão, tenta userId
  if(reg && Array.isArray(reg.memberIds) && reg.memberIds.length){
    for(const mid of reg.memberIds){
      const u = uMap.get(mid);
      if(!u) continue;
      u.points = Number(u.points || 0) + pts;
      u.updatedAt = nowISO();
    }
    continue;
  }
  if(reg && reg.userId){
    const u = uMap.get(reg.userId);
    if(u){
      u.points = Number(u.points || 0) + pts;
      u.updatedAt = nowISO();
    }
    continue;
  }

  // fallback: assume participantId é userId
  const u = uMap.get(row.participantId);
  if(u){
    u.points = Number(u.points || 0) + pts;
    u.updatedAt = nowISO();
  }
}
saveUsers(Array.from(uMap.values()));

// payouts
const payouts = [];
for(const r of enriched){
  const prize = Number(r.prize||0) || 0;
  if(prize <= 0) continue;

  const reg = getRegById(ev.id, r.participantId);
  const split = !!ev.splitTeamsEqually;

  if(reg && reg.teamName && split && Array.isArray(reg.memberIds) && reg.memberIds.length){
    const each = Math.round((prize / reg.memberIds.length) * 100) / 100;
    for(const mid of reg.memberIds){
      payouts.push({
        participantId: mid,
        name: userLabelById(mid),
        amount: each,
        fromTeam: reg.teamName,
      });
    }
  }else if(reg && reg.userId){
    payouts.push({
      participantId: reg.userId,
      name: userLabelById(reg.userId),
      amount: prize,
      fromTeam: reg.teamName || null,
    });
  }else{
    payouts.push({
      participantId: r.participantId,
      name: participantLabel(ev.id, r.participantId),
      amount: prize,
      fromTeam: reg?.teamName || null,
    });
  }
}


    ev.results = {
      finalizedAt: nowISO(),
      standings: enriched,
      payouts,
    };
    ev.status = "Concluído";
    ev.completedAt = nowISO();
    ev.locked = true;
    ev.updatedAt = nowISO();

    events[idx] = ev;
    saveEvents(events);
    return ev;
  }

  
  function standingsToCSV(ev){
    const res = ev?.results;
    if(!res || !Array.isArray(res.standings)) return "";
    const header = ["pos","jogador","seed","pontos","premiacao"].join(";");
    const lines = res.standings
      .slice()
      .sort((a,b)=>a.position-b.position)
      .map(r=>{
        const name = participantLabel(ev.id, r.participantId);
        const row = [
          r.position ?? "",
          String(name||"").replaceAll(";", ","),
          r.seed ?? "",
          r.points ?? 0,
          r.prize ?? 0,
        ];
        return row.join(";");
      });
    return [header, ...lines].join("\n");
  }

  function toast(msg){
    try{
      let t = document.getElementById('lbiToast');
      if(!t){
        t = document.createElement('div');
        t.id = 'lbiToast';
        t.style.position = 'fixed';
        t.style.right = '16px';
        t.style.bottom = '16px';
        t.style.zIndex = '99999';
        t.style.padding = '10px 12px';
        t.style.borderRadius = '10px';
        t.style.background = 'rgba(0,0,0,.75)';
        t.style.border = '1px solid rgba(255,255,255,.15)';
        t.style.color = '#fff';
        t.style.fontSize = '13px';
        t.style.maxWidth = '60vw';
        t.style.backdropFilter = 'blur(8px)';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.display = 'block';
      clearTimeout(window.__lbiToastTimer);
      window.__lbiToastTimer = setTimeout(()=>{ t.style.display='none'; }, 1800);
    }catch(e){
      alert(msg);
    }
  }

  async function copyTextToClipboard(text){
    try{
      await navigator.clipboard.writeText(text);
      toast("Copiado!");
      return true;
    }catch(e){
      // fallback
      try{
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast("Copiado!");
        return true;
      }catch(err){
        alert("Não foi possível copiar automaticamente.\n\n" + text);
        return false;
      }
    }
  }

  function reopenEventRollback(evId){
    const events = loadEvents();
    const idx = events.findIndex(e=>e.id===evId);
    if(idx<0) return null;
    const ev = events[idx];
    if(!ev.results || !Array.isArray(ev.results.standings)) return ev;

// rollback pontos
const standings = ev.results.standings;
const users = loadUsers();
const uMap = new Map(users.map(u=>[u.id,u]));
for(const row of standings){
  const pts = Number(row.points||0) || 0;
  if(!pts) continue;

  const reg = getRegById(ev.id, row.participantId);

  if(reg && Array.isArray(reg.memberIds) && reg.memberIds.length){
    for(const mid of reg.memberIds){
      const u = uMap.get(mid);
      if(!u) continue;
      u.points = Number(u.points||0) - pts;
      if(u.points < 0) u.points = 0;
      u.updatedAt = nowISO();
    }
    continue;
  }
  if(reg && reg.userId){
    const u = uMap.get(reg.userId);
    if(u){
      u.points = Number(u.points||0) - pts;
      if(u.points < 0) u.points = 0;
      u.updatedAt = nowISO();
    }
    continue;
  }

  const u = uMap.get(row.participantId);
  if(!u) continue;
  u.points = Number(u.points||0) - pts;
  if(u.points < 0) u.points = 0;
  u.updatedAt = nowISO();
}
saveUsers(Array.from(uMap.values()));


    // limpar resultados e reabrir
    delete ev.results;
    ev.status = "Em andamento";
    ev.completedAt = null;
    ev.updatedAt = nowISO();
    ev.locked = true; // continua travado (evento já começou)
    events[idx] = ev;
    saveEvents(events);
    return ev;
  }

function openResSummaryModal(ev){
    const btnCsv = document.getElementById("resSummaryCopyCSV");
    const btnReopen = document.getElementById("resSummaryReopen");
    const evId = ev?.id || "";
    if(btnCsv){
      btnCsv.onclick = async ()=>{
        const csv = standingsToCSV(ev);
        if(!csv){ toast("Sem dados para exportar."); return; }
        await copyTextToClipboard(csv);
      };
    }
    if(btnReopen){
      btnReopen.style.display = (ev?.results && evId) ? "inline-flex" : "none";
      btnReopen.onclick = ()=>{
        if(!evId) return;
        if(!confirm("Reabrir o evento?\n\nIsso vai remover o resumo final e DESFAZER os pontos aplicados aos jogadores. Não altera os resultados das partidas.")) return;
        const newEv = reopenEventRollback(evId);
        if(newEv){
          toast("Evento reaberto.");
          // re-render resultados se estiver na página
          try{ renderApp(); }catch(e){}
        }
      };
    }
    const modal = document.getElementById("resSummaryModal");
    const close = document.getElementById("resSummaryClose");
    const body = document.getElementById("resSummaryBody");
    const title = document.getElementById("resSummaryTitle");
    if(!modal || !body) return;

    const res = ev?.results;
    title.textContent = ev?.title ? `Resumo final — ${ev.title}` : "Resumo final";
    if(!res || !res.standings || !res.standings.length){
      body.innerHTML = `<div class="muted">Este evento ainda não foi concluído.</div>`;
    } else {
      const rows = res.standings.slice().sort((a,b)=>a.position-b.position).map(r=>{
        return `<tr>
          <td style="padding:8px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(r.position)}</td>
          <td style="padding:8px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(userLabelById(r.participantId))}</td>
          <td style="padding:8px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(r.seed ?? "")}</td>
          <td style="padding:8px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(r.points ?? 0)}</td>
          <td style="padding:8px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(r.prize ?? 0)}</td>
        </tr>`;
      }).join("");
      body.innerHTML = `
        <div class="muted small" style="margin-bottom:10px;">Finalizado em: ${esc(res.finalizedAt || "")}</div>
        <div style="overflow:auto; max-height:60vh;">
          <table style="width:100%; border-collapse:collapse; min-width:680px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.10);">Pos</th>
                <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.10);">Jogador</th>
                <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.10);">Seed</th>
                <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.10);">Pontos</th>
                <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.10);">Premiação</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    modal.style.display = "block";
    const closer = ()=>{ modal.style.display = "none"; };
    if(close) close.onclick = closer;
    modal.onclick = (e)=>{ if(e.target === modal) closer(); };
  }


function renderAdminResultados(){
    const events = loadEvents().slice().sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
    const eventOptions = events.map(e=>`<option value="${esc(e.id)}">${esc(e.title||"(sem título)")}</option>`).join("");

    return `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-h">
          <div>
            <div class="kicker">Resultados</div>
            <h3 class="h1like" style="margin:0;">Lançamento + Validação</h3>
          </div>
          <span class="p-pill">Admin</span>
        </div>

        <div class="card-b">
          <div class="row">
            <div class="field">
              <label>Evento</label>
              <select class="select" id="resEvent">
                <option value="">Selecione...</option>
                ${eventOptions}
              </select>
              <div class="muted small">Mostra partidas geradas em <code>lbi_matches</code>.</div>
            </div>

            <div class="field">
              <label>Fase</label>
              <select class="select" id="resRound">
                <option value="">Todas</option>
                <option value="R64">R64</option>
                <option value="R32">R32</option>
                <option value="R16">R16</option>
                <option value="R8">R8</option>
                <option value="R4">R4</option>
                <option value="R2">R2</option>
              </select>
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>Buscar</label>
              <input class="input" id="resSearch" placeholder="código (R32-01), nome, login..." />
            </div>

            <div class="field" style="display:flex; align-items:flex-end; gap:10px;">
              <button class="btn2" id="btnResRefresh">Atualizar</button>
              <button class="btn2" id="btnResResolveByes">Resolver BYEs</button>
              <button class="btn2" id="btnResSummary" title="Mostra pontos/premiação e colocação final quando o evento estiver concluído.">Resumo final</button>
            </div>
          </div>

          <div class="muted small" id="resMsg"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-h">
          <div>
            <div class="kicker">Lista</div>
            <h3 class="h1like" style="margin:0;">Partidas</h3>
          </div>
        </div>
        <div class="card-b" style="overflow:auto;">
          <table style="width:100%; border-collapse:collapse; min-width: 1100px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Fase</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Código</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">A</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">B</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Quando</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">MD</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Placar</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Status</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.10);">Ações</th>
              </tr>
            </thead>
            <tbody id="resTbody">
              <tr><td colspan="9" class="muted" style="padding:10px;">Selecione um evento.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal editar partida -->
      <div id="matchModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9999; padding:24px;">
        <div class="card" style="max-width:920px; margin:0 auto;">
          <div class="card-h">
            <div>
              <div class="kicker">Editar</div>
              <h3 class="h1like" style="margin:0;">Partida</h3>
            </div>
            <button class="btn2" id="matchModalClose">Fechar</button>
          </div>

          <div class="card-b">
            <input type="hidden" id="mId"/>

            <div class="row">
              <div class="field">
                <label>Quando (São Paulo)</label>
                <input class="input" id="mWhen" type="datetime-local"/>
              </div>
              <div class="field">
                <label>MD</label>
                <select class="select" id="mMd">
                  <option>MD1</option>
                  <option>MD3</option>
                  <option>MD5</option>
                  <option>MD7</option>
                  <option>MD9</option>
                </select>
              </div>
            </div>

            <div class="row">
              <div class="field">
                <label>Placar A</label>
                <input class="input" id="mScoreA" inputmode="numeric" />
              </div>
              <div class="field">
                <label>Placar B</label>
                <input class="input" id="mScoreB" inputmode="numeric" />
              </div>
              <div class="field">
                <label>WO</label>
                <select class="select" id="mWO">
                  <option value="">Nenhum</option>
                  <option value="A">WO para A (B vence)</option>
                  <option value="B">WO para B (A vence)</option>
                </select>
              </div>
            </div>

            <div class="row">
              <div class="field">
                <label>Seed (1 a 64)</label>
                <input class="input" id="regEditSeed" placeholder="Ex: 1" />
              </div>
              <div class="field">
                <label>Status</label>
                <select class="select" id="mStatus">
                  <option>Não agendada</option>
                  <option>Agendada</option>
                  <option>Em andamento</option>
                  <option>Aguardando validação</option>
                  <option>Validada</option>
                  <option>WO</option>
                  <option>BYE</option>
                </select>
              </div>
              <div class="field">
                <label>Vencedor (somente leitura)</label>
                <input class="input" id="mWinner" disabled />
              </div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
              <button class="btn2" id="btnMatchSave">Salvar</button>
              <button class="btn2 primary" id="btnMatchValidate">Validar</button>
              <button class="btn2" id="btnMatchReactivate">Reativar (limpar resultado)</button>
              <span class="muted small" id="matchMsg"></span>
            </div>
          </div>
        </div>
      </div>
    
      <!-- Resumo final -->
      <div id="resSummaryModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9999; padding:24px;">
        <div class="card" style="max-width:920px; margin:0 auto;">
          <div class="card-h">
            <div>
              <div class="kicker">Evento</div>
              <h3 class="h1like" id="resSummaryTitle" style="margin:0;">Resumo final</h3>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <button class="btn2" id="resSummaryCopyCSV">Copiar CSV</button>
              <button class="btn2" id="resSummaryReopen" style="border-color: rgba(255,90,90,.6);">Reabrir</button>
              <button class="btn2" id="resSummaryClose">Fechar</button>
            </div>
          </div>
          <div class="card-b" id="resSummaryBody"></div>
        </div>
      </div>
`;
  }
// ---------- Boot: Login ----------
  function bootLoginPage() {
    ensureSeed();

    const elLogin = document.getElementById("login");
    const elSenha = document.getElementById("senha");
    const elMsg = document.getElementById("msg");

    const last = localStorage.getItem(LS_LAST);
    if (last) elLogin.value = last;

    document.getElementById("btnLogin").addEventListener("click", () => {
      elMsg.textContent = "";
      const login = (elLogin.value || "").trim();
      const pass = (elSenha.value || "").trim();

      if (!login || !pass) {
        elMsg.textContent = "Informe login e senha.";
        return;
      }

      const user = findUserByLogin(login);
      if (!user || user.password !== pass) {
        elMsg.textContent = "Login ou senha inválidos.";
        return;
      }

      localStorage.setItem(LS_LAST, login);
      setSession(user);
      location.href = "./app.html";
    });

    document.getElementById("btnCriar").addEventListener("click", () => {
      elMsg.textContent = "";
      const login = (elLogin.value || "").trim();
      const pass = (elSenha.value || "").trim();

      if (login.length < 3) {
        elMsg.textContent = "Use um login com pelo menos 3 caracteres.";
        return;
      }
      if (pass.length < 4) {
        elMsg.textContent = "Use uma senha com pelo menos 4 caracteres.";
        return;
      }
      if (findUserByLogin(login)) {
        elMsg.textContent = "Esse login já existe.";
        return;
      }

      const users = loadUsers();
      const user = {
        id: crypto.randomUUID(),
        login,
        password: pass,
        accessLevel: "user",
        points: 0,
        profile: { completed: false },
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      users.push(user);
      saveUsers(users);

      localStorage.setItem(LS_LAST, login);
      setSession(user);
      location.href = "./app.html";
    });
  }

  // ---------- Boot: App ----------
  function bootAppPage() {
    ensureSeed();

    const sess = getSession();
    if (!sess) {
      location.replace("./login.html");
      return;
    }

    const user = loadUsers().find((u) => u.id === sess.userId);
    if (!user) {
      clearSession();
      location.replace("./login.html");
      return;
    }

    const top = document.getElementById("topUserBox");
    const displayName = (user.profile?.nickname || user.profile?.fullName || user.login);

    // Link para bracket (usado no menu lateral)
    const lastEv = getLastEventId();
    const bracketHref = lastEv
      ? `./bracket.html?eventId=${encodeURIComponent(lastEv)}`
      : `./bracket.html`;

    if (user.accessLevel === "admin") {
      top.innerHTML = `
        <span class="p-pill">${esc(displayName)}</span>
        <button class="btn2" id="btnSair">Sair</button>
      `;
    } else {
      top.innerHTML = `
        <span class="p-pill">${esc(displayName)}</span>
        <span class="p-pill">Pontos: <strong>${Number(user.points || 0)}</strong></span>
        <button class="btn2" id="btnSair">Sair</button>
      `;
    }

    document.getElementById("btnSair").addEventListener("click", () => {
      clearSession();
      location.href = "./login.html";
    });

    const userSidebar = document.getElementById("userSidebar");
    const adminSidebar = document.getElementById("adminSidebar");
    const viewRoot = document.getElementById("viewRoot");
    const viewTitle = document.getElementById("viewTitle");
    const viewKicker = document.getElementById("viewKicker");
    const viewBadge = document.getElementById("viewBadge");

    
// ---------- Bracket link (menu lateral) ----------
function ensureBracketNav() {
  // USER sidebar
  const sideNav = userSidebar?.querySelector(".side-nav");
  if (sideNav && !sideNav.querySelector('[data-view="bracket"]')) {
    const item = document.createElement("div");
    item.className = "side-item";
    item.setAttribute("data-view", "bracket");
    item.innerHTML = `<span>Bracket</span><span class="notify-dot"></span>`;
    sideNav.appendChild(item);
  }

  // ADMIN sidebar (icon grid)
  const iconGrid = adminSidebar?.querySelector(".icon-grid");
  if (iconGrid && !iconGrid.querySelector('[data-admin="bracket"]')) {
    const tile = document.createElement("div");
    tile.className = "icon-tile";
    tile.setAttribute("data-admin", "bracket");
    tile.innerHTML = `
      <div>
        <div class="icon-title">Bracket</div>
        <div class="muted small">visualizar chave pública</div>
      </div>
      <span class="notify-dot"></span>
    `;
    iconGrid.appendChild(tile);
  }
}

ensureBracketNav();

// ---------- Draft templates link (menu lateral ADMIN) ----------
function ensureDraftTemplatesNav() {
  const iconGrid = adminSidebar?.querySelector(".icon-grid");
  if (iconGrid && !iconGrid.querySelector('[data-admin="draft-templates"]')) {
    const tile = document.createElement("div");
    tile.className = "icon-tile";
    tile.setAttribute("data-admin", "draft-templates");
    tile.innerHTML = `
      <div>
        <div class="icon-title">Templates Draft</div>
        <div class="muted small">configurar mapa + civil</div>
      </div>
      <span class="notify-dot"></span>
    `;
    iconGrid.appendChild(tile);
  }
}

ensureDraftTemplatesNav();

    // ---------- User routing ----------
    function setViewUser(key) {
      if (key === "bracket") {
        window.open(bracketHref, "_blank", "noopener");
        return;
      }

      userSidebar.querySelectorAll(".side-item").forEach((it) => {
        it.classList.toggle("active", it.getAttribute("data-view") === key);
      });

      viewKicker.textContent = "Painel do Usuário";
      viewBadge.textContent = "User";

      if (key === "meus-dados") {
        viewTitle.textContent = "Meus Dados";
        viewRoot.innerHTML = renderMeusDados(user);

        const minorBox = document.getElementById("minorBox");
        const birth = document.getElementById("birthDate");

        function calcIsMinor() {
          const v = birth.value;
          if (!v) return false;
          const dob = new Date(v + "T00:00:00");
          const now = new Date();
          let age = now.getFullYear() - dob.getFullYear();
          const m = now.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
          return age < 18;
        }

        function paintMinor() {
          if (calcIsMinor()) {
            minorBox.innerHTML = `
              <div class="field">
                <label>Autorização do responsável (obrigatório se menor de idade)</label>
                <input class="input" id="minorAuth" type="file" />
                <div class="muted small">Neste MVP, o arquivo não é enviado (vamos implementar no back-end depois).</div>
              </div>
            `;
          } else {
            minorBox.innerHTML = "";
          }
        }

        birth.addEventListener("change", paintMinor);
        paintMinor();

        document.getElementById("saveProfile").addEventListener("click", () => {
          const fullName = (document.getElementById("fullName").value || "").trim();
          const nickname = (document.getElementById("nickname")?.value || "").trim();
          const birthDate = (document.getElementById("birthDate").value || "").trim();
          const cpf = (document.getElementById("cpf").value || "").replace(/\D/g, "");
          const email = (document.getElementById("email").value || "").trim();
          const whatsapp = (document.getElementById("whatsapp").value || "").trim();
          const discord = (document.getElementById("discord").value || "").trim();
          const aoe4Main = (document.getElementById("aoe4Main").value || "").trim();
          const aoe4Smurfs = (document.getElementById("aoe4Smurfs").value || "").trim();
          const pixKey = (document.getElementById("pixKey").value || "").trim();

          const msg = document.getElementById("profileMsg");

          if (!fullName || !nickname || !birthDate || !cpf || !aoe4Main || !pixKey) {
            msg.textContent = "Preencha todos os campos obrigatórios (*).";
            return;
          }
          if (cpf.length !== 11) {
            msg.textContent = "CPF inválido (precisa ter 11 dígitos).";
            return;
          }

          const updated = updateUser(user.id, {
            profile: {
              ...user.profile,
              completed: true,
              fullName,
              birthDate,
              cpf,
              email,
              whatsapp,
              discord,
              aoe4Main,
              aoe4Smurfs,
              pixKey,
            },
          });

          user.profile = updated.profile;
          msg.textContent = "Dados salvos com sucesso.";
        });

      } else if (key === "inscricoes") {
        viewTitle.textContent = "Inscrições";
        viewRoot.innerHTML = renderInscricoes(user);

        viewRoot.querySelectorAll("[data-ev-join]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const eventId = btn.getAttribute("data-ev-join");
            const cb = document.getElementById(`agree_${eventId}`);

            const msg = document.createElement("div");
            msg.className = "muted small";
            msg.style.marginTop = "8px";
            btn.parentElement.appendChild(msg);

            if (!cb || !cb.checked) {
              msg.textContent =
                "Você precisa marcar que concorda com regras/termos para se inscrever.";
              return;
            }

            const regs = loadRegs();
            const exists = regs.some(
              (r) => r.userId === user.id && r.eventId === eventId
            );
            if (exists) {
              msg.textContent = "Você já está inscrito.";
              return;
            }

            
const ev = loadEvents().find((x) => x.id === eventId);
const type = String(ev?.type || "1v1");
const t = type.toLowerCase().trim();
const teamSize = (t === "2v2") ? 2 : (t === "3v3") ? 3 : 1;

let teamName = "";
let memberIds = null;

if (teamSize > 1) {
  teamName = (document.getElementById(`teamName_${eventId}`)?.value || "").trim();
  const mates = [];
  for (let i = 0; i < teamSize - 1; i++) {
    const v = (document.getElementById(`teamMate_${eventId}_${i}`)?.value || "").trim();
    if (v) mates.push(v);
  }

  // validações básicas
  if (!teamName) {
    msg.textContent = "Informe o nome do time.";
    return;
  }
  if (mates.length !== teamSize - 1) {
    msg.textContent = `Selecione ${teamSize - 1} parceiro(s) para este evento.`;
    return;
  }
  const all = [user.id, ...mates];
  const uniq = new Set(all);
  if (uniq.size !== all.length) {
    msg.textContent = "Parceiros repetidos não são permitidos.";
    return;
  }

  memberIds = all;
}

regs.push({
  id: crypto.randomUUID(),
  userId: user.id,               // capitão (compatibilidade)
  eventId,
  status: "Pendente",
  agreedAt: nowISO(),
  seed: null,
  teamName: teamSize > 1 ? teamName : "",
  memberIds: teamSize > 1 ? memberIds : null, // inclui capitão
  createdAt: nowISO(),
  updatedAt: nowISO(),
});
            saveRegs(regs);
            msg.textContent = "Inscrição enviada! (status: Pendente)";
            setViewUser("inscricoes");
          });
        });

      } else if (key === "resultados") {
        viewTitle.textContent = "Resultados";
        viewRoot.innerHTML = renderResultados();

      } else if (key === "partidas") {
  viewTitle.textContent = "Partidas Disponíveis";
  viewRoot.innerHTML = renderPartidas(user);

  const selEvent = document.getElementById("uMatchEvent");
  const selStatus = document.getElementById("uMatchStatus");
  const inpSearch = document.getElementById("uMatchSearch");
  const chkShowAll = document.getElementById("uMatchShowAll");
  const btnRefresh = document.getElementById("uMatchRefresh");
  const tbody = document.getElementById("uMatchTbody");
  const msg = document.getElementById("uMatchMsg");

  // Modal matchroom
  const roomModal = document.getElementById("uRoomModal");
  const roomClose = document.getElementById("uRoomClose");
  const roomTitle = document.getElementById("uRoomTitle");
  const roomInfo = document.getElementById("uRoomInfo");
  const roomDraftLink = document.getElementById("uRoomDraftLink");
  const roomSeriesHint = document.getElementById("uRoomSeriesHint");
  const roomGames = document.getElementById("uRoomGames");
  const roomAutoScore = document.getElementById("uRoomAutoScore");
  const roomClear = document.getElementById("uRoomClear");
  const roomSave = document.getElementById("uRoomSave");
  const roomMsg = document.getElementById("uRoomMsg");

  function mdToMaxGames(md){
    const s = String(md||"").toUpperCase().trim();
    const n = Number(s.replace(/[^0-9]/g, ""));
    if([1,3,5,7].includes(n)) return n;
    // fallback
    return 3;
  }

  function needWinsFor(maxGames){
    return Math.floor(maxGames/2) + 1;
  }

  function scoreFromReportedGames(arr){
    let a = 0, b = 0;
    for(const w of (arr||[])){
      if(w === 'A') a++;
      if(w === 'B') b++;
    }
    return {a,b};
  }

  function closeRoom(){
    roomModal.style.display = "none";
  }
  roomClose.addEventListener("click", closeRoom);
  roomModal.addEventListener("click", (e)=>{ if(e.target === roomModal) closeRoom(); });

  function parseWhen(iso){
    if(!iso) return null;
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())) return null;
    return d;
  }
  function fmtWhen(iso){
    if(!iso) return "—";
    const d = parseWhen(iso);
    if(!d) return "—";
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  function fmtWindow(iso){
    const d = parseWhen(iso);
    if(!d) return "—";
    const open = new Date(d.getTime() - 10*60*1000);
    const close = new Date(d.getTime() + 15*60*1000);
    const f = (x)=> x.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit", timeZone:"America/Sao_Paulo" });
    return `${f(open)}–${f(close)}`;
  }

  function isMine(m){
    return m.participantAId === user.id || m.participantBId === user.id;
  }
  function sideOf(m){
    return (m.participantAId === user.id) ? "A" : (m.participantBId === user.id ? "B" : "");
  }
  function opponentId(m){
    const side = sideOf(m);
    if(side === "A") return m.participantBId || null;
    if(side === "B") return m.participantAId || null;
    return null;
  }
  function safeName(uid){
    if(!uid) return "—";
    const u = loadUsers().find(x=>x.id===uid);
    return u?.profile?.fullName || u?.login || "—";
  }

  function nowMs(){ return Date.now(); }

  function checkinOpenFor(m){
    const d = parseWhen(m.scheduledAt);
    if(!d) return false;
    const t = d.getTime();
    const now = nowMs();
    return now >= (t - 10*60*1000) && now <= (t + 15*60*1000);
  }

  function checkinExpiredFor(m){
    const d = parseWhen(m.scheduledAt);
    if(!d) return false;
    return nowMs() > (d.getTime() + 15*60*1000);
  }

  function statusBucket(m){
    const s = (m.status || "").toLowerCase();
    if(s.includes("valid") || s.includes("wo") || s.includes("bye")) return "done";
    // se já tem reporte do user mas não validou
    if(m.reportedAt && !m.validatedAt) return "pending";
    if(checkinOpenFor(m) && !(s.includes("valid")||s.includes("wo")||s.includes("bye"))) return "checkin";
    return "upcoming";
  }

  function sortMatches(list){
    const order = { R64: 1, R32: 2, R16: 3, R8: 4, R4: 5, R2: 6 };
    return list.slice().sort((a,b)=>{
      const oa = order[a.round] || 99;
      const ob = order[b.round] || 99;
      if(oa !== ob) return oa - ob;
      const ca = (a.code || "").localeCompare(b.code || "");
      if(ca !== 0) return ca;
      return String(a.id||"").localeCompare(String(b.id||""));
    });
  }

  // Por padrão, o usuário deve ver só a "partida atual" (evita mostrar rounds futuros preenchidos por BYE)
  function pickCurrentMatches(list){
    const alive = list.filter(m=>{
      const s = String(m.status||"").toLowerCase();
      if(m.winnerId) return false;
      if(s.includes("valid") || s.includes("wo") || s.includes("bye")) return false;
      // precisa ter os dois participantes para ser uma partida real
      if(!m.participantAId || !m.participantBId) return false;
      return true;
    });
    if(!alive.length) return [];
    const rank = (r)=> ({R64:64,R32:32,R16:16,R8:8,R4:4,R2:2}[r] ?? 0);
    // "fase atual" é a maior (R32 > R16 > R8...)
    const maxRank = Math.max(...alive.map(m=>rank(m.round)));
    return alive.filter(m=>rank(m.round)===maxRank);
  }

  function applyAutoWO(){
    const all = loadMatches();
    let changed = 0;

    for(const m of all){
      if(!m || m.eventId == null) continue;
      if(!isMine(m)) continue;
      const st = (m.status || "").toLowerCase();
      if(st.includes("valid") || st.includes("wo") || st.includes("bye")) continue;
      if(!m.scheduledAt) continue;

      if(checkinExpiredFor(m) && !m.winnerId){
        const aIn = !!m.checkinAAt;
        const bIn = !!m.checkinBAt;

        if(aIn && !bIn){
          m.status = "WO";
          m.winnerId = m.participantAId || null;
          m.winnerSeed = m.seedA ?? null;
          m.validatedAt = nowISO();
          m.updatedAt = nowISO();
          propagateWinner(all, m);
          changed++;
        } else if(!aIn && bIn){
          m.status = "WO";
          m.winnerId = m.participantBId || null;
          m.winnerSeed = m.seedB ?? null;
          m.validatedAt = nowISO();
          m.updatedAt = nowISO();
          propagateWinner(all, m);
          changed++;
        } else {
          // ninguém fez check-in: marca WO sem vencedor (admin pode reagendar/definir)
          m.status = "WO";
          m.woNoShow = true;
          m.updatedAt = nowISO();
          changed++;
        }
      }
    }

    if(changed){
      // cascata de BYEs por evento afetado
      const touchedEvents = new Set(all.filter(m=>m && isMine(m) && (m.status==="WO")).map(m=>m.eventId));
      for(const evId of touchedEvents){
        ensureCascadeByes(evId, all);
      }
      saveMatches(all);
    }
    return changed;
  }

  
function buildEventOptions(){
  // eventos onde o usuário tem inscrição aprovada (e também permite "Todos")
  const regs = loadRegs().filter(r=>r.userId===user.id && (r.status||"") === "Aprovado");
  const evs = loadEvents();
  const allowedIds = new Set(regs.map(r=>r.eventId));

  const ordered = evs
    .filter(e=>allowedIds.has(e.id))
    .sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));

  const opts = ordered
    .map(e=>`<option value="${esc(e.id)}">${esc(e.title||"(sem título)")}</option>`)
    .join("");

  selEvent.innerHTML = `<option value="">Todos</option>` + opts;

  // Default inteligente:
  // - se existir algum match agendado/futuro para este usuário, seleciona o evento mais próximo;
  // - senão, seleciona o evento mais recente (updatedAt).
  if(!selEvent.value){
    const matches = loadMatches().filter(m=>m && isMine(m) && allowedIds.has(m.eventId));
    const now = Date.now();

    let bestBySchedule = null; // {eventId, t}
    for(const m of matches){
      if(!m.scheduledAt) continue;
      const d = new Date(m.scheduledAt);
      const t = d.getTime();
      if(Number.isNaN(t)) continue;

      // considera "próximo" mesmo que esteja na janela de check-in
      if(t >= (now - 20*60*1000)){
        if(!bestBySchedule || t < bestBySchedule.t){
          bestBySchedule = { eventId: m.eventId, t };
        }
      }
    }

    const preferred = bestBySchedule?.eventId || (ordered[0]?.id || "");
    if(preferred){
      selEvent.value = preferred;
    }
  }
}

  function renderTable(){
    msg.textContent = "";

    // auto WO a cada render
    const woCount = applyAutoWO();
    if(woCount){
      msg.textContent = `${woCount} WO(s) aplicados automaticamente por expiração do check-in.`;
    }

    const all = loadMatches().filter(isMine);

    const eventId = selEvent.value || "";
    const statusF = selStatus.value || "";
    const q = (inpSearch.value || "").trim().toLowerCase();

    let list = all;
    if(eventId) list = list.filter(m=>m.eventId === eventId);

    // Usuário NÃO precisa ver BYEs/linhas vazias. Mantemos apenas partidas "reais" (A e B definidos).
    list = list.filter(m=>{
      const st = String(m.status||"").toLowerCase();
      if(st.includes("bye")) return false;
      if(!m.participantAId || !m.participantBId) return false;
      return true;
    });

    if(statusF){
      list = list.filter(m=>statusBucket(m) === statusF);
    }

    if(q){
      list = list.filter(m=>{
        const opp = safeName(opponentId(m)).toLowerCase();
        const code = String(m.code||"").toLowerCase();
        return code.includes(q) || opp.includes(q);
      });
    }

    // Se não estiver filtrando/buscando e não pediu "mostrar todas", mostra apenas partida(s) atual(is)
    const showAll = !!(chkShowAll && chkShowAll.checked);
    const hasManualFilter = !!eventId || !!statusF || !!q;
    if(!showAll && !hasManualFilter){
      const current = pickCurrentMatches(list);
      // se não achou nenhuma "real" ainda, mantém vazio para não confundir com BYE
      list = current;
    }

    list = sortMatches(list);

    if(!list.length){
      tbody.innerHTML = `<tr><td colspan="9" class="muted" style="padding:10px;">Nenhuma partida encontrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(m=>{
      const ev = loadEvents().find(e=>e.id===m.eventId);
      const evTitle = ev?.title || "(evento)";
      const mySide = sideOf(m);
      const oppId = opponentId(m);
      const oppName = safeName(oppId);
      const when = fmtWhen(m.scheduledAt);
      const windowTxt = m.scheduledAt ? fmtWindow(m.scheduledAt) : "—";
      const md = m.md || defaultMdByRound(m.round) || "MD3";

      const open = checkinOpenFor(m);
      const expired = checkinExpiredFor(m);
      const aIn = !!m.checkinAAt;
      const bIn = !!m.checkinBAt;

      const myIn = mySide === "A" ? aIn : bIn;
      const bothIn = aIn && bIn;

      let stPill = matchStatusPill(m.status || "Agendada");
      if(open && !(String(m.status||"").toLowerCase().includes("valid")||String(m.status||"").toLowerCase().includes("wo")||String(m.status||"").toLowerCase().includes("bye"))){
        stPill = `<span class="p-pill warn">Check-in</span>`;
      }
      if(m.reportedAt && !m.validatedAt){
        stPill = `<span class="p-pill">Aguardando</span>`;
      }

      const canCheckin = open && !expired && !myIn && !m.winnerId && !String(m.status||"").toLowerCase().includes("wo") && !String(m.status||"").toLowerCase().includes("bye");
      const canRoom = bothIn && !m.winnerId && !String(m.status||"").toLowerCase().includes("wo") && !String(m.status||"").toLowerCase().includes("bye");

      return `
        <tr>
          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(m.round||"")}</td>
          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">
            <div style="font-weight:700;">${esc(m.code||"")}</div>
            <div class="muted small">${esc(evTitle)}</div>
          </td>
          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">
            <div style="display:flex; gap:8px; align-items:center;">
              <strong>${esc(safeName(user.id))}</strong>
              ${myIn ? `<span class="p-pill ok">Checked</span>` : ``}
            </div>
          </td>
          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(oppName)}</td>
          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(when)}</td>
          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(windowTxt)}</td>
          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(md)}</td>
          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${stPill}</td>
          <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08); white-space:nowrap;">
            <button class="btn2 ${canCheckin ? "primary":""}" data-u-checkin="${esc(m.id)}">
              Check-in
            </button>
            <button class="btn2" data-u-room="${esc(m.id)}">
              Abrir
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // handlers
    tbody.querySelectorAll("[data-u-checkin]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-u-checkin");
        const all = loadMatches();
        const m = all.find(x=>x.id===id);
        if(!m) return;

        const mySide = (m.participantAId===user.id) ? "A" : (m.participantBId===user.id ? "B" : "");
        if(!mySide) return;

        if(!m.participantAId || !m.participantBId){
          msg.textContent = "Esta linha não é uma partida jogável (provavelmente BYE/round futuro).";
          return;
        }
        if(!checkinOpenFor(m)){
          msg.textContent = "Check-in ainda não está aberto (abre 10 min antes).";
          return;
        }
        if(checkinExpiredFor(m)){
          msg.textContent = "Check-in expirou para esta partida.";
          return;
        }

        if(mySide === "A") m.checkinAAt = nowISO();
        if(mySide === "B") m.checkinBAt = nowISO();
        m.updatedAt = nowISO();

        // quando os dois fizerem check-in, marca status
        if(m.checkinAAt && m.checkinBAt){
          m.status = "Em andamento";
        } else {
          m.status = "Check-in";
        }

        saveMatches(all);
        renderTable();
      });
    });

    tbody.querySelectorAll("[data-u-room]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-u-room");
        const all = loadMatches();
        const m = all.find(x=>x.id===id);
        if(!m) return;

        if(!m.participantAId || !m.participantBId){
          msg.textContent = "Esta linha não é uma partida jogável (provavelmente BYE/round futuro).";
          return;
        }

        const aIn = !!m.checkinAAt;
        const bIn = !!m.checkinBAt;
        if(!(aIn && bIn)){
          msg.textContent = "Aguarde os dois jogadores fazerem check-in para abrir.";
          return;
        }

        roomModal.style.display = "block";
        const ev = loadEvents().find(e=>e.id===m.eventId);
        const evTitle = ev?.title || "(evento)";
        roomTitle.textContent = `${m.code || "Partida"} • ${m.round || ""}`;
        const oppName = safeName(opponentId(m));
        roomInfo.innerHTML = `
          <div class="kicker" style="margin-bottom:6px;">${esc(evTitle)}</div>
          <div><strong>Oponente:</strong> ${esc(oppName)}</div>
          <div><strong>Quando:</strong> ${esc(fmtWhen(m.scheduledAt))}</div>
          <div><strong>MD:</strong> ${esc(m.md || defaultMdByRound(m.round) || "MD3")}</div>
        `;

        const mySide = sideOf(m);
        const oppSide = (mySide === 'A') ? 'B' : 'A';
        const md = (m.md || defaultMdByRound(m.round) || "MD3");
        const maxGames = mdToMaxGames(md);
        const needWins = needWinsFor(maxGames);

        // Draft link (integrado)
        roomDraftLink.href = `./draft.html?eventId=${encodeURIComponent(m.eventId)}&matchId=${encodeURIComponent(m.id)}&round=${encodeURIComponent(m.round||'')}&role=${encodeURIComponent(mySide.toLowerCase())}`;

        // ---- Resultado por game ----
        roomMsg.textContent = "";
        if(roomSeriesHint){
          roomSeriesHint.textContent = `Série ${md} (melhor de ${maxGames}) • Você é ${mySide} • Marque cada game como vitória/derrota.`;
        }

        // carrega rascunho existente (se houver)
        let reportedGames = Array.isArray(m.reportedGames) ? m.reportedGames.slice(0, maxGames) : [];
        while(reportedGames.length < maxGames) reportedGames.push(null);

        function renderGames(){
          const {a,b} = scoreFromReportedGames(reportedGames);
          if(roomAutoScore) roomAutoScore.textContent = `Placar: ${a} x ${b}`;
          if(!roomGames) return;

          roomGames.innerHTML = reportedGames.map((w, idx)=>{
            const g = idx + 1;
            const meWon = (w === mySide);
            const meLost = (w === oppSide);
            return `
              <div class="card" style="padding:10px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                  <div>
                    <div class="kicker">Game ${g}</div>
                    <div class="muted small">${w ? (`Vencedor: ${w}`) : 'Sem reporte'}</div>
                  </div>
                  <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn2 ${meWon ? 'primary' : ''}" type="button" data-gwin="${g}">Vitória</button>
                    <button class="btn2 ${meLost ? 'primary' : ''}" type="button" data-gloss="${g}">Derrota</button>
                  </div>
                </div>
              </div>
            `;
          }).join('');

          roomGames.querySelectorAll('[data-gwin]').forEach(btn=>{
            btn.addEventListener('click', ()=>{
              const g = Number(btn.getAttribute('data-gwin'));
              if(!g) return;
              reportedGames[g-1] = mySide;
              roomMsg.textContent = '';
              renderGames();
            });
          });
          roomGames.querySelectorAll('[data-gloss]').forEach(btn=>{
            btn.addEventListener('click', ()=>{
              const g = Number(btn.getAttribute('data-gloss'));
              if(!g) return;
              reportedGames[g-1] = oppSide;
              roomMsg.textContent = '';
              renderGames();
            });
          });
        }

        function clearGames(){
          reportedGames = Array(maxGames).fill(null);
          roomMsg.textContent = '';
          renderGames();
        }

        if(roomClear){
          roomClear.onclick = ()=> clearGames();
        }

        renderGames();

        roomSave.onclick = () => {
          const {a,b} = scoreFromReportedGames(reportedGames);

          // valida: precisa existir vencedor (atingir needWins)
          const aWin = a >= needWins;
          const bWin = b >= needWins;
          if(!(aWin || bWin)){
            roomMsg.textContent = `Reporte incompleto. Para ${md}, alguém precisa chegar a ${needWins} vitórias.`;
            return;
          }
          if(aWin && bWin){
            roomMsg.textContent = "Reporte inválido (ambos atingiram vitórias).";
            return;
          }

          // salva como reporte (não valida)
          m.reportedGames = reportedGames.slice(0, maxGames);
          m.reportedScoreA = a;
          m.reportedScoreB = b;
          m.reportedBy = user.id;
          m.reportedAt = nowISO();
          m.status = "Aguardando validação";
          m.updatedAt = nowISO();
          saveMatches(all);

          roomMsg.textContent = "Reporte salvo. Aguarde validação do admin.";
        };
      });
    });
  }

  buildEventOptions();
  renderTable();

  btnRefresh.addEventListener("click", renderTable);
  selEvent.addEventListener("change", renderTable);
  selStatus.addEventListener("change", renderTable);
  inpSearch.addEventListener("input", renderTable);
  if(chkShowAll) chkShowAll.addEventListener("change", renderTable);

  // auto refresh leve enquanto usuário está nessa tela
  const t = setInterval(()=>{
    // se o usuário saiu da view, para
    if(!document.getElementById("uMatchTbody")){ clearInterval(t); return; }
    renderTable();
  }, 15000);
}
    }

    // ---------- Admin routing ----------
    function setViewAdmin(key) {
      if (key === "bracket") {
        window.open(bracketHref, "_blank", "noopener");
        return;
      }

      if (key === "draft-templates") {
        window.open("./draft-templates.html", "_blank", "noopener");
        return;
      }

      viewKicker.textContent = "Painel do Admin";
      viewBadge.textContent = "Admin";

if (key === "usuarios") {
  viewTitle.textContent = "Gerenciar Usuários";
  viewRoot.innerHTML = renderAdminUsuarios();

  const userMsg = document.getElementById("userMsg");
  const search = document.getElementById("userSearch");
  const filter = document.getElementById("userFilterLevel");
  const tbody = document.getElementById("userTbody");

  const modal = document.getElementById("userModal");
  const modalClose = document.getElementById("userModalClose");

  const editUserId = document.getElementById("editUserId");
  const editLogin = document.getElementById("editLogin");
  const editPassword = document.getElementById("editPassword");
  const editAccess = document.getElementById("editAccess");
  const editPoints = document.getElementById("editPoints");

  const editFullName = document.getElementById("editFullName");
  const editNickname = document.getElementById("editNickname");
  const editBirthDate = document.getElementById("editBirthDate");
  const editCPF = document.getElementById("editCPF");
  const editEmail = document.getElementById("editEmail");
  const editWhatsapp = document.getElementById("editWhatsapp");
  const editDiscord = document.getElementById("editDiscord");
  const editAoe4Main = document.getElementById("editAoe4Main");
  const editAoe4Smurfs = document.getElementById("editAoe4Smurfs");
  const editPixKey = document.getElementById("editPixKey");

  const btnSave = document.getElementById("userSave");
  const editMsg = document.getElementById("userEditMsg");

  function closeModal(){
    modal.style.display = "none";
  }
  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });

  function openModal(u){
    editMsg.textContent = "";
    editUserId.value = u.id;

    editLogin.value = u.login || "";
    editPassword.value = u.password || "";
    editAccess.value = u.accessLevel || "user";
    editPoints.value = String(Number(u.points || 0));

    const p = u.profile || {};
    editFullName.value = p.fullName || "";
    editNickname.value = p.nickname || "";
    editBirthDate.value = p.birthDate || "";
    editCPF.value = (p.cpf || "").toString();
    editEmail.value = p.email || "";
    editWhatsapp.value = p.whatsapp || "";
    editDiscord.value = p.discord || "";
    editAoe4Main.value = p.aoe4Main || "";
    editAoe4Smurfs.value = p.aoe4Smurfs || "";
    editPixKey.value = p.pixKey || "";

    modal.style.display = "block";
  }

  function deleteUser(id){
    const users = loadUsers().filter(u=>u.id!==id);
    saveUsers(users);

    // limpa inscrições desse usuário
    saveRegs(loadRegs().filter(r=>r.userId!==id));
  }

  function redraw(){
    const users = loadUsers();
    const q = (search.value || "").trim().toLowerCase();
    const lv = filter.value || "";

    const filtered = users.filter(u=>{
      if(lv && (u.accessLevel || "user") !== lv) return false;
      if(!q) return true;

      const name = (u.profile?.fullName || "").toLowerCase();
      const login = (u.login || "").toLowerCase();
      const cpf = (String(u.profile?.cpf || "").replace(/\D/g,"")).toLowerCase();
      const email = (u.profile?.email || "").toLowerCase();

      return (
        login.includes(q) ||
        name.includes(q) ||
        cpf.includes(q) ||
        email.includes(q)
      );
    }).sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));

    const rows = filtered.map(u=>{
      const name = u.profile?.fullName || "";
      const cpf = u.profile?.cpf ? String(u.profile.cpf).replace(/\D/g,"") : "";
      const email = u.profile?.email || "";
      const points = Number(u.points || 0);
      return `
        <tr>
          <td>${esc(u.login || "")}</td>
          <td>${esc(name)}</td>
          <td>${esc(u.accessLevel || "user")}</td>
          <td>${esc(cpf)}</td>
          <td>${esc(email)}</td>
          <td>${esc(points)}</td>
          <td style="white-space:nowrap;">
            <button class="btn2" data-user-edit="${u.id}">Editar</button>
            <button class="btn2" data-user-del="${u.id}">Excluir</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.innerHTML = rows || `<tr><td colspan="7" class="muted" style="padding:10px;">Nenhum usuário.</td></tr>`;
    bindRowActions();
  }

  function bindRowActions(){
    viewRoot.querySelectorAll("[data-user-edit]").forEach(b=>{
      b.onclick = ()=>{
        const id = b.getAttribute("data-user-edit");
        const u = loadUsers().find(x=>x.id===id);
        if(u) openModal(u);
      };
    });

    viewRoot.querySelectorAll("[data-user-del]").forEach(b=>{
      b.onclick = ()=>{
        const id = b.getAttribute("data-user-del");
        // trava para não deletar o próprio admin logado por acidente
        if(id === user.id){
          userMsg.textContent = "Você não pode excluir o usuário atualmente logado.";
          return;
        }
        deleteUser(id);
        userMsg.textContent = "Usuário excluído.";
        redraw();
      };
    });
  }

  btnSave.addEventListener("click", ()=>{
    editMsg.textContent = "";

    const id = editUserId.value;
    const users = loadUsers();
    const idx = users.findIndex(u=>u.id===id);
    if(idx < 0){
      editMsg.textContent = "Usuário não encontrado.";
      return;
    }

    const newLogin = (editLogin.value || "").trim();
    const newPass = (editPassword.value || "").trim();
    const newAccess = editAccess.value || "user";
    const newPoints = Number((editPoints.value || "0").replace(/[^\d-]/g,"")) || 0;

    if(newLogin.length < 3){
      editMsg.textContent = "Login precisa ter pelo menos 3 caracteres.";
      return;
    }
    // login único
    const collision = users.some(u => u.id !== id && (u.login||"").toLowerCase() === newLogin.toLowerCase());
    if(collision){
      editMsg.textContent = "Já existe outro usuário com esse login.";
      return;
    }
    if(newPass.length < 4){
      editMsg.textContent = "Senha precisa ter pelo menos 4 caracteres.";
      return;
    }

    const cpf = (editCPF.value || "").replace(/\D/g,"");
    if(cpf && cpf.length !== 11){
      editMsg.textContent = "CPF deve ter 11 dígitos (ou deixe vazio).";
      return;
    }

    const old = users[idx];
    const p = old.profile || {};

    const nick = (editNickname.value || "").trim();
    if(nick && nick.length > 30){
      editMsg.textContent = "Nick muito longo (máx. 30 caracteres).";
      return;
    }

    users[idx] = {
      ...old,
      login: newLogin,
      password: newPass,
      accessLevel: newAccess,
      points: newPoints,
      profile: {
        ...p,
        fullName: (editFullName.value || "").trim(),
        nickname: nick,
        birthDate: (editBirthDate.value || "").trim(),
        cpf,
        email: (editEmail.value || "").trim(),
        whatsapp: (editWhatsapp.value || "").trim(),
        discord: (editDiscord.value || "").trim(),
        aoe4Main: (editAoe4Main.value || "").trim(),
        aoe4Smurfs: (editAoe4Smurfs.value || "").trim(),
        pixKey: (editPixKey.value || "").trim(),
        completed: !!p.completed, // mantém flag do usuário
      },
      updatedAt: nowISO(),
    };

    saveUsers(users);
    editMsg.textContent = "Salvo!";
    closeModal();
    redraw();
  });

  search.addEventListener("input", redraw);
  filter.addEventListener("change", redraw);

  // bind inicial
  bindRowActions();

      } else if (key === "eventos") {
        viewTitle.textContent = "Gerenciar Eventos";
        viewRoot.innerHTML = renderAdminEventos();

        const msg = document.getElementById("evMsg");

        function fillDraftTemplateSelect(selectedId) {
          const sel = document.getElementById("evDraftTemplateId");
          const hint = document.getElementById("evDraftTplHint");
          if (!sel) return;
          const templates = loadDraftTemplates().slice().sort((a,b)=>String(a?.name||"").localeCompare(String(b?.name||"")));

          const cur = selectedId ?? sel.value;
          sel.innerHTML = `<option value="">(nenhum)</option>` + templates.map(t=>{
            const name = esc(t.name || "(sem nome)");
            return `<option value="${esc(t.id)}">${name}</option>`;
          }).join("");

          sel.value = cur || "";

          if(hint){
            if(!templates.length){
              hint.textContent = "Nenhum template encontrado. Clique em 'Abrir templates' para criar.";
            } else if(sel.value){
              const t = templates.find(x=>x.id===sel.value);
              hint.textContent = t ? `Selecionado: ${t.name}` : "Template selecionado não encontrado.";
            } else {
              hint.textContent = "Selecione um template para habilitar o draft.";
            }
          }
        }

        // Botão para abrir o cadastro de templates (mesmo origin)
        const openTplBtn = document.getElementById("evOpenDraftTemplates");
        if (openTplBtn) {
          openTplBtn.addEventListener("click", () => {
            window.open("./draft-templates.html", "_blank", "noopener");
          });
        }

        // Popular select na primeira renderização
        fillDraftTemplateSelect("");

        // Recarregar lista quando voltar o foco (caso você crie template em outra aba)
        window.addEventListener("focus", () => fillDraftTemplateSelect());

        // Atualiza hint ao trocar
        document.getElementById("evDraftTemplateId")?.addEventListener("change", () => fillDraftTemplateSelect());

        function clearForm() {
          document.getElementById("evId").value = "";
          document.getElementById("evTitle").value = "";
          document.getElementById("evType").value = "1v1";
          document.getElementById("evStatus").value = "Em breve";
          document.getElementById("evStart").value = "";
          document.getElementById("evRules").value = "";
          document.getElementById("evTerms").value = "";
          document.getElementById("evDesc").value = "";
          // Configs
          const capSelEl = document.getElementById("evBracketCap");
          const capCustomEl = document.getElementById("evBracketCapCustom");
          const splitEl = document.getElementById("evSplitTeams");
          if(capSelEl) capSelEl.value = "32";
          if(capCustomEl) capCustomEl.value = "";
          if(splitEl) splitEl.value = "yes";

          const setv = (id, val)=>{ const el=document.getElementById(id); if(el) el.value = val; };
          setv("evMdR64","MD3"); setv("evMdR32","MD3"); setv("evMdR16","MD3");
          setv("evMdR8","MD5"); setv("evMdR4","MD5"); setv("evMdR2","MD7");

          const pEl = document.getElementById("evPointsTable");
          const prEl = document.getElementById("evPrizeTable");
          if(pEl) pEl.value = "";
          if(prEl) prEl.value = "";

          const dEn = document.getElementById("evDraftEnabled");
          const dTpl = document.getElementById("evDraftTemplateId");
          if(dEn) dEn.value = "no";
          if(dTpl) dTpl.value = "";

          msg.textContent = "";
        }

        document.getElementById("evClear").addEventListener("click", clearForm);

        document.getElementById("evSave").addEventListener("click", () => {
          const id = document.getElementById("evId").value || "";
          const title = (document.getElementById("evTitle").value || "").trim();
          const type = document.getElementById("evType").value;
          const status = document.getElementById("evStatus").value;
          const startDate = document.getElementById("evStart").value || "";
          const rulesUrl = (document.getElementById("evRules").value || "").trim();
          const termsUrl = (document.getElementById("evTerms").value || "").trim();
          const description = (document.getElementById("evDesc").value || "").trim();
const capSel = (document.getElementById("evBracketCap")?.value || "32");
const capCustom = (document.getElementById("evBracketCapCustom")?.value || "");
const bracketCap = normalizeBracketCap(capSel, capCustom);

const formatByRound = {
  R64: (document.getElementById("evMdR64")?.value || "MD3"),
  R32: (document.getElementById("evMdR32")?.value || "MD3"),
  R16: (document.getElementById("evMdR16")?.value || "MD3"),
  R8:  (document.getElementById("evMdR8")?.value  || "MD5"),
  R4:  (document.getElementById("evMdR4")?.value  || "MD5"),
  R2:  (document.getElementById("evMdR2")?.value  || "MD7"),
};

const pointsTable = parseKVLines(document.getElementById("evPointsTable")?.value || "");
const prizeTable = parseKVLines(document.getElementById("evPrizeTable")?.value || "");
const splitTeamsEqually = (document.getElementById("evSplitTeams")?.value || "yes") === "yes";

const draftEnabled = (document.getElementById("evDraftEnabled")?.value || "no") === "yes";
const draftTemplateId = (document.getElementById("evDraftTemplateId")?.value || "").trim();

if (draftEnabled && !draftTemplateId) {
  msg.textContent = "Draft habilitado: selecione um template.";
  return;
}

          if (!title) {
            msg.textContent = "Informe o título do evento.";
            return;
          }

          const events = loadEvents();

          if (id) {
            const idx = events.findIndex((e) => e.id === id);
            if (idx >= 0) {
              const prev = events[idx];
              const locked = !!(prev.locked || prev.startedAt || prev.completedAt);
              if(locked){
                // Evento já iniciou/concluiu: trava configurações que afetam chave/pontuação/premiação.
                events[idx] = {
                  ...prev,
                  title,
                  type,
                  status,
                  startDate,
                  rulesUrl,
                  termsUrl,
                  description,
                  updatedAt: nowISO(),
                };
                saveEvents(events);
                msg.textContent = "Evento iniciado/concluído: configurações de chave/pontos/premiação estão travadas. Para alterar, use Clonar evento.";
                setViewAdmin("eventos");
                return;
              }

              events[idx] = {
                ...prev,
                title,
                type,
                status,
                startDate,
                rulesUrl,
                termsUrl,
                description,
                bracketCap,
                formatByRound,
                pointsTable,
                prizeTable,
                splitTeamsEqually,
                draftEnabled,
                draftTemplateId,
                updatedAt: nowISO(),
              };
            }
          } else {
            events.push({
              id: crypto.randomUUID(),
              title,
              type,
              status,
              startDate,
              rulesUrl,
              termsUrl,
              description,
              bracketCap,
              formatByRound,
              pointsTable,
              prizeTable,
              splitTeamsEqually,
              draftEnabled,
              draftTemplateId,
              createdAt: nowISO(),
              updatedAt: nowISO(),
            });
          }

          saveEvents(events);
          msg.textContent = "Evento salvo!";
          setViewAdmin("eventos");
        });

        viewRoot.querySelectorAll("[data-ev-edit]").forEach((b) => {
          b.addEventListener("click", () => {
            const id = b.getAttribute("data-ev-edit");
            const e = loadEvents().find((x) => x.id === id);
            if (!e) return;

            document.getElementById("evId").value = e.id;
            document.getElementById("evTitle").value = e.title || "";
            document.getElementById("evType").value = e.type || "1v1";
            document.getElementById("evStatus").value = e.status || "Em breve";
            document.getElementById("evStart").value = e.startDate || "";
            document.getElementById("evRules").value = e.rulesUrl || "";
            document.getElementById("evTerms").value = e.termsUrl || "";
            document.getElementById("evDesc").value = e.description || "";
// Configurações
const capSelEl = document.getElementById("evBracketCap");
const capCustomEl = document.getElementById("evBracketCapCustom");
const splitEl = document.getElementById("evSplitTeams");
if(capSelEl){
  const cap = Number(e.bracketCap || 32);
  if([8,16,32,64].includes(cap)){
    capSelEl.value = String(cap);
    if(capCustomEl) capCustomEl.value = "";
  } else {
    capSelEl.value = "custom";
    if(capCustomEl) capCustomEl.value = String(cap || "");
  }
}
if(splitEl) splitEl.value = (e.splitTeamsEqually === false) ? "no" : "yes";

const f = e.formatByRound || {};
const setv = (id, val)=>{ const el=document.getElementById(id); if(el) el.value = val; };
setv("evMdR64", String(f.R64 || "MD3"));
setv("evMdR32", String(f.R32 || "MD3"));
setv("evMdR16", String(f.R16 || "MD3"));
setv("evMdR8",  String(f.R8  || "MD5"));
setv("evMdR4",  String(f.R4  || "MD5"));
setv("evMdR2",  String(f.R2  || "MD7"));

const pEl = document.getElementById("evPointsTable");
const prEl = document.getElementById("evPrizeTable");
if(pEl) pEl.value = serializeKVLines(e.pointsTable || {});
if(prEl) prEl.value = serializeKVLines(e.prizeTable || {});

// Draft
const dEn = document.getElementById("evDraftEnabled");
const dTpl = document.getElementById("evDraftTemplateId");
if(dEn) dEn.value = (e.draftEnabled ? "yes" : "no");
if(dTpl) dTpl.value = (e.draftTemplateId || "");
            msg.textContent = "Editando evento...";
          });
        });

        viewRoot.querySelectorAll("[data-ev-del]").forEach((b) => {
          b.addEventListener("click", () => {
            const id = b.getAttribute("data-ev-del");
            saveEvents(loadEvents().filter((e) => e.id !== id));
            saveRegs(loadRegs().filter((r) => r.eventId !== id));
            setViewAdmin("eventos");
          });


viewRoot.querySelectorAll("[data-ev-bracket]").forEach((b) => {
  b.addEventListener("click", () => {
    const eventId = b.getAttribute("data-ev-bracket");
    const r = safeRegenerateBracket(eventId);
    msg.textContent = r.msg;
  });
});

        });

      } else if (key === "inscricoes") {
        viewTitle.textContent = "Gerenciar Inscrições";
        viewRoot.innerHTML = renderAdminInscricoes();

        const regMsg = document.getElementById("regMsg");
        const regSearch = document.getElementById("regSearch");
        const regFilterEvent = document.getElementById("regFilterEvent");
        const regSort = document.getElementById("regSort");
        const tbody = document.getElementById("regTbody");

        const modal = document.getElementById("regModal");
        const modalClose = document.getElementById("regModalClose");
        const editId = document.getElementById("regEditId");
        const editUser = document.getElementById("regEditUser");
        const editEvent = document.getElementById("regEditEvent");
        const editSeed = document.getElementById("regEditSeed");
        const editStatus = document.getElementById("regEditStatus");
        const editAgreedAt = document.getElementById("regEditAgreedAt");
        const editSave = document.getElementById("regEditSave");
        const editMsg = document.getElementById("regEditMsg");

        const btnSeedBulk = document.getElementById("btnSeedBulk");
        const seedBulkModal = document.getElementById("seedBulkModal");
        const seedBulkClose = document.getElementById("seedBulkClose");
        const seedBulkBody = document.getElementById("seedBulkBody");
        const seedBulkMsg = document.getElementById("seedBulkMsg");
        const seedBulkSubtitle = document.getElementById("seedBulkSubtitle");
        const btnSeedBulkSave = document.getElementById("btnSeedBulkSave");
        const btnSeedBulkAuto = document.getElementById("btnSeedBulkAuto");
        const btnSeedBulkClear = document.getElementById("btnSeedBulkClear");

        function setRegStatus(id, status) {
          const regs = loadRegs();
          const idx = regs.findIndex((r) => r.id === id);
          if (idx < 0) return;
          regs[idx] = { ...regs[idx], status, updatedAt: nowISO() };
          saveRegs(regs);
        }

        function deleteReg(id) {
          saveRegs(loadRegs().filter((r) => r.id !== id));
        }

        function openModal(reg) {
          editMsg.textContent = "";
          editId.value = reg.id;
          editUser.value = reg.userId;
          editEvent.value = reg.eventId;
          editSeed.value = String(reg.seed ?? "");
          editStatus.value = reg.status || "Pendente";
          
editAgreedAt.value = reg.agreedAt || "";

const editTeamName = document.getElementById("regEditTeamName");
const editMemberIds = document.getElementById("regEditMemberIds");
const teamRow = document.getElementById("regEditTeamMembersRow");

const ev = loadEvents().find((x) => x.id === reg.eventId);
const t = String(ev?.type || "1v1").toLowerCase().trim();
const isTeam = (t === "2v2" || t === "3v3");

if (editTeamName) editTeamName.value = reg.teamName || "";
if (editMemberIds) editMemberIds.value = Array.isArray(reg.memberIds) ? reg.memberIds.join(",") : "";
if (teamRow) teamRow.style.display = isTeam ? "" : "none";

modal.style.display = "block";
        }

        function closeModal() {
          modal.style.display = "none";
        }

        modalClose.addEventListener("click", closeModal);
        modal.addEventListener("click", (e) => {
          if (e.target === modal) closeModal();
        });


        function openSeedBulkModal(){
          const evId = (regFilterEvent.value || "").trim();
          if(!evId){
            regMsg.textContent = "Selecione um evento no filtro para definir seeds em massa.";
            return;
          }
          const ev = loadEvents().find(e=>e.id===evId);
          const cap = ev ? normalizeBracketCap(String(ev.bracketCap||32), String(ev.bracketCap||"")) : 32;
          seedBulkSubtitle.textContent = ev ? `${ev.title} • cap de seed: 1 a ${cap}` : `Evento selecionado • cap: 1 a ${cap}`;

          const regs = loadRegs().filter(r=>r.eventId===evId && (r.status||"").toLowerCase().includes("aprov"));
          const users = loadUsers();
          // ordena: seed existente primeiro, depois nome
          regs.sort((a,b)=>{
            const sa = a.seed != null ? Number(a.seed) : 9999;
            const sb = b.seed != null ? Number(b.seed) : 9999;
            if(sa !== sb) return sa - sb;
            const na = (participantLabel(null, a.userId)||"").toLowerCase();
            const nb = (participantLabel(null, b.userId)||"").toLowerCase();
            return na.localeCompare(nb);
          });

          const rows = regs.map((r, i)=>{
            const name = participantLabel(null, r.userId);
            const seedVal = r.seed != null ? String(r.seed) : "";
            return `
              <tr>
                <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08); white-space:nowrap;">${esc(name)}</td>
                <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08); width:140px;">
                  <input class="input" data-seed-user="${esc(r.userId)}" value="${esc(seedVal)}" placeholder="${i+1}" />
                </td>
              </tr>
            `;
          }).join("");

          seedBulkBody.innerHTML = `
            <table style="width:100%; border-collapse:collapse; min-width: 520px;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.12);">Aprovado</th>
                  <th style="text-align:left; padding:10px; border-bottom:1px solid rgba(255,255,255,.12);">Seed</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="2" class="muted" style="padding:10px;">Nenhum aprovado para este evento.</td></tr>`}
              </tbody>
            </table>
          `;
          seedBulkMsg.textContent = "";
          seedBulkModal.style.display = "block";
        }

        function closeSeedBulkModal(){
          seedBulkModal.style.display = "none";
        }

        if(seedBulkClose) seedBulkClose.addEventListener("click", closeSeedBulkModal);
        if(seedBulkModal) seedBulkModal.addEventListener("click", (e)=>{ if(e.target === seedBulkModal) closeSeedBulkModal(); });

        if(btnSeedBulk) btnSeedBulk.addEventListener("click", openSeedBulkModal);

        if(btnSeedBulkAuto) btnSeedBulkAuto.addEventListener("click", ()=>{
          // Auto: 1..N na ordem atual da tabela do modal
          const inputs = Array.from(seedBulkBody.querySelectorAll("input[data-seed-user]"));
          inputs.forEach((inp, idx)=>{ inp.value = String(idx+1); });
          seedBulkMsg.textContent = "Auto preenchido pela ordem da lista.";
        });

        if(btnSeedBulkClear) btnSeedBulkClear.addEventListener("click", ()=>{
          const inputs = Array.from(seedBulkBody.querySelectorAll("input[data-seed-user]"));
          inputs.forEach(inp=>{ inp.value = ""; });
          seedBulkMsg.textContent = "Seeds limpas.";
        });

        if(btnSeedBulkSave) btnSeedBulkSave.addEventListener("click", ()=>{
          const evId = (regFilterEvent.value || "").trim();
          const ev = loadEvents().find(e=>e.id===evId);
          const cap = ev ? normalizeBracketCap(String(ev.bracketCap||32), String(ev.bracketCap||"")) : 32;

          const inputs = Array.from(seedBulkBody.querySelectorAll("input[data-seed-user]"));
          const seeds = [];
          const map = new Map(); // userId -> seed|null
          for(const inp of inputs){
            const userId = inp.getAttribute("data-seed-user");
            const raw = (inp.value||"").trim();
            if(!raw){ map.set(userId, null); continue; }
            const v = Number(raw.replace(/[^\d]/g,""));
            if(!v || v<1 || v>cap){
              seedBulkMsg.textContent = `Seed inválida para ${userLabelById(userId)} (use 1 a ${cap}).`;
              return;
            }
            seeds.push(v);
            map.set(userId, v);
          }
          // duplicidade
          const seen = new Set();
          for(const v of seeds){
            if(seen.has(v)){
              seedBulkMsg.textContent = `Seeds duplicadas encontradas (ex: ${v}). Corrija antes de salvar.`;
              return;
            }
            seen.add(v);
          }

          const regsAll = loadRegs();
          let changed = 0;
          for(let i=0;i<regsAll.length;i++){
            const r = regsAll[i];
            if(r.eventId !== evId) continue;
            if(!(String(r.status||"").toLowerCase().includes("aprov"))) continue;
            if(!map.has(r.userId)) continue;
            const seed = map.get(r.userId);
            regsAll[i] = { ...r, seed, updatedAt: nowISO() };
            changed++;
          }
          saveRegs(regsAll);
          seedBulkMsg.textContent = `Salvo! (${changed} inscrições atualizadas)`;
          closeSeedBulkModal();
          redraw();
        });

        // Habilita/desabilita botão conforme evento selecionado
        function syncSeedBulkButton(){
          const has = !!(regFilterEvent.value || "").trim();
          if(btnSeedBulk) btnSeedBulk.disabled = !has;
        }

        editSave.addEventListener("click", () => {
          const regs = loadRegs();
          const id = editId.value;
          const idx = regs.findIndex((r) => r.id === id);
          if (idx < 0) {
            editMsg.textContent = "Inscrição não encontrada.";
            return;
          }
const seedRaw = (editSeed.value || "").trim();
const seed = seedRaw ? Number(seedRaw.replace(/[^\d]/g, "")) : null;
if (seedRaw && (!seed || seed < 1 || seed > 64)) {
  editMsg.textContent = "Seed inválida (use 1 a 64).";
  return;
}

const ev = loadEvents().find((x) => x.id === editEvent.value);
const t = String(ev?.type || "1v1").toLowerCase().trim();
const isTeam = (t === "2v2" || t === "3v3");

const teamName = (document.getElementById("regEditTeamName")?.value || "").trim();
const memberIdsRaw = (document.getElementById("regEditMemberIds")?.value || "").trim();

let memberIds = null;
if (isTeam) {
  // memberIds: lista de IDs, inclui capitão
  memberIds = memberIdsRaw
    ? memberIdsRaw.split(",").map(x => x.trim()).filter(Boolean)
    : null;

  const size = (t === "2v2") ? 2 : 3;
  if (!teamName) {
    editMsg.textContent = "Informe o nome do time para eventos 2v2/3v3.";
    return;
  }
  if (!memberIds || memberIds.length !== size) {
    editMsg.textContent = `Informe exatamente ${size} IDs de membros (incluindo capitão).`;
    return;
  }
  const uniq = new Set(memberIds);
  if (uniq.size !== memberIds.length) {
    editMsg.textContent = "IDs de membros repetidos não são permitidos.";
    return;
  }
}


          regs[idx] = {
            ...regs[idx],
            userId: editUser.value,
            eventId: editEvent.value,
            seed,
            status: editStatus.value,
            agreedAt: (editAgreedAt.value || regs[idx].agreedAt || ""),
            teamName: isTeam ? teamName : "",
            memberIds: isTeam ? memberIds : null,
            updatedAt: nowISO(),
          };

          saveRegs(regs);
          editMsg.textContent = "Salvo!";
          closeModal();
          redraw();
        });

        function bindRowActions() {
          viewRoot.querySelectorAll("[data-reg-approve]").forEach((b) => {
            b.onclick = () => {
              setRegStatus(b.getAttribute("data-reg-approve"), "Aprovado");
              regMsg.textContent = "Inscrição aprovada.";
              redraw();
            };
          });

          viewRoot.querySelectorAll("[data-reg-pending]").forEach((b) => {
            b.onclick = () => {
              setRegStatus(b.getAttribute("data-reg-pending"), "Pendente");
              regMsg.textContent = "Inscrição marcada como Pendente.";
              redraw();
            };
          });

          viewRoot.querySelectorAll("[data-reg-del]").forEach((b) => {
            b.onclick = () => {
              deleteReg(b.getAttribute("data-reg-del"));
              regMsg.textContent = "Inscrição excluída.";
              redraw();
            };
          });

          viewRoot.querySelectorAll("[data-reg-edit]").forEach((b) => {
            b.onclick = () => {
              const id = b.getAttribute("data-reg-edit");
              const reg = loadRegs().find((r) => r.id === id);
              if (reg) openModal(reg);
            };
          });
        }

        function redraw() {
          const regs = loadRegs();
          const users = loadUsers();
          const events = loadEvents();

          const q = (regSearch.value || "").trim().toLowerCase();
          const evId = regFilterEvent.value || "";

          const filtered = regs.filter((r) => {
            if (evId && r.eventId !== evId) return false;
            const u = users.find((x) => x.id === r.userId);
            const name = (u ? participantLabel(null, u.id) : "").toLowerCase();
            const login = (u?.login || "").toLowerCase();
            if (q && !(name.includes(q) || login.includes(q))) return false;
            return true;
          });

          
const rows = filtered
  .slice()
  .sort((a, b) => {
    const mode = regSort ? (regSort.value || "recent") : "recent";
    if (mode === "seedAsc") {
      const sa = a.seed != null && a.seed !== "" ? Number(a.seed) : 9999;
      const sb = b.seed != null && b.seed !== "" ? Number(b.seed) : 9999;
      if (sa !== sb) return sa - sb;
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    }
    if (mode === "seedDesc") {
      const sa = a.seed != null && a.seed !== "" ? Number(a.seed) : -1;
      const sb = b.seed != null && b.seed !== "" ? Number(b.seed) : -1;
      if (sa !== sb) return sb - sa;
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    }
    if (mode === "nameAsc") {
      const ua = users.find((x) => x.id === a.userId);
      const ub = users.find((x) => x.id === b.userId);
      const na = (ua ? participantLabel(null, ua.id) : "").toLowerCase();
      const nb = (ub ? participantLabel(null, ub.id) : "").toLowerCase();
      const c = na.localeCompare(nb);
      if (c !== 0) return c;
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    }
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  })
  .map((r) => {
              const u = users.find((x) => x.id === r.userId);
              const e = events.find((x) => x.id === r.eventId);

              const userLabel = u ? participantLabel(null, u.id) : "(usuário removido)";
              const eventLabel = e ? e.title : "(evento removido)";

              return `
                <tr>
                  <td>${esc(userLabel)}</td>
                  <td>${esc(eventLabel)}</td>
                  <td>${regStatusPill(r.status || "Pendente")}</td>
                  <td>${esc(r.seed ?? "")}</td>
                  <td>${esc(r.agreedAt || "")}</td>
                  <td style="white-space:nowrap;">
                    <button class="btn2" data-reg-approve="${r.id}">Aprovar</button>
                    <button class="btn2" data-reg-pending="${r.id}">Pendente</button>
                    <button class="btn2" data-reg-edit="${r.id}">Editar</button>
                    <button class="btn2" data-reg-del="${r.id}">Excluir</button>
                  </td>
                </tr>
              `;
            })
            .join("");

          tbody.innerHTML =
            rows ||
            `<tr><td colspan="6" class="muted" style="padding:10px;">Nenhuma inscrição.</td></tr>`;

          bindRowActions();
        }

        regSearch.addEventListener("input", redraw);
        regFilterEvent.addEventListener("change", ()=>{
          const evId = (regFilterEvent.value || "").trim();
          if(evId) setLastEventId(evId);
          redraw();
          syncSeedBulkButton();
        });
        if (regSort) regSort.addEventListener("change", redraw);

        bindRowActions();
        syncSeedBulkButton();
        redraw();

      } else if (key === "resultados") {
        viewTitle.textContent = "Gerenciar Resultados";
        viewRoot.innerHTML = renderAdminResultados();

        const resEvent = document.getElementById("resEvent");
        const resRound = document.getElementById("resRound");
        const resSearch = document.getElementById("resSearch");
        const resTbody = document.getElementById("resTbody");
        const resMsg = document.getElementById("resMsg");
        const btnResRefresh = document.getElementById("btnResRefresh");
        const btnResResolveByes = document.getElementById("btnResResolveByes");
        const btnResSummary = document.getElementById("btnResSummary");

        const modal = document.getElementById("matchModal");
        const modalClose = document.getElementById("matchModalClose");
        const mId = document.getElementById("mId");
        const mWhen = document.getElementById("mWhen");
        const mMd = document.getElementById("mMd");
        const mScoreA = document.getElementById("mScoreA");
        const mScoreB = document.getElementById("mScoreB");
        const mWO = document.getElementById("mWO");
        const mStatus = document.getElementById("mStatus");
        const mWinner = document.getElementById("mWinner");
        const btnMatchSave = document.getElementById("btnMatchSave");
        const btnMatchValidate = document.getElementById("btnMatchValidate");
        const btnMatchReactivate = document.getElementById("btnMatchReactivate");
        const matchMsg = document.getElementById("matchMsg");

        function closeModal(){ modal.style.display = "none"; }
        modalClose.addEventListener("click", closeModal);
        modal.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });

        function openModal(ev, match){
          matchMsg.textContent = "";
          mId.value = match.id;
          mWhen.value = formatDTLocal(match.scheduledAt || "");
          mMd.value = match.md || "MD3";
          mScoreA.value = String(Number(match.scoreA || 0));
          mScoreB.value = String(Number(match.scoreB || 0));
          mWO.value = (match.status === "WO" && match.winnerId) ? "" : (match.wo || "");
          mStatus.value = match.status || "Não agendada";

          const w = match.winnerId ? participantLabel(ev, match.winnerId) : "";
          mWinner.value = w;

          modal.style.display = "block";
        }

        function getSelectedEvent(){
          const id = resEvent.value || "";
          if(!id) return null;
          return loadEvents().find(e=>e.id===id) || null;
        }

        function getMatchesForSelected(){
          const ev = getSelectedEvent();
          if(!ev) return [];
          return loadMatches().filter(m=>m.eventId===ev.id);
        }

        function redraw(){
          const ev = getSelectedEvent();
          if(btnResSummary) btnResSummary.disabled = !(ev && ev.results && ev.results.standings && ev.results.standings.length);
          if(!ev){
            resTbody.innerHTML = `<tr><td colspan="9" class="muted" style="padding:10px;">Selecione um evento.</td></tr>`;
            return;
          }

          const round = resRound.value || "";
          const q = (resSearch.value || "").trim().toLowerCase();

          let ms = getMatchesForSelected();

          if(round) ms = ms.filter(m=>m.round===round);

          ms = ms.slice().sort((a,b)=>{
            const order = (x)=> {
              const map = { "R64":64,"R32":32,"R16":16,"R8":8,"R4":4,"R2":2 };
              return map[x.round] || 999;
            };
            const d = order(a) - order(b);
            if(d !== 0) return d;
            return (a.index||0) - (b.index||0);
          });

          if(q){
            ms = ms.filter(m=>{
              const a = m.participantAId ? participantLabel(ev, m.participantAId).toLowerCase() : "";
              const b = m.participantBId ? participantLabel(ev, m.participantBId).toLowerCase() : "";
              const code = (m.code||"").toLowerCase();
              return code.includes(q) || a.includes(q) || b.includes(q);
            });
          }

          const rows = ms.map(m=>{
            const aName = m.participantAId ? participantLabel(ev, m.participantAId) : "—";
            const bName = m.participantBId ? participantLabel(ev, m.participantBId) : "—";
            const aSeed = m.seedA ? ` <span class="muted small">(#${m.seedA})</span>` : "";
            const bSeed = m.seedB ? ` <span class="muted small">(#${m.seedB})</span>` : "";
            const when = m.scheduledAt ? prettyWhen(m.scheduledAt) : "—";
            const score = (m.participantAId && m.participantBId) ? `${Number(m.scoreA||0)}–${Number(m.scoreB||0)}` : "—";
            return `
              <tr>
                <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(m.round||"")}</td>
                <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(m.code||"")}</td>
                <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${playerNameHtmlInMatch(m, m.participantAId, aName)}${aSeed}</td>
                <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${playerNameHtmlInMatch(m, m.participantBId, bName)}${bSeed}</td>
                <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(when)}</td>
                <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(m.md||"")}</td>
                <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${esc(score)}</td>
                <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08);">${matchStatusPill(m.status||"")}</td>
                <td style="padding:10px; border-bottom:1px solid rgba(255,255,255,.08); white-space:nowrap;">
                  <button class="btn2" data-m-edit="${m.id}">Editar</button>
                  <button class="btn2 primary" data-m-val="${m.id}">Validar</button>
                </td>
              </tr>
            `;
          }).join("");

          resTbody.innerHTML = rows || `<tr><td colspan="9" class="muted" style="padding:10px;">Nenhuma partida.</td></tr>`;

          // binds
          viewRoot.querySelectorAll("[data-m-edit]").forEach(b=>{
            b.onclick = ()=>{
              const id = b.getAttribute("data-m-edit");
              const mm = loadMatches().find(x=>x.id===id);
              const ev2 = getSelectedEvent();
              if(mm && ev2) openModal(ev2, mm);
            };
          });

          viewRoot.querySelectorAll("[data-m-val]").forEach(b=>{
            b.onclick = ()=>{
              const id = b.getAttribute("data-m-val");
              validateMatchById(id);
            };
          });
        }

        function persistMatches(mutator){
          const ev = getSelectedEvent();
          if(!ev) return null;
          const all = loadMatches();
          const mine = all.filter(m=>m.eventId===ev.id);
          const others = all.filter(m=>m.eventId!==ev.id);
          const updatedMine = mutator(mine.slice());
          if(!updatedMine) return null;
          saveMatches([...others, ...updatedMine]);
          return updatedMine;
        }

        function validateMatchById(id){
          const ev = getSelectedEvent();
          if(!ev) return;

          const updatedMine = persistMatches((mine)=>{
            const m = mine.find(x=>x.id===id);
            if(!m) return mine;

            if(!m.participantAId || !m.participantBId){
              resMsg.textContent = "Não é possível validar: partida sem dois participantes (provavelmente BYE).";
              return mine;
            }

            const a = Number(m.scoreA || 0);
            const b = Number(m.scoreB || 0);

            if(a === b){
              resMsg.textContent = "Placar empatado. Ajuste antes de validar.";
              return mine;
            }

            const winnerId = (a > b) ? m.participantAId : m.participantBId;
            const winnerSeed = (a > b) ? (m.seedA ?? null) : (m.seedB ?? null);

            m.winnerId = winnerId;
            m.winnerSeed = winnerSeed;
            m.status = "Validada";
            m.validatedAt = nowISO();
            m.updatedAt = nowISO();

            propagateWinner(mine, m);
            ensureCascadeByes(ev.id, mine);
            markEventStarted(ev.id);

            // Se for a FINAL, fecha o evento automaticamente (pontos/premiação)
            if(m.round === "R2"){
              const evAfter = finalizeEventIfFinal(ev.id, m, mine) || ev;
              if(evAfter && String(evAfter.status||"").toLowerCase().includes("concl")){
                resMsg.textContent = "Final validada. Evento concluído (pontos e premiação aplicados).";
              } else {
                resMsg.textContent = "Partida validada e vencedor avançou.";
              }
            } else {
              resMsg.textContent = "Partida validada e vencedor avançou.";
            }
            return mine;
          });

          if(updatedMine) redraw();
        }

        btnMatchSave.addEventListener("click", ()=>{
          const ev = getSelectedEvent();
          if(!ev) return;
          matchMsg.textContent = "";

          persistMatches((mine)=>{
            const m = mine.find(x=>x.id===mId.value);
            if(!m) return mine;

            const when = (mWhen.value || "").trim();
            m.scheduledAt = when ? new Date(when).toISOString() : "";
            m.md = mMd.value || m.md || "MD3";
            m.scoreA = Number((mScoreA.value||"0").replace(/[^\d-]/g,"")) || 0;
            m.scoreB = Number((mScoreB.value||"0").replace(/[^\d-]/g,"")) || 0;
            m.status = mStatus.value || m.status || "Não agendada";
            m.updatedAt = nowISO();

            // reset winner display (só muda ao validar)
            mWinner.value = m.winnerId ? participantLabel(ev, m.winnerId) : "";
            matchMsg.textContent = "Salvo.";
            return mine;
          });

          redraw();
        });

        btnMatchReactivate.addEventListener("click", ()=>{
          const ev = getSelectedEvent();
          if(!ev) return;
          matchMsg.textContent = "";

          persistMatches((mine)=>{
            const m = mine.find(x=>x.id===mId.value);
            if(!m) return mine;

            m.status = "Agendada";
            m.scoreA = 0;
            m.scoreB = 0;
            m.winnerId = null;
            m.winnerSeed = null;
            m.validatedAt = "";
            m.updatedAt = nowISO();
            // NÃO limpamos participantA/B, só “reabre”
            matchMsg.textContent = "Reativada. Agora ajuste horário/MD e valide novamente quando concluir.";
            return mine;
          });

          redraw();
        });

        btnMatchValidate.addEventListener("click", ()=>{
          const ev = getSelectedEvent();
          if(!ev) return;
          matchMsg.textContent = "";

          persistMatches((mine)=>{
            const m = mine.find(x=>x.id===mId.value);
            if(!m) return mine;

            if(!m.participantAId || !m.participantBId){
              matchMsg.textContent = "Não dá pra validar sem dois participantes (provavelmente BYE).";
              return mine;
            }

            const wo = mWO.value || "";
            let winnerId = null;
            let winnerSeed = null;

            if(wo === "A"){
              winnerId = m.participantBId;
              winnerSeed = m.seedB ?? null;
              m.status = "WO";
            } else if(wo === "B"){
              winnerId = m.participantAId;
              winnerSeed = m.seedA ?? null;
              m.status = "WO";
            } else {
              const a = Number((mScoreA.value||"0").replace(/[^\d-]/g,"")) || 0;
              const b = Number((mScoreB.value||"0").replace(/[^\d-]/g,"")) || 0;
              if(a === b){
                matchMsg.textContent = "Placar empatado. Ajuste antes de validar.";
                return mine;
              }
              winnerId = (a > b) ? m.participantAId : m.participantBId;
              winnerSeed = (a > b) ? (m.seedA ?? null) : (m.seedB ?? null);
              m.status = "Validada";
              m.scoreA = a;
              m.scoreB = b;
            }

            m.winnerId = winnerId;
            m.winnerSeed = winnerSeed;
            m.validatedAt = nowISO();
            m.updatedAt = nowISO();

            propagateWinner(mine, m);
            ensureCascadeByes(ev.id, mine);
            markEventStarted(ev.id);

            // Se for a FINAL, fecha o evento automaticamente (pontos/premiação)
            if(m.round === "R2"){
              const evAfter = finalizeEventIfFinal(ev.id, m, mine) || ev;
              if(evAfter && String(evAfter.status||"").toLowerCase().includes("concl")){
                matchMsg.textContent = "Final validada. Evento concluído!";
                resMsg.textContent = "Final validada. Evento concluído (pontos e premiação aplicados).";
              } else {
                matchMsg.textContent = "Validado e avançou!";
                resMsg.textContent = "Partida validada e vencedor avançou.";
              }
            } else {
              matchMsg.textContent = "Validado e avançou!";
              resMsg.textContent = "Partida validada e vencedor avançou.";
            }

            mWinner.value = participantLabel(ev, winnerId);
            return mine;
          });

          redraw();
        });

        btnResRefresh.addEventListener("click", redraw);

        btnResResolveByes.addEventListener("click", ()=>{
          const ev = getSelectedEvent();
          if(!ev) return;
          persistMatches((mine)=>{
            ensureCascadeByes(ev.id, mine);
            resMsg.textContent = "BYEs resolvidos.";
            return mine;
          });
          redraw();
        });

        
        if(btnResSummary){
          btnResSummary.addEventListener("click", ()=>{
            const ev = getSelectedEvent();
            if(ev) openResSummaryModal(ev);
          });
        }

resEvent.addEventListener("change", ()=>{
          const evId = (resEvent.value || "").trim();
          if(evId) setLastEventId(evId);
          resMsg.textContent = "";
          redraw();
        });
        resRound.addEventListener("change", redraw);
        resSearch.addEventListener("input", redraw);

        // auto: se tiver 1 evento só, seleciona
        const opts = resEvent.querySelectorAll("option");
        if(opts.length === 2){
          resEvent.value = opts[1].value;
          setLastEventId(resEvent.value);
        }
        redraw();

      } else {
        viewTitle.textContent = "Admin";
        viewRoot.innerHTML = renderAdminHome();
      }
    }

    // ---------- Entry ----------
    if (user.accessLevel === "admin") {
      adminSidebar.style.display = "";
      userSidebar.style.display = "none";
      setViewAdmin("");

      adminSidebar.querySelectorAll("[data-admin]").forEach((tile) => {
        tile.addEventListener("click", () =>
          setViewAdmin(tile.getAttribute("data-admin"))
        );
      });
    } else {
      userSidebar.style.display = "";
      adminSidebar.style.display = "none";
      setViewUser("meus-dados");

      userSidebar.querySelectorAll("[data-view]").forEach((it) => {
        it.addEventListener("click", () => setViewUser(it.getAttribute("data-view")));
      });

      const mdDot = userSidebar.querySelector(
        '[data-view="meus-dados"] .notify-dot'
      );
      if (mdDot) {
        mdDot.classList.toggle("warn", !(user.profile && user.profile.completed));
        mdDot.classList.toggle("ok", !!(user.profile && user.profile.completed));
      }
    }
  }

  window.LBI_APP = {
    bootLoginPage,
    bootAppPage,
  };
})();
