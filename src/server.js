// src/server.js
// ─────────────────────────────────────────────────────────────
// CV Premium — Servidor Principal
// Arquitectura tipo Resume.io / Zety
// ─────────────────────────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const http    = require('http');
const cors    = require('cors');
const path    = require('path');

// Config & utils
const { getPool, sql } = require('./config/database');
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
const { router: chatRoutes } = require('./routes/chat');
const { router: empregosRoutes, importJobs } = require('./routes/empregos');
const aiRoutes        = require('./routes/ai');

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
const noCache = (res) => res.setHeader('Cache-Control', 'no-store');
app.get('/app',        (req, res) => { noCache(res); res.sendFile(path.join(__dirname, '..', 'public', 'app.html')); });
app.get('/dashboard',  (req, res) => { noCache(res); res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')); });
app.get('/definicoes', (req, res) => { noCache(res); res.sendFile(path.join(__dirname, '..', 'public', 'definicoes.html')); });
app.get('/editor',        (req, res) => { noCache(res); res.sendFile(path.join(__dirname, '..', 'public', 'editor-app', 'index.html')); });
app.get('/editor-legacy', (req, res) => { noCache(res); res.sendFile(path.join(__dirname, '..', 'public', 'form.html')); });
app.get('/preview',    (req, res) => { noCache(res); res.sendFile(path.join(__dirname, '..', 'public', 'preview.html')); });
app.get('/free',       (req, res) => { noCache(res); res.sendFile(path.join(__dirname, '..', 'public', 'free.html')); });
app.get('/free-preview', (req, res) => { noCache(res); res.sendFile(path.join(__dirname, '..', 'public', 'free-preview.html')); });
app.get('/demo',         (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'demo.html')));
app.get('/ats',          (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'ats.html')));
app.get('/pricing',      (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'pricing.html')));
app.get('/empregos',        (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'empregos.html')));
app.get('/linkedin-import', (req, res) => { noCache(res); res.sendFile(path.join(__dirname, '..', 'public', 'linkedin-import.html')); });

