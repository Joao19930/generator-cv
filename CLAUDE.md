# CV Generator Pro — Guia para Claude Code

## Stack
- **Backend**: Node.js + Express 5 + MSSQL (SQL Server Express)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **DB**: MSSQL via `mssql` driver — pool centralizado em `src/config/database.js`
- **Cache**: Redis via ioredis
- **Real-time**: Socket.IO
- **PDF**: Puppeteer → AWS S3
- **IA**: OpenAI GPT-4o-mini
- **Pagamentos**: Stripe + PayPal
- **E-mail**: SendGrid (prod) + Nodemailer SMTP (dev)

## Estrutura de Pastas

```
cv-generator/
├── src/
│   ├── server.js              ← Ponto de entrada
│   ├── config/
│   │   └── database.js        ← Pool MSSQL
│   ├── connectors/
│   │   └── index.js           ← 20 conectores externos
│   ├── middleware/
│   │   ├── auth.js            ← JWT + adminOnly + premiumOnly
│   │   └── rateLimiter.js     ← Rate limit por IP via Redis
│   ├── routes/
│   │   ├── auth.js            ← /api/auth/*
│   │   ├── cv.js              ← /api/cv/*
│   │   ├── admin.js           ← /api/admin/*
│   │   ├── payment.js         ← /api/payment/*
│   │   └── growth.js          ← /api/growth/*
│   └── cron/
│       └── jobs.js            ← CRON jobs
├── migrations.sql             ← Executar no SSMS
├── .env                       ← Variáveis de ambiente
└── package.json
```

## Convenções de Código

- Usar `req.db` para aceder ao pool MSSQL (injectado no middleware)
- Importar conectores: `const { emailConnector, stripeConnector } = require('../connectors')`
- Sempre usar `try/catch` em rotas
- IDs de utilizador: `req.user.id` (do JWT)
- Admin check: middleware `adminOnly`
- Premium check: middleware `premiumOnly`

## Comandos Úteis

```bash
# Instalar dependências
npm install

# Iniciar em desenvolvimento
npm run dev

# Iniciar em produção
npm start

# Correr migrações (alternativa ao SSMS)
npm run migrate
```

## APIs Principais

| Rota | Auth | Descrição |
|------|------|-----------|
| POST /api/auth/register | — | Registar utilizador |
| POST /api/auth/login | — | Login |
| POST /api/auth/google | — | Login Google |
| GET  /api/auth/me | JWT | Perfil do utilizador |
| GET  /api/cv | JWT | Listar CVs |
| POST /api/cv | JWT | Criar CV |
| POST /api/cv/:id/generate-pdf | JWT | Gerar PDF |
| POST /api/cv/ats-score | — | Score ATS (público) |
| POST /api/cv/improve-text | JWT | Melhorar texto com IA |
| POST /api/payment/stripe/checkout | JWT | Checkout Stripe |
| POST /api/payment/stripe/webhook | — | Webhook Stripe |
| GET  /api/admin/overview | JWT+Admin | KPIs dashboard |
| GET  /api/admin/users | JWT+Admin | Lista utilizadores |
| GET  /api/growth/referral | JWT | Código de referral |
| GET  /api/growth/sitemap.xml | — | Sitemap SEO |

## Notas Importantes

1. O webhook Stripe usa `express.raw()` — registado ANTES do `express.json()`
2. Redis é opcional em dev (se falhar, o rate limiter deixa passar)
3. Puppeteer precisa de Chromium — em Windows instala automaticamente
4. AWS S3 pode ser substituído por armazenamento local em dev
5. Variáveis obrigatórias para arrancar: `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`
