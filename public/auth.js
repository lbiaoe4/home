(() => {
  const $ = (id) => document.getElementById(id);

  async function api(path, opts = {}) {
    const r = await fetch(path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    });
    const ct = r.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await r.json().catch(() => ({})) : await r.text().catch(() => '');
    if (!r.ok) {
      const err = (body && body.error) ? body.error : `http_${r.status}`;
      throw new Error(err);
    }
    return body;
  }

  function showAuthed(username) {
    const topbar = $('topbar');
    const loginView = $('loginView');
    const appView = $('appView');
    const chipUser = $('chipUser');

    topbar && topbar.classList.remove('hidden');
    loginView && loginView.classList.add('hidden');
    appView && appView.classList.remove('hidden');
    chipUser && (chipUser.textContent = username || 'admin');

    // Monta tiles mínimas (Painel + Draft)
    const tiles = $('tiles');
    if (tiles && !tiles.dataset.built) {
      tiles.dataset.built = '1';
      tiles.innerHTML = `
        <a class="tile" href="#" data-open="resultados">
          <div class="tile__t">Resultados / Bracket</div>
          <div class="tile__d">Gerenciar seeds, partidas e gerar bracket</div>
        </a>
        <a class="tile" href="/admin/draft/" target="_blank" rel="noopener">
          <div class="tile__t">Draft (interno)</div>
          <div class="tile__d">Abrir a ferramenta de draft</div>
        </a>
      `;

      // Se o seu painel tiver seções prontas, você pode ligar aqui.
      tiles.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-open]');
        if (!a) return;
        e.preventDefault();
        // Por enquanto só rola para a seção de resultados se existir
        const sec = document.getElementById('sectionResultados') || document.querySelector('[id^="section"]');
        if (sec) {
          sec.classList.remove('hidden');
          sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  function showLogin(msg = '') {
    $('topbar')?.classList.add('hidden');
    $('appView')?.classList.add('hidden');
    $('loginView')?.classList.remove('hidden');
    const box = $('loginMsg');
    if (box) {
      box.textContent = msg;
      box.style.display = msg ? 'block' : 'none';
    }
  }

  async function boot() {
    // Bind botões
    $('btnLogin')?.addEventListener('click', async () => {
      const username = $('loginUser')?.value || '';
      const password = $('loginPass')?.value || '';
      try {
        await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        const me = await api('/api/auth/me');
        showAuthed(me?.user?.username);
      } catch (err) {
        showLogin('Login inválido.');
      }
    });

    $('btnLogout')?.addEventListener('click', async () => {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
      showLogin('');
    });

    // Ao carregar, checa sessão
    try {
      const me = await api('/api/auth/me');
      showAuthed(me?.user?.username);
    } catch {
      showLogin('');
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
