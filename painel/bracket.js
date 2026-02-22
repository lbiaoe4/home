/* LBI Bracket — MVP (localStorage) */
(function(){
  const LS_EVENTS = 'lbi_events';
  const LS_MATCHES = 'lbi_matches';
  const LS_USERS = 'lbi_users';

  function loadJSON(k, fallback){
    try{ return JSON.parse(localStorage.getItem(k) || fallback); }
    catch{ return JSON.parse(fallback); }
  }
  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  const ROUND_ORDER = ['R64','R32','R16','R8','R4','R2'];

  function safeUserName(id){
    if(!id) return '—';
    const users = loadJSON(LS_USERS, '[]');
    const u = users.find(x=>x.id===id);
    const nick = String(u?.profile?.nickname || '').trim();
    if(nick) return nick;
    const suf = (u?.id ? String(u.id).replace(/[^a-f0-9]/gi,'').slice(0,4) : '0000').toUpperCase();
    return `Jogador-${suf}`;
  }

  function pill(status){
    const s = String(status||'').toLowerCase();
    if(s.includes('bye')) return '<span class="p-pill">BYE</span>';
    if(s.includes('wo')) return '<span class="p-pill warn">WO</span>';
    if(s.includes('valid')) return '<span class="p-pill ok">Validada</span>';
    if(s.includes('aguard')) return '<span class="p-pill">Aguardando</span>';
    return '<span class="p-pill">Agendada</span>';
  }

  function scoreText(m){
    const a = (m.scoreA ?? m.reportedScoreA);
    const b = (m.scoreB ?? m.reportedScoreB);
    if(Number.isFinite(a) && Number.isFinite(b)) return `${a}–${b}`;
    return '—';
  }

  function render(){
    const sel = document.getElementById('brEvent');
    const grid = document.getElementById('brGrid');
    const msg = document.getElementById('brMsg');

    const events = loadJSON(LS_EVENTS, '[]').sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
    const matches = loadJSON(LS_MATCHES, '[]');

    if(!events.length){
      sel.innerHTML = '<option value="">(nenhum evento)</option>';
      grid.innerHTML = '<div class="muted">Nenhum evento cadastrado.</div>';
      return;
    }

    const prev = sel.value;
    sel.innerHTML = events.map(e=>`<option value="${esc(e.id)}">${esc(e.title||'(sem título)')}</option>`).join('');
    if(prev && events.some(e=>e.id===prev)) sel.value = prev;

    const eventId = sel.value || events[0].id;
    sel.value = eventId;

    const evMatches = matches.filter(m=>m.eventId===eventId);
    msg.textContent = evMatches.length ? `${evMatches.length} partidas` : 'sem partidas';

    const byRound = {};
    for(const r of ROUND_ORDER) byRound[r] = [];
    for(const m of evMatches){
      const r = (m.round || '').toUpperCase();
      if(!byRound[r]) byRound[r] = [];
      byRound[r].push(m);
    }
    for(const r of Object.keys(byRound)){
      byRound[r].sort((a,b)=>(a.code||'').localeCompare(b.code||''));
    }

    grid.innerHTML = ROUND_ORDER.map(r=>{
      const list = byRound[r] || [];
      const cards = list.map(m=>{
        const aName = safeUserName(m.participantAId);
        const bName = safeUserName(m.participantBId);
        const st = pill(m.status);
        const sc = scoreText(m);
        const aWin = (m.winnerId && m.winnerId === m.participantAId);
        const bWin = (m.winnerId && m.winnerId === m.participantBId);

        return `
          <div class="mcard">
            <div class="mhead">
              <div class="mcode">${esc(m.code||'')}</div>
              <div class="mmeta">${st}<span class="p-pill">${esc(m.md||'')}</span></div>
            </div>
            <div class="pline">
              <div class="pname ${aWin?'win':''}">${esc(aName)}${m.seedA!=null?` <span class="smallmuted">(#${esc(m.seedA)})</span>`:''}</div>
              <div class="pscore">${esc(sc)}</div>
            </div>
            <div class="pline">
              <div class="pname ${bWin?'win':''}">${esc(bName)}${m.seedB!=null?` <span class="smallmuted">(#${esc(m.seedB)})</span>`:''}</div>
              <div class="pscore">${esc(sc)}</div>
            </div>
          </div>
        `;
      }).join('') || '<div class="muted">—</div>';

      return `
        <div class="br-col">
          <h4>${esc(r)}</h4>
          ${cards}
        </div>
      `;
    }).join('');
  }

  document.getElementById('brRefresh').addEventListener('click', render);
  document.getElementById('brEvent').addEventListener('change', render);

  render();
  setInterval(()=>{
    if(!document.getElementById('brGrid')) return;
    render();
  }, 20000);
})();
