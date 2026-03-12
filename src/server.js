// src/server.js
// ─────────────────────────────────────────────────────────────
// CV Generator Pro — Servidor Principal
// Arquitectura tipo Resume.io / Zety
// ─────────────────────────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const http    = require('http');
const cors    = require('cors');
const path    = require('path');

// Config & utils
const { getPool } = require('./config/database');
const { socketConnector, redisConnector } = require('./connectors');
const { setupCrons } = require('./cron/jobs');

// Middlewares
const { auth, adminOnly }    = require('./middleware/auth');
const { rateLimiter }        = require('./middleware/rateLimiter');

// Rotas
const authRoutes      = require('./routes/auth');
const cvRoutes        = require('./routes/cv');
const adminRoutes     = require('./routes/admin');
const paymentRoutes   = require('./routes/payment');
const growthRoutes    = require('./routes/growth');
const templatesRoutes = require('./routes/templates');
const contentRoutes   = require('./routes/content');

// ── Criar app e servidor HTTP ────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ── Socket.IO (tempo real) ──────────────────────────────────
socketConnector.init(server);

// ── WEBHOOK STRIPE — raw body ANTES do express.json() ────────
app.use('/api/payment/stripe/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => { req.rawBody = req.body; next(); }
);

// ── Middlewares globais ─────────────────────────────────────
app.use(cors({
  origin: process.env.APP_URL || '*',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Ficheiros estáticos públicos (sem DB) ────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Landing page principal ───────────────────────────────────
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ── Auth pages ───────────────────────────────────────────────
app.get('/login',    (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/register', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));

// ── OAuth redirects ──────────────────────────────────────────
app.get('/auth/google',   (req, res) => res.redirect('/api/auth/google'));
app.get('/auth/linkedin', (req, res) => res.redirect('/api/auth/linkedin'));

// ── App pages ────────────────────────────────────────────────
app.get('/app',        (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'app.html')));
app.get('/dashboard',  (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')));
app.get('/definicoes', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'definicoes.html')));
app.get('/editor',   (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'form.html')));
app.get('/preview',  (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'preview.html')));
app.get('/free',     (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'free.html')));
app.get('/free-preview', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'free-preview.html')));
app.get('/demo',         (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'demo.html')));
app.get('/ats',          (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'ats.html')));

// ── Dashboard admin ──────────────────────────────────────────
app.get('/admin-login', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin-login.html')));
app.use('/admin-panel', express.static(path.join(__dirname, 'dashboard')));
app.get('/admin-panel', (req, res) =>
  res.sendFile(path.join(__dirname, 'dashboard', 'index.html')));

// ── Rotas públicas ───────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', version: '2.0.0', ts: new Date().toISOString() }));

// ── Debug jobs (remover após diagnóstico) ─────────────────────
app.get('/debug-jobs', async (req, res) => {
  const results = {};
  try {
    const pool = await getPool();
    // Testa cada query e regista resultado ou erro
    const queries = [
      'SELECT COUNT(*) AS n FROM jobs',
      'SELECT * FROM jobs LIMIT 3',
      'SELECT * FROM jobs WHERE active=TRUE LIMIT 3',
    ];
    for (const q of queries) {
      try {
        const r = await pool.request().query(q);
        results[q] = { ok: true, rows: r.recordset };
      } catch (e) {
        results[q] = { ok: false, error: e.message };
      }
    }
  } catch(e) {
    results['db_connection'] = { ok: false, error: e.message };
  }
  res.json(results);
});

// ── Rate limiting global ─────────────────────────────────────
app.use(rateLimiter(300, 3600));

// ── Injectar pool DB em cada request ────────────────────────
app.use(async (req, res, next) => {
  try { req.db = await getPool(); next(); }
  catch (err) { res.status(503).json({ error: 'Base de dados indisponível' }); }
});

app.use('/api/auth',      authRoutes);
app.use('/api/growth',    growthRoutes);       // Sitemap, ATS, referral, OG
app.use('/api/templates', templatesRoutes);    // Templates (GET público, POST protegido)
app.use('/api/content',  contentRoutes);       // Coaches, Courses, Jobs, Testimonials (público)

// ── Rotas protegidas (JWT) ───────────────────────────────────
app.use('/api/cv',      auth, cvRoutes);
app.use('/api/payment', paymentRoutes);    // Webhook não usa auth

// ── Rotas Admin (JWT + role=admin) ──────────────────────────
app.use('/api/admin',   auth, adminOnly, adminRoutes);

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ error: `Rota ${req.method} ${req.path} não encontrada` }));

// ── Error handler global ─────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('🔴 Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno do servidor' });
});

// ── Iniciar ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function autoMigrate(pool) {
  const stmts = [
    // Criar tabelas de conteúdo se não existirem
    `CREATE TABLE IF NOT EXISTS jobs (
      id           SERIAL PRIMARY KEY,
      title        VARCHAR(255) NOT NULL,
      company      VARCHAR(255),
      city         VARCHAR(100),
      country      VARCHAR(100),
      category     VARCHAR(100),
      description  TEXT,
      job_date     DATE,
      start_date   DATE,
      end_date     DATE,
      url          VARCHAR(500),
      contact_type VARCHAR(20) DEFAULT 'url',
      active       BOOLEAN DEFAULT TRUE,
      created_at   TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS coaches (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      location   VARCHAR(100),
      bio        TEXT,
      skills     VARCHAR(500),
      email      VARCHAR(255),
      color      VARCHAR(20) DEFAULT '#6366f1',
      photo_url  VARCHAR(500),
      active     BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS courses (
      id         SERIAL PRIMARY KEY,
      title      VARCHAR(255) NOT NULL,
      source     VARCHAR(100),
      category   VARCHAR(100),
      rating     VARCHAR(10),
      url        VARCHAR(500),
      active     BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS testimonials (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      role       VARCHAR(100),
      text       TEXT,
      stars      INTEGER DEFAULT 5,
      active     BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    // Adicionar colunas em falta a tabelas já existentes
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description  TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_date   DATE`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_date     DATE`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_type VARCHAR(20) DEFAULT 'url'`,
    `ALTER TABLE coaches ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500)`,
  ];
  for (const sql of stmts) {
    try { await pool.request().query(sql); } catch (_) {}
  }
}

getPool().then(async (pool) => {
  await autoMigrate(pool);
  setupCrons(pool);
  server.listen(PORT, () => {
    console.log(`\n🚀 CV Generator Pro`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Admin:   http://localhost:${PORT}/api/admin/overview`);
    console.log(`   Health:  http://localhost:${PORT}/health`);
    console.log(`   Env:     ${process.env.NODE_ENV || 'development'}\n`);
  });
}).catch(err => {
  console.error('❌ Falha ao iniciar:', err.message);
  process.exit(1);
});

module.exports = { app, server };
