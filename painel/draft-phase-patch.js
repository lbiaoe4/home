// draft.by_phase.v3.js
// Carrega o template correto por fase (R32/R16/R8/R4/R2) e impede fallback errado quando não há matchId.
(function(){
  const LS_LAST = 'lbi_last_draft_match_code';

  function qs(){ return new URLSearchParams(location.search); }
  function q(k){ return qs().get(k) || ''; }

  function lsGet(k, fb){
    try{ const v = localStorage.getItem(k); return v? JSON.parse(v): fb; }catch(e){ return fb; }
  }
  function lsSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

  function findMatch(code){
    const matches = lsGet('lbi_matches', []);
    const s = String(code||'').trim();
    if(!s) return null;
    return (
      matches.find(x => String(x.id||'')===s) ||
      matches.find(x => String(x.matchId||'')===s) ||
      matches.find(x => String(x.code||'')===s)
    ) || null;
  }

  function findEvent(eid){
    const evs = lsGet('lbi_events', []);
    const s = String(eid||'').trim();
    if(!s) return null;
    return evs.find(e => String(e.id)===s) || null;
  }

  function inferRoundFromMatchId(mid){
    if(/^R\d{1,2}-\d{2}$/.test(mid)) return mid.split('-')[0];
    return '';
  }

  function pickTemplateIdForRound(ev, round){
    if(!ev) return '';
    const cfg = ev.draft || ev.draftConfig || {};

    // compat: draftByPhase pode estar em ev.draftByPhase ou cfg.byPhase
    const byPhase = ev.draftByPhase || cfg.byPhase || {};
    if(byPhase && byPhase[round]) return String(byPhase[round]);

    // fallback: template único
    const tid = cfg.templateId || ev.draftTemplateId || '';
    return tid ? String(tid) : '';
  }

  function applyIntoDraftGlobals(ev, m, template){
    // Este patch pressupõe que draft.js expõe algum ponto de entrada.
    // Vamos colocar as infos em window.__LBI_DRAFT_CTX para o draft.js consumir.
    window.__LBI_DRAFT_CTX = {
      eventId: ev?.id || '',
      eventTitle: ev?.title || ev?.name || '',
      matchId: m?.id || m?.code || '',
      round: (m?.round || m?.phase || m?.fase || inferRoundFromMatchId(m?.id||m?.code||'') || '').toUpperCase(),
      md: m?.md || m?.format || '',
      templateId: template?.id || '',
      templateName: template?.name || template?.title || '',
      template
    };
  }

  function main(){
    let matchId = q('matchId');
    const eventId = q('eventId');

    // Se não veio matchId na URL, usa o último capturado pelo painel.
    if(!matchId){
      const last = lsGet(LS_LAST, '');
      if(last) matchId = last;
    }

    // Se ainda não tem matchId, pare aqui e mostre instrução
    if(!matchId){
      console.warn('[draft] matchId ausente. Abra pelo botão "Abrir Draft" dentro da partida.');
      // tenta desenhar um aviso simples sem quebrar a página
      const el = document.querySelector('[data-draft-root]') || document.body;
      const warn = document.createElement('div');
      warn.style.maxWidth='900px';
      warn.style.margin='24px auto';
      warn.style.padding='16px';
      warn.style.border='1px solid rgba(255,255,255,0.15)';
      warn.style.borderRadius='12px';
      warn.style.background='rgba(0,0,0,0.35)';
      warn.innerHTML = '<b>Draft:</b> abra pelo botão <b>"Abrir Draft"</b> dentro da sua partida para carregar a partida correta.';
      el.prepend(warn);
      return;
    }

    // guarda o último
    lsSet(LS_LAST, matchId);

    const m = findMatch(matchId);
    const ev = eventId ? findEvent(eventId) : (m ? findEvent(m.eventId||m.event_id) : null);

    const round = (q('round') || (m?.round||m?.phase||m?.fase) || inferRoundFromMatchId(matchId) || '').toUpperCase();

    // Templates no localStorage
    const templates = lsGet('lbi_draft_templates_v1', []);
    const tid = pickTemplateIdForRound(ev, round);
    const template = templates.find(t => String(t.id)===String(tid)) || templates.find(t => String(t.name||'').toLowerCase().includes('padr')) || templates[0] || null;

    applyIntoDraftGlobals(ev, m, template);
  }

  // roda cedo
  try{ main(); }catch(e){ console.error('[draft.by_phase]', e); }
})();