// ── Chatbot training (admin) ─────────────────────────────────
app.get('/admin-chat-training', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin-chat-training.html')));

// ── Dashboard admin ──────────────────────────────────────────
app.get('/admin-login', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin-login.html')));
app.use('/admin-panel', express.static(path.join(__dirname, 'dashboard'), { etag: false, maxAge: 0 }));
app.get('/admin-panel', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

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

// ── Tracking de visitas (público, antes do rate limiter) ─────
app.post('/api/track', async (req, res) => {
  res.json({ ok: true }); // responde imediatamente
  try {
    const pool = await getPool();
    const { page = '/', sessionId } = req.body;
    const uid = req.body.userId || null;
    await pool.request()
      .input('page', sql.VarChar, String(page).slice(0, 100))
      .input('uid',  sql.Int,     uid ? parseInt(uid) : null)
      .input('sid',  sql.VarChar, sessionId ? String(sessionId).slice(0, 64) : null)
      .query(`INSERT INTO page_views (page, user_id, session_id) VALUES (@page, @uid, @sid)`);
  } catch (_) {}
});

// ── Tracking de eventos granulares (público) ─────────────────
app.post('/api/track/event', async (req, res) => {
  res.json({ ok: true });
  try {
    const pool = await getPool();
    const { eventType, page = '/', data, sessionId, userId } = req.body;
    if (!eventType) return;
    // Criar tabela se não existir (auto-migrate)
    await pool.request().query(
      `CREATE TABLE IF NOT EXISTS user_events (
        id SERIAL PRIMARY KEY, event_type VARCHAR(100) NOT NULL,
        page VARCHAR(100), data VARCHAR(500),
        user_id INTEGER, session_id VARCHAR(64),
        created_at TIMESTAMP DEFAULT NOW())`
    ).catch(() => {});
    await pool.request()
      .input('et',   sql.VarChar, String(eventType).slice(0, 100))
      .input('page', sql.VarChar, String(page).slice(0, 100))
      .input('data', sql.VarChar, data ? JSON.stringify(data).slice(0, 500) : null)
      .input('uid',  sql.Int,     userId ? parseInt(userId) : null)
      .input('sid',  sql.VarChar, sessionId ? String(sessionId).slice(0, 64) : null)
      .query(`INSERT INTO user_events (event_type, page, data, user_id, session_id)
              VALUES (@et, @page, @data, @uid, @sid)`);
  } catch (_) {}
});

// ── Rate limiting global ─────────────────────────────────────
app.use(rateLimiter(300, 3600));

// ── AI Copiloto — não precisa de DB, montar antes do middleware de DB ──
app.use('/api/ai',      aiRoutes);

// ── Injectar pool DB em cada request ────────────────────────
app.use(async (req, res, next) => {
  try { req.db = await getPool(); next(); }
  catch (err) { res.status(503).json({ error: 'Base de dados indisponível' }); }
});

app.use('/api/chat',      chatRoutes);         // Chatbot IA (público)
app.use('/api/auth',      authRoutes);
app.use('/api/growth',    growthRoutes);       // Sitemap, ATS, referral, OG
app.use('/api/templates', templatesRoutes);    // Templates (GET público, POST protegido)
app.use('/api/content',  contentRoutes);       // Coaches, Courses, Jobs, Testimonials (público)
app.use('/api/empregos', empregosRoutes);      // Módulo Vagas de Emprego (público)

// ── Rotas protegidas (JWT) ───────────────────────────────────
app.use('/api/cv',      auth, cvRoutes);
app.use('/api/payment', paymentRoutes);    // Webhook não usa auth


// ── Suporte — utilizador envia ticket (JWT) ───────────────────
app.post('/api/support', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Mensagem obrigatória.' });
    const name  = req.user.name  || req.user.email || 'Utilizador';
    const email = req.user.email || null;
    await req.db.request()
      .input('uid',  sql.Int,      req.user.id)
      .input('name', sql.NVarChar, name)
      .input('mail', sql.NVarChar, email)
      .input('msg',  sql.NVarChar, message.trim())
      .query(`INSERT INTO support_tickets (user_id, name, email, message) VALUES (@uid, @name, @mail, @msg)`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary VARCHAR(100)`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source VARCHAR(100)`,
    `ALTER TABLE coaches ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500)`,
    `ALTER TABLE templates ADD COLUMN IF NOT EXISTS template_type VARCHAR(20) DEFAULT 'sem_foto'`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS description  TEXT`,
    `ALTER TABLE courses ADD COLUMN IF NOT EXISTS contact_type VARCHAR(20) DEFAULT 'url'`,
    // Inserir 3 templates ATS se ainda não existirem
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at)
     SELECT 'ATS Simples', 'ats-simples', 'ATS', FALSE, 'ats', TRUE, NOW()
     WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug = 'ats-simples')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at)
     SELECT 'ATS Profissional', 'ats-profissional', 'ATS', FALSE, 'ats', TRUE, NOW()
     WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug = 'ats-profissional')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at)
     SELECT 'ATS Executivo', 'ats-executivo', 'ATS', FALSE, 'ats', TRUE, NOW()
     WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug = 'ats-executivo')`,
    // 6 templates Com Foto
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Clássico Azul','cf-classico-azul','Com Foto',FALSE,'com_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='cf-classico-azul')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Executivo Escuro','cf-executivo-escuro','Com Foto',TRUE,'com_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='cf-executivo-escuro')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Gradiente Roxo','cf-gradiente-roxo','Com Foto',TRUE,'com_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='cf-gradiente-roxo')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Verde Profissional','cf-verde-profissional','Com Foto',TRUE,'com_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='cf-verde-profissional')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Teal Moderno','cf-teal-moderno','Com Foto',TRUE,'com_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='cf-teal-moderno')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Coral Criativo','cf-coral-criativo','Com Foto',TRUE,'com_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='cf-coral-criativo')`,
    // 6 templates Sem Foto
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Minimalista Clean','sf-minimalista-clean','Sem Foto',FALSE,'sem_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='sf-minimalista-clean')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Corporate Azul','sf-corporate-azul','Sem Foto',TRUE,'sem_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='sf-corporate-azul')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Cinza Técnico','sf-cinza-tecnico','Sem Foto',TRUE,'sem_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='sf-cinza-tecnico')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Verde Académico','sf-verde-academico','Sem Foto',TRUE,'sem_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='sf-verde-academico')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Laranja Criativo','sf-laranja-criativo','Sem Foto',TRUE,'sem_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='sf-laranja-criativo')`,
    `INSERT INTO templates (name, slug, category, is_premium, template_type, active, created_at) SELECT 'Navy Executivo','sf-navy-executivo','Sem Foto',TRUE,'sem_foto',TRUE,NOW() WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug='sf-navy-executivo')`,
    `CREATE TABLE IF NOT EXISTS page_views (
      id         SERIAL PRIMARY KEY,
      page       VARCHAR(100) NOT NULL,
      user_id    INTEGER,
      session_id VARCHAR(64),
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS support_tickets (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER,
      name        VARCHAR(100) NOT NULL,
      email       VARCHAR(255),
      message     TEXT NOT NULL,
      status      VARCHAR(20) DEFAULT 'open',
      reply       TEXT,
      replied_at  TIMESTAMP,
      created_at  TIMESTAMP DEFAULT NOW()
    )`,
  ];
  for (const sql of stmts) {
    try { await pool.request().query(sql); }
    catch (e) { console.warn('⚠️  autoMigrate:', e.message?.slice(0, 120)); }
  }
}

