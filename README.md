# LBI (Site + Painel + Draft) — Projeto Unificado

Este pacote unifica:
- **Site público** (HTML/CSS/JS) em `/` 
- **Painel admin** em `/admin` (com login)
- **Draft** em `/admin/draft` (também protegido)

## Rotas
- **/** → Site público
- **/admin** → Painel (login)
- **/admin/draft** → Ferramenta de draft (Socket.IO em `/admin/draft/socket.io`)

## Requisitos
- Node.js 18+ (recomendado)

## Configuração (VPS)
1) Instale dependências:
```bash
npm install
```

2) Gere o hash da sua senha:
```bash
npm run hash -- "SUA_SENHA_FORTE"
```

3) Crie variáveis de ambiente (exemplo):
```bash
export ADMIN_USER="admin"
export ADMIN_PASS_HASH="<COLE_AQUI_O_HASH_DO_PASSO_2>"
export SESSION_SECRET="...uma-string-longa-e-unica..."
# opcional:
export LBI_DB_PATH="/caminho/absoluto/data/lbi.sqlite"
```

4) Rode:
```bash
npm start
```

A aplicação sobe em `http://<IP>:3000` (ou na porta definida em `PORT`).

## Observações
- O **KV (SQLite)** fica em `./data/lbi.sqlite` por padrão.
- As rotas `/api/kv/*` e todas as rotas do Draft (`/api/rooms`, `/api/admin/*`, etc.) estão protegidas por sessão.
- Se você usar HTTPS (proxy/reverse proxy), você pode ativar cookie `secure` no `server.js`.
