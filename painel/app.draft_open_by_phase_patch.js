// LBI Draft Link Patch v3 (não depende de ids/data-attrs)
// Inclua APÓS app.js e ANTES do bootAppPage() no painel/app.html
// Objetivo: fazer o botão "Abrir Draft" abrir SEMPRE com matchId/eventId/round.
(function(){
  const LS_LAST = 'lbi_last_draft_match_code';

  function lsGet(k, fb){
    try{ const v = localStorage.getItem(k); return v? JSON.parse(v): fb; }catch(e){ return fb; }
  }
  function lsSet(k, v){
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){}
  }

  function findEventIdForMatch(m){
    const eid = m?.eventId || m?.event_id;
    if(eid) return String(eid);
    const evs = lsGet('lbi_events', []);
    const title = (m?.eventTitle || m?.eventName || m?.event || m?.event_title || '').trim();
    if(!title) return '';
    const ev = evs.find(e => String(e.id)===String(title)) || evs.find(e => (e.title||e.name||'').trim()===title);
    return ev ? String(ev.id) : '';
  }

  function inferRound(m){
    return String(m?.round || m?.phase || m?.fase || '').toUpperCase();
  }

  function findMatchByCode(code){
    const matches = lsGet('lbi_matches', []);
    const s = String(code||'').trim();
    if(!s) return null;
    return (
      matches.find(x => String(x.id||'')===s) ||
      matches.find(x => String(x.matchId||'')===s) ||
      matches.find(x => String(x.code||'')===s)
    ) || null;
  }

  function scanDomForMatchCode(root){
    const txt = (root?.innerText || root?.textContent || '') + '';
    // captura padrões tipo R4-02, R32-01
    const m = txt.match(/\bR\d{1,2}-\d{2}\b/);
    return m ? m[0] : '';
  }

  function findOpenModalRoot(){
    // tenta achar o modal visível (fallbacks)
    const candidates = [
      document.querySelector('.modal.open, .modal.is-open, .modal.show'),
      document.querySelector('[role="dialog"]'),
      document.querySelector('.dialog, .overlay .card, .overlay')
    ].filter(Boolean);
    return candidates[0] || document.body;
  }

  function getCurrentMatchFromUI(){
    const root = findOpenModalRoot();
    const code = scanDomForMatchCode(root) || scanDomForMatchCode(document.body);
    if(code){
      lsSet(LS_LAST, code);
      return findMatchByCode(code);
    }
    // fallback: último salvo
    const last = lsGet(LS_LAST, '');
    if(last) return findMatchByCode(last);
    return null;
  }

  function buildHref(m){
    const qs = new URLSearchParams();
    const eid = findEventIdForMatch(m);
    const mid = m?.id ?? m?.matchId ?? m?.match_id ?? m?.code ?? '';
    const round = inferRound(m);

    if(eid) qs.set('eventId', String(eid));
    if(mid) qs.set('matchId', String(mid));
    if(round) qs.set('round', String(round));

    // caso round não exista no match, tenta inferir pelo código (Rxx-yy => Rxx)
    if(!round && typeof mid==='string' && /^R\d{1,2}-\d{2}$/.test(mid)){
      qs.set('round', mid.split('-')[0]);
    }

    return `./draft.html?${qs.toString()}`;
  }

  function ensureDraftLink(){
    const m = getCurrentMatchFromUI();
    if(!m) return;

    // tenta setar em <a> se existir
    const a = Array.from(document.querySelectorAll('a')).find(el => (el.textContent||'').trim().toLowerCase()==='abrir draft');
    if(a){
      a.href = buildHref(m);
      a.setAttribute('data-lbi-draft-ready','1');
      return;
    }
    // caso seja button
    const b = Array.from(document.querySelectorAll('button')).find(el => (el.textContent||'').trim().toLowerCase()==='abrir draft');
    if(b){
      b.setAttribute('data-lbi-draft-href', buildHref(m));
      b.setAttribute('data-lbi-draft-ready','1');
    }
  }

  // sempre que clicar em qualquer "Abrir" (matchroom), tentamos capturar o código da partida no modal
  document.addEventListener('click', (e)=>{
    const t = e.target?.closest?.('button, a');
    if(!t) return;
    const label = (t.textContent||'').trim().toLowerCase();
    if(label==='abrir' || label==='check-in' || label==='editar' || label==='validar'){
      setTimeout(ensureDraftLink, 0);
      setTimeout(ensureDraftLink, 80);
      setTimeout(ensureDraftLink, 200);
    }
  }, true);

  // intercepta clique no Abrir Draft e força navegação correta
  document.addEventListener('click', (e)=>{
    const el = e.target?.closest?.('a, button');
    if(!el) return;
    if(((el.textContent||'').trim().toLowerCase()) !== 'abrir draft') return;

    const m = getCurrentMatchFromUI();
    if(!m) return; // deixa seguir (vai cair no fallback do draft, mas não trava)

    const href = el.getAttribute('href') || el.getAttribute('data-lbi-draft-href') || buildHref(m);
    if(href && href.includes('draft.html?')){
      e.preventDefault();
      location.href = href;
    }
  }, true);

  // observer pra quando o modal renderizar depois do clique
  const mo = new MutationObserver(()=> ensureDraftLink());
  mo.observe(document.documentElement, {subtree:true, childList:true});
})();
