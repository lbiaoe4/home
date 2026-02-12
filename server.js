const express = require('express');
const path = require('path');
const http = require('http');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');

const { openDb, DB_PATH } = require('./db');
const { attachDraft } = require('./draft-server');

const PORT = process.env.PORT || 3000;

// ===== Login (admin via ENV) =====
// Gere um hash bcrypt com: npm run hash -- "SUA_SENHA"
// Depois defina no VPS:
//   ADMIN_USER=admin
//   ADMIN_PASS_HASH=<hash>
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || '';

const app = express();
const server = http.createServer(app);

// Socket.IO exclusivo do Draft (path isolado)
const ioDraft = new Server(server, {
  path: '/admin/draft/socket.io',
  serveClient: false,
});

// ===== Session =====
app.use(session({
  name: 'lbi.sid',
  secret: process.env.SESSION_SECRET || 'change-me-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    // Se você colocar por trás de HTTPS, pode ativar:
    secure: false,
    maxAge: 1000 * 60 * 60 * 12, // 12h
  }
}));

app.use(express.json({ limit: '5mb' }));

function isAuthed(req) {
  return Boolean(req.session && req.session.user);
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  // Para APIs, responda JSON
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthorized' });
  // Para páginas, redireciona ao /admin (onde tem tela de login)
  return res.redirect('/admin');
}

// ===== Auth API =====
app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: DB_PATH });
});

app.get('/api/auth/me', (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ error: 'unauthorized' });
  res.json({ ok: true, user: req.session.user });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = String(username || '').trim();
  const p = String(password || '');

  if (!u || !p) return res.status(400).json({ error: 'missing_fields' });
  if (u !== ADMIN_USER) return res.status(401).json({ error: 'invalid_credentials' });
  if (!ADMIN_PASS_HASH) return res.status(500).json({ error: 'ADMIN_PASS_HASH_not_set' });

  const ok = bcrypt.compareSync(p, ADMIN_PASS_HASH);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  req.session.user = { username: u, role: 'admin' };
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ===== SITE público (/) =====
app.use('/', express.static(path.join(__dirname, 'site_public')));

// ===== Admin (protegido) =====
app.use('/admin', (req, res, next) => {
  // Deixa carregar a própria página de login
  if (req.method === 'GET' && (req.path === '/' || req.path === '' || req.path === '/index.html')) return next();
  // Deixa carregar assets do painel mesmo sem auth (pra tela de login renderizar)
  if (req.method === 'GET' && (req.path.endsWith('.css') || req.path.endsWith('.js') || req.path.endsWith('.png') || req.path.endsWith('.jpg') || req.path.endsWith('.svg') || req.path.endsWith('.ico'))) return next();
  // E também permite as rotas de auth
  if (req.path.startsWith('/api/auth')) return next();
  // Resto precisa estar logado
  return requireAuth(req, res, next);
});

// Static do painel
app.use('/admin', express.static(path.join(__dirname, 'public')));

// Draft dentro do painel (protegido)
app.use('/admin/draft', requireAuth, express.static(path.join(__dirname, 'draft_public')));

// ===== APIs do painel (KV) =====
const db = openDb();

// Protege tudo do KV
app.use('/api/kv', requireAuth);

// Exporta todas as chaves lbi_*
app.get('/api/kv/export', (req, res) => {
  db.all(
    `SELECT key, value FROM kv WHERE key LIKE 'lbi\\_%' ESCAPE '\\'`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const out = {};
      for (const r of rows) out[r.key] = r.value;
      res.json(out);
    }
  );
});

// Lê uma chave
app.get('/api/kv/:key', (req, res) => {
  const key = req.params.key;
  db.get(`SELECT key, value FROM kv WHERE key = ?`, [key], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json({ key: row.key, value: row.value });
  });
});

// Escreve uma chave
app.put('/api/kv/:key', (req, res) => {
  const key = req.params.key;
  const value = (req.body && typeof req.body.value === 'string') ? req.body.value : null;
  if (value === null) return res.status(400).json({ error: 'value_required' });

  db.run(
    `INSERT INTO kv(key, value, updated_at)
     VALUES(?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, value],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

// Deleta uma chave
app.delete('/api/kv/:key', (req, res) => {
  const key = req.params.key;
  db.run(`DELETE FROM kv WHERE key = ?`, [key], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes });
  });
});

// Import em lote (substitui/mescla)
app.post('/api/kv/import', (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'object_required' });

  const entries = Object.entries(data).filter(([k, v]) => k && typeof v === 'string');
  if (!entries.length) return res.status(400).json({ error: 'no_valid_entries' });

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare(
      `INSERT INTO kv(key, value, updated_at)
       VALUES(?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    );

    for (const [k, v] of entries) stmt.run([k, v]);

    stmt.finalize((err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      db.run('COMMIT');
      res.json({ ok: true, count: entries.length });
    });
  });
});

// ===== Draft API + Socket.IO =====
// (Também protegido)
app.use('/api', (req, res, next) => {
  // /api/health é público
  if (req.path === '/health') return next();
  return requireAuth(req, res, next);
});
attachDraft({ app, io: ioDraft });

// ===== Fallbacks =====
// Se não achou rota no /admin, manda para /admin/index.html (SPA simples)
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`LBI unificado rodando em http://localhost:${PORT}`);
  console.log(`Site público: /`);
  console.log(`Painel: /admin`);
  console.log(`Draft (interno): /admin/draft`);
});
