/* Bracket público - lê dados do KV (SQLite via /api/kv/*) */
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
  if (format === "MD3") return 2;
  if (format === "MD5") return 3;
  if (format === "MD7") return 4;
  return 2;
}

function computeWinner(m){
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
  if (Math.max(a,b) !== need) return ""; // ainda não finalizado
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

async function init(){
  const events = (await fetchKV("lbi_events")) || [];
  const users  = (await fetchKV("lbi_users")) || [];
  const matchesAll = (await fetchKV("lbi_matches")) || [];

  const nameOf = (id)=>{
    const u = users.find(x=>x.id===id);
    const nm = (u?.profile?.fullName || "").trim();
    return nm ? `${u.username} (${nm})` : (u?.username || "—");
  };

  const sel = $("evt");
  sel.innerHTML = events.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("");
  if (!sel.value && events[0]) sel.value = events[0].id;

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
        format: m.format || m.bestOf || "MD3"
      }))
      .sort((a,b)=>{
        const order = {R32:1,R16:2,QF:3,SF:4,F:5};
        return (order[a.phase]||99)-(order[b.phase]||99) || String(a.id||"").localeCompare(String(b.id||""), undefined, {numeric:true});
      });

    const buckets = {R32:[],R16:[],QF:[],SF:[],F:[]};
    for (const m of matches){
      if (buckets[m.phase]) buckets[m.phase].push(m);
    }

    const renderBucket = (list)=>{
      return list.map(m=>{
        const w = computeWinner(m);
        const aName = m.playerAId ? nameOf(m.playerAId) : "—";
        const bName = m.playerBId ? nameOf(m.playerBId) : "—";
        const aScore = (m.isWO ? "WO" : (m.scoreA ?? ""));
        const bScore = (m.isWO ? "WO" : (m.scoreB ?? ""));
        const img = draftImgUrl(m.draftId || m.draft_img || "");
        const status = m.isBye ? "BYE" : (w ? "Finalizado" : "Pendente");
        return `
          <div class="match">
            <div class="mid">
              <div><span class="badge">${esc(m.id||"")}</span> <span class="mut">${esc(m.format||"")}</span></div>
              <div class="mut">${esc(status)}</div>
            </div>
            <div class="rowp"><span class="name ${w===m.playerAId?"":"mut"}">${esc(aName)}</span><span>${esc(aScore)}</span></div>
            <div class="rowp"><span class="name ${w===m.playerBId?"":"mut"}">${esc(bName)}</span><span>${esc(bScore)}</span></div>
            ${img ? `<div style="margin-top:8px"><a class="a" href="${img}" target="_blank" rel="noreferrer">Abrir imagem do draft</a></div>` : ""}
          </div>
        `;
      }).join("");
    };

    $("c_r32").innerHTML = renderBucket(buckets.R32);
    $("c_r16").innerHTML = renderBucket(buckets.R16);
    $("c_qf").innerHTML  = renderBucket(buckets.QF);
    $("c_sf").innerHTML  = renderBucket(buckets.SF);
    $("c_f").innerHTML   = renderBucket(buckets.F);
  }

  sel.onchange = render;
  $("reload").onclick = ()=>location.reload();

  render();
}

init().catch(err=>{
  console.error(err);
  $("sub").textContent = "Erro ao carregar dados. Verifique se o servidor está rodando.";
});
