/* Bracket público (v2) - layout estilo "pills" com linhas conectando rounds */
const $ = (id)=>document.getElementById(id);

function esc(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function normalizePhase(raw){
  const p = String(raw||"").trim().toUpperCase();
  if (!p) return "";
  if (p === "R32") return "R32";
  if (p === "R16") return "R16";
  if (p === "QF") return "QF";
  if (p === "SF") return "SF";
  if (p === "F") return "F";
  return p;
}

function winsNeeded(format){
  const f = String(format||"").toUpperCase();
  if (f === "MD1") return 1;
  if (f === "MD2") return 2;
  if (f === "MD3") return 2;
  if (f === "MD5") return 3;
  if (f === "MD7") return 4;
  return 2;
}

function computeWinner(m){
  // BYE -> winner é o jogador existente
  if (m?.isBye){
    if (m.playerAId && !m.playerBId) return m.playerAId;
    if (m.playerBId && !m.playerAId) return m.playerBId;
    return "";
  }
  if (!m?.playerAId || !m?.playerBId) return "";
  if (m.isWO){
    if (m.woWinner === "A") return m.playerAId;
    if (m.woWinner === "B") return m.playerBId;
    return "";
  }
  const a = Number(m.scoreA);
  const b = Number(m.scoreB);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return "";
  const need = winsNeeded(m.format || "MD3");
  if (Math.max(a,b) !== need) return "";
  return (a>b) ? m.playerAId : m.playerBId;
}

function draftImgUrl(draftId){
  const id = String(draftId||"").trim();
  if (!id) return "";
  return `https://raw.githubusercontent.com/lbiaoe4/draftimgs/refs/heads/main/${encodeURIComponent(id)}.jpg`;
}

async function fetchKV(key){
  const r = await fetch(`/api/kv/${encodeURIComponent(key)}`, {cache:"no-store"});
  if (!r.ok) return null;
  const j = await r.json();
  try { return JSON.parse(j.value); } catch { return null; }
}

function idNum(mid){
  const m = String(mid||"").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function inferNext(mid){
  // Padrão Top32:
  // M01-16 -> M17-24
  // M17-24 -> M25-28
  // M25-28 -> M29-30
  // M29-30 -> M31
  const n = idNum(mid);
  if (n>=1 && n<=16){
    const next = 17 + Math.floor((n-1)/2);
    const slot = ((n-1)%2===0) ? "A" : "B";
    return { nextId: `M${String(next).padStart(2,'0')}`, slot };
  }
  if (n>=17 && n<=24){
    const next = 25 + Math.floor((n-17)/2);
    const slot = ((n-17)%2===0) ? "A" : "B";
    return { nextId: `M${String(next).padStart(2,'0')}`, slot };
  }
  if (n>=25 && n<=28){
    const next = 29 + Math.floor((n-25)/2);
    const slot = ((n-25)%2===0) ? "A" : "B";
    return { nextId: `M${String(next).padStart(2,'0')}`, slot };
  }
  if (n>=29 && n<=30){
    return { nextId: "M31", slot: (n===29?"A":"B") };
  }
  return { nextId: "", slot: "" };
}

function phaseRoundIdx(phase){
  return ({R32:0,R16:1,QF:2,SF:3,F:4})[phase] ?? 99;
}

function roundMeta(){
  return [
    { key:"R32", label:"R32" },
    { key:"R16", label:"R16" },
    { key:"QF",  label:"Quartas" },
    { key:"SF",  label:"Semis" },
    { key:"F",   label:"Final" },
  ];
}

function buildLayout(rounds){
  // Calcula posições por round, centrando rounds posteriores no meio dos anteriores
  const meta = roundMeta();

  const matchH = 86; // altura da pill
  const gapY = 18;

  const pos = new Map(); // matchId -> {x,y}
  const r0 = rounds.R32;
  // Round base: cada partida em sequência
  for (let i=0;i<r0.length;i++){
    pos.set(r0[i].id, { rx:0, x:0, y: i*(matchH+gapY) });
  }

  // Para cada round seguinte, y = média dos dois jogos que alimentam
  function setFromPrev(prevKey, curKey){
    const prev = rounds[prevKey];
    const cur  = rounds[curKey];

    // mapa para achar por índice
    for (let j=0;j<cur.length;j++){
      // filhos: 2*j e 2*j+1 no round anterior
      const left = prev[2*j];
      const right = prev[2*j+1];
      const y1 = left ? pos.get(left.id)?.y : (2*j)*(matchH+gapY);
      const y2 = right ? pos.get(right.id)?.y : (2*j+1)*(matchH+gapY);
      const y = ((y1 ?? 0) + (y2 ?? 0))/2;
      pos.set(cur[j].id, { rx: phaseRoundIdx(curKey), x:0, y });
    }
  }

  setFromPrev("R32","R16");
  setFromPrev("R16","QF");
  setFromPrev("QF","SF");
  setFromPrev("SF","F");

  // altura total
  const last = r0.length ? pos.get(r0[r0.length-1].id) : {y:0};
  const totalH = (last?.y ?? 0) + matchH;

  return { pos, matchH, totalH, meta };
}

function renderLabels(canvas){
  const labels = $("labels");
  const meta = roundMeta();
  labels.innerHTML = meta.map(m=>`<div class="lbl">${esc(m.label)}</div>`).join("");

  // Ajusta largura total do canvas para caber as colunas
  const colW = parseInt(getComputedStyle(canvas).getPropertyValue('--colW')) || 260;
  const gap  = parseInt(getComputedStyle(canvas).getPropertyValue('--gap')) || 140;
  canvas.style.minWidth = `${meta.length*colW + (meta.length-1)*gap + 44}px`;
}

function setCanvasSize(canvas, totalH){
  const padTop = 22 + 52; // padding + labels block approx
  canvas.style.minHeight = `${Math.max(420, totalH + padTop + 40)}px`;

  const svg = $("lines");
  svg.setAttribute("width", canvas.scrollWidth);
  svg.setAttribute("height", canvas.scrollHeight);
  svg.setAttribute("viewBox", `0 0 ${canvas.scrollWidth} ${canvas.scrollHeight}`);
}

function drawLines(canvas, layout, connections){
  const svg = $("lines");
  svg.innerHTML = "";

  const colW = parseInt(getComputedStyle(canvas).getPropertyValue('--colW')) || 260;
  const gap  = parseInt(getComputedStyle(canvas).getPropertyValue('--gap')) || 140;

  // offset de conteúdo dentro do canvas
  const labels = $("labels");
  const topOff = labels.offsetHeight + 18; // espaço após labels
  const leftOff = 0;

  for (const c of connections){
    const a = layout.pos.get(c.from);
    const b = layout.pos.get(c.to);
    if (!a || !b) continue;

    const ax = leftOff + a.rx*(colW+gap) + colW;
    const ay = topOff + a.y + layout.matchH/2;

    const bx = leftOff + b.rx*(colW+gap);
    const by = topOff + b.y + layout.matchH/2;

    const midX = ax + (gap*0.55);

    // path: horizontal -> vertical -> horizontal
    const d = `M ${ax} ${ay} L ${midX} ${ay} L ${midX} ${by} L ${bx} ${by}`;
    const p = document.createElementNS("http://www.w3.org/2000/svg","path");
    p.setAttribute("d", d);
    p.setAttribute("class", `line${c.done?" done":""}`);
    svg.appendChild(p);
  }
}

function renderMatches(canvas, matches, users, eventId){
  const box = $("matches");
  box.innerHTML = "";

  const nameOf = (id)=>{
    const u = users.find(x=>x.id===id);
    const nm = (u?.profile?.fullName || "").trim();
    return nm ? `${u.username} (${nm})` : (u?.username || "—");
  };

  // Organiza rounds fixos
  const rounds = {
    R32: matches.filter(m=>m.phase==="R32").sort((a,b)=>idNum(a.id)-idNum(b.id)),
    R16: matches.filter(m=>m.phase==="R16").sort((a,b)=>idNum(a.id)-idNum(b.id)),
    QF:  matches.filter(m=>m.phase==="QF").sort((a,b)=>idNum(a.id)-idNum(b.id)),
    SF:  matches.filter(m=>m.phase==="SF").sort((a,b)=>idNum(a.id)-idNum(b.id)),
    F:   matches.filter(m=>m.phase==="F").sort((a,b)=>idNum(a.id)-idNum(b.id)),
  };

  const layout = buildLayout(rounds);
  const colW = parseInt(getComputedStyle(canvas).getPropertyValue('--colW')) || 260;
  const gap  = parseInt(getComputedStyle(canvas).getPropertyValue('--gap')) || 140;
  const labels = $("labels");
  const topOff = labels.offsetHeight + 18;

  // Render elements
  const all = [...rounds.R32, ...rounds.R16, ...rounds.QF, ...rounds.SF, ...rounds.F];

  for (const m of all){
    const w = computeWinner(m);
    const status = m.isBye ? "BYE" : (w ? "Finalizado" : "Pendente");
    const dotClass = m.isBye ? "bye" : (w ? "" : "pending");

    const aName = m.playerAId ? nameOf(m.playerAId) : "—";
    const bName = m.playerBId ? nameOf(m.playerBId) : "—";

    const aScore = (m.isWO ? "WO" : (m.scoreA ?? ""));
    const bScore = (m.isWO ? "WO" : (m.scoreB ?? ""));

    const img = draftImgUrl(m.draftId || m.draft_img || "");

    const cls = ["matchPill", w?"done":"pending", m.isBye?"bye":""].filter(Boolean).join(" ");

    const div = document.createElement("div");
    div.className = cls;
    div.id = `match_${m.id}`;

    div.innerHTML = `
      <div class="pillTop">
        <span class="tag"><span class="dot ${dotClass}"></span> ${esc(m.id)} • ${esc(m.format||"MD3")}</span>
        <span class="mut" style="font-size:11px">${esc(status)}</span>
      </div>
      <div class="row ${w===m.playerAId?"winner":"muted"}">
        <div class="name">${esc(aName)}</div>
        <div class="score">${esc(String(aScore))}</div>
      </div>
      <div class="row ${w===m.playerBId?"winner":"muted"}">
        <div class="name">${esc(bName)}</div>
        <div class="score">${esc(String(bScore))}</div>
      </div>
      ${img ? `<div class="draftLink"><a href="${img}" target="_blank" rel="noreferrer">imagem do draft</a></div>` : ""}
    `;

    const p = layout.pos.get(m.id);
    const rx = phaseRoundIdx(m.phase);
    const x = rx*(colW+gap);
    const y = topOff + (p?.y ?? 0);

    div.style.left = `${x}px`;
    div.style.top = `${y}px`;

    box.appendChild(div);
  }

  // Connections
  const connections = [];
  for (const m of all){
    const inferred = inferNext(m.id);
    const nextId = m.nextMatchId || m.nextId || m.next || inferred.nextId;
    const done = !!computeWinner(m);
    if (nextId){
      connections.push({from:m.id,to:nextId,done});
    }
  }

  // Resize + draw lines
  setCanvasSize(canvas, layout.totalH);
  drawLines(canvas, layout, connections);
}

async function init(){
  const events = (await fetchKV("lbi_events")) || [];
  const users  = (await fetchKV("lbi_users")) || [];
  const matchesAll = (await fetchKV("lbi_matches")) || [];

  const sel = $("evt");
  sel.innerHTML = events.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("");
  if (!sel.value && events[0]) sel.value = events[0].id;

  const canvas = $("canvas");
  renderLabels(canvas);

  async function render(){
    const eventId = sel.value;
    const ev = events.find(e=>e.id===eventId);
    $("sub").textContent = ev ? (ev.status ? `${ev.name} • ${ev.status}` : ev.name) : "";

    const matches = matchesAll
      .filter(m=>m.eventId===eventId)
      .map(m=>({
        ...m,
        phase: normalizePhase(m.phase || m.round || ""),
        playerAId: m.playerAId || m.aUserId || "",
        playerBId: m.playerBId || m.bUserId || "",
        format: (m.format || m.bestOf || "MD3").toUpperCase(),
      }))
      .sort((a,b)=>phaseRoundIdx(a.phase)-phaseRoundIdx(b.phase) || idNum(a.id)-idNum(b.id));

    renderMatches(canvas, matches, users, eventId);
  }

  sel.onchange = render;
  $("reload").onclick = ()=>location.reload();
  window.addEventListener("resize", ()=>render());

  render();
}

init().catch(err=>{
  console.error(err);
  $("sub").textContent = "Erro ao carregar dados. Verifique se o servidor está rodando.";
});