async function migrateChatKnowledge(pool) {
  const stmts = [
    // Criar tabela chat_knowledge se não existir (PostgreSQL)
    `CREATE TABLE IF NOT EXISTS chat_knowledge (
       id            SERIAL PRIMARY KEY,
       section_key   VARCHAR(100) UNIQUE NOT NULL,
       section_title VARCHAR(200) NOT NULL,
       content       TEXT,
       is_active     BOOLEAN DEFAULT TRUE,
       updated_at    TIMESTAMP DEFAULT NOW()
     )`,
    // Secções de conhecimento iniciais
    `INSERT INTO chat_knowledge (section_key, section_title, content)
     SELECT 'product_info', 'O que é o CV Premium',
       'O CV Premium é uma plataforma profissional angolana para criar CVs modernos e otimizados para ATS. Oferecemos mais de 13 templates profissionais, geração de PDF de alta qualidade, análise ATS, e ferramentas de IA para melhorar o CV. Disponível em plano gratuito e plano Premium.'
     WHERE NOT EXISTS (SELECT 1 FROM chat_knowledge WHERE section_key = 'product_info')`,
    `INSERT INTO chat_knowledge (section_key, section_title, content)
     SELECT 'cv_tips', 'Dicas para criar um bom CV',
       E'1. Use verbos de ação no início de cada responsabilidade (ex: "Coordenei", "Implementei", "Aumentei")\n2. Quantifique conquistas sempre que possível (ex: "Aumentei as vendas em 30%")\n3. Adapte o CV a cada vaga, usando as palavras-chave da descrição\n4. Mantenha máximo 2 páginas para a maioria dos candidatos\n5. Inclua um resumo profissional forte no topo\n6. Liste as experiências por ordem cronológica inversa (mais recente primeiro)\n7. Inclua competências técnicas e soft skills relevantes para a vaga'
     WHERE NOT EXISTS (SELECT 1 FROM chat_knowledge WHERE section_key = 'cv_tips')`,
    `INSERT INTO chat_knowledge (section_key, section_title, content)
     SELECT 'ats_tips', 'Otimização ATS (Applicant Tracking System)',
       E'ATS são sistemas automáticos que filtram CVs antes de chegarem ao recrutador. Para otimizar:\n- Use palavras-chave exactas da descrição da vaga\n- Evite tabelas, colunas múltiplas, gráficos e imagens no corpo do CV\n- Use formatos de data padrão (ex: Jan 2022 - Dez 2023)\n- Inclua secções claramente identificadas: Experiência Profissional, Educação, Competências\n- Evite cabeçalhos e rodapés com informação crítica\n- Use fonts simples como Arial, Calibri ou Times New Roman\n- Guarde o ficheiro como PDF (o nosso gerador faz isso automaticamente)'
     WHERE NOT EXISTS (SELECT 1 FROM chat_knowledge WHERE section_key = 'ats_tips')`,
    `INSERT INTO chat_knowledge (section_key, section_title, content)
     SELECT 'pricing_info', 'Planos e Preços',
       E'Plano Gratuito: criar e editar CVs, acesso a templates gratuitos, análise ATS básica, preview online.\nPlano Premium: download de PDF em alta qualidade sem marca de água, acesso a todos os templates premium, análise ATS completa, geração de carta de apresentação com IA, múltiplos CVs ilimitados, suporte prioritário.\nConsulte a página de preços no site para valores actualizados e promoções.'
     WHERE NOT EXISTS (SELECT 1 FROM chat_knowledge WHERE section_key = 'pricing_info')`,
    `INSERT INTO chat_knowledge (section_key, section_title, content)
     SELECT 'faq', 'Perguntas Frequentes',
       E'P: Como faço download do meu CV?\nR: Utilizadores Premium fazem download direto em PDF. Utilizadores gratuitos têm acesso ao preview online.\n\nP: Posso ter múltiplos CVs?\nR: Sim, pode criar vários CVs para diferentes vagas ou sectores.\n\nP: Os meus dados ficam guardados?\nR: Sim, todos os CVs ficam guardados na sua conta e pode editá-los a qualquer momento.\n\nP: O chatbot substitui um consultor de carreira?\nR: Não. O assistente dá dicas gerais. Para orientação personalizada, recomendamos os nossos coaches certificados disponíveis na plataforma.'
     WHERE NOT EXISTS (SELECT 1 FROM chat_knowledge WHERE section_key = 'faq')`,
  ];
  for (const stmt of stmts) {
    try { await pool.request().query(stmt); }
    catch (e) { console.warn('⚠️  migrateChatKnowledge:', e.message?.slice(0, 120)); }
  }
  console.log('✅ chat_knowledge: tabela e dados iniciais verificados');
}

getPool().then(async (pool) => {
  await autoMigrate(pool);
  await migrateChatKnowledge(pool);
  // Limpar cache do overview ao reiniciar (garante dados frescos após deploy)
  redisConnector.del('admin:overview').catch(() => {});
  setupCrons(pool);
  // Importar vagas 10s após arranque (evita falhas de rede no boot)
  setTimeout(() => importJobs(pool).catch(() => {}), 10000);
  server.listen(PORT, () => {
    console.log(`\n🚀 CV Premium`);
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
