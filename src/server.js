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
const helmet  = require('helmet');

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
const marketingRoutes = require('./routes/marketing');

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

// ── Segurança — cabeçalhos HTTP ─────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // CSP inline nos HTMLs — desactivar para não quebrar
  crossOriginEmbedderPolicy: false
}));

// ── Middlewares globais ─────────────────────────────────────
app.use(cors({
  origin: process.env.APP_URL || '*',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Sitemap dinâmico (antes do express.static para não ser bloqueado pelo ficheiro antigo) ──
app.get('/sitemap.xml/', (req, res) => res.redirect(301, '/sitemap.xml'));
app.get('/sitemap.xml', async (req, res) => {
  try {
    const _raw = (process.env.APP_URL || 'https://cvpremium.net').replace(/\/+$/, '');
    const BASE = _raw.startsWith('http') ? _raw : 'https://' + _raw;
    const now  = new Date().toISOString().split('T')[0];
    const pool = await getPool();

    const statics = [
      { url: '/',         pri: '1.0', freq: 'daily'   },
      { url: '/empregos', pri: '0.9', freq: 'daily'   },
      { url: '/blog',     pri: '0.9', freq: 'daily'   },
      { url: '/cursos',   pri: '0.8', freq: 'weekly'  },
      { url: '/mentores', pri: '0.8', freq: 'weekly'  },
      { url: '/demo',     pri: '0.8', freq: 'weekly'  },
      { url: '/pricing',  pri: '0.8', freq: 'weekly'  },
      { url: '/ats',      pri: '0.7', freq: 'weekly'  },
      { url: '/free',     pri: '0.6', freq: 'monthly' },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    for (const s of statics)
      xml += `  <url><loc>${BASE}${s.url}</loc><lastmod>${now}</lastmod><changefreq>${s.freq}</changefreq><priority>${s.pri}</priority></url>\n`;

    const blogs = await pool.request()
      .query(`SELECT slug, published_at FROM blog_posts WHERE published = 1 ORDER BY published_at DESC`)
      .catch(() => ({ recordset: [] }));
    for (const b of blogs.recordset) {
      const d = (b.PublishedAt||b.published_at||now).toString().split('T')[0];
      xml += `  <url><loc>${BASE}/blog/${b.Slug||b.slug}</loc><lastmod>${d}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n`;
    }

    const jobs = await pool.request()
      .query(`SELECT id, created_at FROM jobs WHERE active = 1 ORDER BY created_at DESC`)
      .catch(() => ({ recordset: [] }));
    for (const j of jobs.recordset) {
      const d = (j.CreatedAt||j.created_at||now).toString().split('T')[0];
      xml += `  <url><loc>${BASE}/empregos/${j.Id||j.id}</loc><lastmod>${d}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
    }

    const courses = await pool.request()
      .query(`SELECT id FROM courses WHERE active = 1`)
      .catch(() => ({ recordset: [] }));
    for (const c of courses.recordset)
      xml += `  <url><loc>${BASE}/cursos/${c.Id||c.id}</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;

    const coaches = await pool.request()
      .query(`SELECT id FROM coaches WHERE active = 1`)
      .catch(() => ({ recordset: [] }));
    for (const c of coaches.recordset)
      xml += `  <url><loc>${BASE}/mentores/${c.Id||c.id}</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;

    xml += `</urlset>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(xml);
  } catch (e) {
    res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

// ── Ficheiros estáticos públicos (sem DB) ────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Google Search Console verification ───────────────────────
app.get('/googleddedda02fe275dbb.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send('google-site-verification: googleddedda02fe275dbb.html');
});

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
app.get('/sobre',           (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'sobre.html')));
app.get('/empregos',        (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'empregos.html')));
app.get('/linkedin-import', (req, res) => { noCache(res); res.sendFile(path.join(__dirname, '..', 'public', 'linkedin-import.html')); });

// ── Chatbot training (admin) ─────────────────────────────────
app.get('/admin-chat-training', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin-chat-training.html')));

app.get('/admin-job-templates', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin-job-templates.html')));

app.get('/admin-blog', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin-blog.html')));

app.get('/blog', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'blog.html')));

// ── Cursos ────────────────────────────────────────────────────
app.get('/cursos', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'cursos.html')));

app.get('/cursos/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) { res.redirect('/cursos'); return; }
  try {
    const pool = await getPool();
    const row  = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`SELECT id, title, source, category, rating, url FROM courses WHERE id = @id AND active = TRUE`)
      .then(r => r.recordset[0]).catch(() => null);

    if (!row) { res.redirect('/cursos'); return; }
    const _rawX = (process.env.APP_URL || 'https://cvpremium.net').replace(/\/+$/, '');
    const BASE  = _rawX.startsWith('http') ? _rawX : 'https://' + _rawX;
    const title = (row.Title||row.title||'Curso').replace(/"/g,'&quot;');
    const src   = row.Source||row.source||'CV Premium';
    const cat   = row.Category||row.category||'Formação';
    const rat   = row.Rating||row.rating||'';
    const url   = row.Url||row.url||'';
    const pageUrl = `${BASE}/cursos/${req.params.id}`;
    const desc  = `Curso de ${title} — ${src}. Categoria: ${cat}.`.replace(/"/g,'&quot;');

    const schema = {
      "@context":"https://schema.org","@type":"Course",
      "name": title,
      "description": desc,
      "url": pageUrl,
      "provider": { "@type":"Organization","name":src },
      "educationalLevel": cat,
      ...(rat ? {"aggregateRating":{"@type":"AggregateRating","ratingValue":rat,"bestRating":"5","ratingCount":"1"}} : {})
    };
    const html = `<!DOCTYPE html><html lang="pt"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title} — ${src} | CV Premium Angola</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website">
<meta property="og:url" content="${pageUrl}">
<meta property="og:title" content="${title} — ${src}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${BASE}/og-image.png">
<meta property="og:site_name" content="CV Premium Angola">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<script type="application/ld+json">${JSON.stringify(schema)}<\/script>
<meta http-equiv="refresh" content="0;url=/cursos">
<style>body{font-family:sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#1e293b;}
.box{background:#fff;border-radius:14px;padding:32px;max-width:480px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08);}
h1{font-size:20px;margin-bottom:8px;}p{font-size:14px;color:#64748b;margin-bottom:20px;}
a{background:#6366f1;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;}</style>
</head><body><div class="box"><h1>${title}</h1><p>${src} · ${cat}</p><a href="/cursos">Ver todos os cursos →</a></div></body></html>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(html);
  } catch (_) { res.redirect('/cursos'); }
});

// ── Mentores ─────────────────────────────────────────────────
app.get('/mentores', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'mentores.html')));

app.get('/mentores/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) { res.redirect('/mentores'); return; }
  try {
    const pool = await getPool();
    const row  = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`SELECT id, name, location, bio, skills, email, photo_url FROM coaches WHERE id = @id AND active = TRUE`)
      .then(r => r.recordset[0]).catch(() => null);

    if (!row) { res.redirect('/mentores'); return; }
    const _rawM = (process.env.APP_URL || 'https://cvpremium.net').replace(/\/+$/, '');
    const BASE  = _rawM.startsWith('http') ? _rawM : 'https://' + _rawM;
    const name     = (row.Name||row.name||'Mentor').replace(/"/g,'&quot;');
    const location = row.Location||row.location||'Angola';
    const bio      = (row.Bio||row.bio||`Mentor de carreira em ${location}`).replace(/"/g,'&quot;').substring(0,200);
    const skills   = (row.Skills||row.skills||'').split(',').map(s=>s.trim()).filter(Boolean);
    const photo    = row.PhotoUrl||row.photo_url||`${BASE}/og-image.png`;
    const email    = row.Email||row.email||'';
    const pageUrl  = `${BASE}/mentores/${req.params.id}`;

    const schema = {
      "@context":"https://schema.org","@type":"Person",
      "name": name,
      "description": bio,
      "url": pageUrl,
      "image": photo,
      "address": { "@type":"PostalAddress","addressLocality":location,"addressCountry":"AO" },
      ...(skills.length ? {"knowsAbout": skills} : {}),
      ...(email ? {"email": email} : {})
    };
    const html = `<!DOCTYPE html><html lang="pt"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${name} — Mentor de Carreira | CV Premium Angola</title>
<meta name="description" content="${bio}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="profile">
<meta property="og:url" content="${pageUrl}">
<meta property="og:title" content="${name} — Mentor de Carreira">
<meta property="og:description" content="${bio}">
<meta property="og:image" content="${photo}">
<meta property="og:site_name" content="CV Premium Angola">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${name}">
<meta name="twitter:description" content="${bio}">
<meta name="twitter:image" content="${photo}">
<script type="application/ld+json">${JSON.stringify(schema)}<\/script>
<meta http-equiv="refresh" content="0;url=/mentores">
<style>body{font-family:sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#1e293b;}
.box{background:#fff;border-radius:14px;padding:32px;max-width:480px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08);}
h1{font-size:20px;margin-bottom:8px;}p{font-size:14px;color:#64748b;margin-bottom:20px;}
a{background:#6366f1;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;}</style>
</head><body><div class="box"><h1>${name}</h1><p>${location}</p><a href="/mentores">Ver todos os mentores →</a></div></body></html>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(html);
  } catch (_) { res.redirect('/mentores'); }
});

// ── Página individual de vaga com meta tags + JobPosting schema ──
app.get('/empregos/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) { res.redirect('/empregos'); return; }
  try {
    const pool = await getPool();
    const row  = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`SELECT id, title, company, city, country, category, description, salary, url, contact_type, image_url, job_date, end_date
              FROM jobs WHERE id = @id AND active = TRUE`)
      .then(r => r.recordset[0]).catch(() => null);

    const _raw = (process.env.APP_URL || 'https://cvpremium.net').replace(/\/+$/, '');
    const BASE = _raw.startsWith('http') ? _raw : 'https://' + _raw;
    const pageUrl = `${BASE}/empregos/${req.params.id}`;

    if (!row) { res.redirect('/empregos'); return; }

    const title   = (row.Title    || row.title    || 'Vaga de Emprego').replace(/"/g,'&quot;');
    const company = (row.Company  || row.company  || '').replace(/"/g,'&quot;');
    const city    = row.City      || row.city     || 'Angola';
    const country = row.Country   || row.country  || 'Angola';
    const desc    = (row.Description|| row.description || `Vaga de ${title} em ${company}`).replace(/"/g,'&quot;');
    const img     = row.ImageUrl  || row.image_url|| `${BASE}/og-image.png`;
    const salary  = row.Salary    || row.salary   || '';
    const endDate = row.EndDate   || row.end_date;
    const jobDate = row.JobDate   || row.job_date || new Date().toISOString();

    const schema = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": title,
      "description": desc,
      "hiringOrganization": { "@type": "Organization", "name": company },
      "jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": city, "addressCountry": country } },
      "datePosted": jobDate,
      "validThrough": endDate || undefined,
      "url": pageUrl,
      ...(salary ? { "baseSalary": { "@type": "MonetaryAmount", "currency": "AOA", "value": { "@type": "QuantitativeValue", "value": salary } } } : {})
    };

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title} — ${company} | CV Premium Angola</title>
<meta name="description" content="${desc.substring(0,160)}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website">
<meta property="og:url" content="${pageUrl}">
<meta property="og:title" content="${title} — ${company}">
<meta property="og:description" content="${desc.substring(0,160)}">
<meta property="og:image" content="${img}">
<meta property="og:site_name" content="CV Premium Angola">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title} — ${company}">
<meta name="twitter:description" content="${desc.substring(0,160)}">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<meta http-equiv="refresh" content="0;url=/empregos?id=${req.params.id}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{font-family:'Sora',sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#1e293b;}
.box{background:#fff;border-radius:14px;padding:32px;max-width:480px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08);}
h1{font-size:20px;margin-bottom:8px;}p{font-size:14px;color:#64748b;margin-bottom:20px;}
a{background:#6366f1;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;}</style>
</head>
<body>
<div class="box">
  <h1>${title}</h1>
  <p>${company} · ${city}, ${country}</p>
  <a href="/empregos">Ver todas as vagas →</a>
</div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (_) {
    res.redirect('/empregos');
  }
});

// ── Blog post — injectar meta tags no HTML antes de servir ───
app.get('/blog/:slug', async (req, res) => {
  try {
    const pool = await getPool();
    const row  = await pool.request()
      .input('slug', sql.NVarChar, req.params.slug)
      .query(`SELECT title, excerpt, image_url, author, published_at, category
              FROM blog_posts WHERE slug = @slug AND published = TRUE`)
      .then(r => r.recordset[0]).catch(() => null);

    const fs   = require('fs');
    let html   = fs.readFileSync(path.join(__dirname, '..', 'public', 'blog-post.html'), 'utf8');

    if (row) {
      const title  = (row.Title  || row.title  || 'Blog').replace(/"/g, '&quot;');
      const desc   = (row.Excerpt|| row.excerpt || 'Artigo do blog CV Premium Angola').replace(/"/g, '&quot;');
      const img    = row.ImageUrl|| row.image_url|| 'https://cvpremium.net/og-image.png';
      const url    = `https://cvpremium.net/blog/${req.params.slug}`;
      const author = row.Author  || row.author  || 'CV Premium';
      const date   = row.PublishedAt || row.published_at || new Date().toISOString();
      const cat    = row.Category|| row.category|| 'Geral';

      const meta = `
  <title>${title} — CV Premium Angola</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${img}">
  <meta property="og:site_name" content="CV Premium Angola">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${img}">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":"${title}","description":"${desc}","image":"${img}","url":"${url}","datePublished":"${date}","author":{"@type":"Person","name":"${author}"},"publisher":{"@type":"Organization","name":"CV Premium","logo":{"@type":"ImageObject","url":"https://cvpremium.net/og-image.png"}},"articleSection":"${cat}"}</script>`;
      html = html.replace('<title>Blog — CV Premium Angola</title>', meta);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (_) {
    res.sendFile(path.join(__dirname, '..', 'public', 'blog-post.html'));
  }
});

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

// ── Estatísticas públicas (landing page) ────────────────────
app.get('/api/stats/public', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT (SELECT COUNT(*) FROM cvs) AS total_cvs,
              (SELECT COUNT(*) FROM users) AS total_users`
    );
    const row = r.recordset[0] || {};
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
      totalCvs:   row.total_cvs   || row.TotalCvs   || 296,
      totalUsers: row.total_users || row.TotalUsers  || 206
    });
  } catch { res.json({ totalCvs: 296, totalUsers: 206 }); }
});


// Robots.txt explícito
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(require('path').join(__dirname, '../public/robots.txt'));
});

// OG image — serve o SVG como imagem para Open Graph / Twitter Card
app.get('/og-image.png', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.sendFile(require('path').join(__dirname, '../public/og-image.svg'));
});

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

// ── Injectar pool DB em cada request ────────────────────────
app.use(async (req, res, next) => {
  try { req.db = await getPool(); next(); }
  catch (err) { res.status(503).json({ error: 'Base de dados indisponível' }); }
});

// ── AI Copiloto ──────────────────────────────────────────────
app.use('/api/ai',      aiRoutes);

app.use('/api/chat',      chatRoutes);         // Chatbot IA (público)
app.use('/api/auth',      authRoutes);
app.use('/api/growth',    growthRoutes);       // Sitemap, ATS, referral, OG
app.use('/api/templates', templatesRoutes);    // Templates (GET público, POST protegido)
app.use('/api/content',  contentRoutes);       // Coaches, Courses, Jobs, Testimonials (público)
app.use('/api/empregos', empregosRoutes);      // Módulo Vagas de Emprego (público)
app.use('/api/blog',     require('./routes/blog'));  // Blog (GET público, admin protegido)

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

// ── Documentos legais (leitura pública para utilizadores autenticados) ──
app.get('/api/legal-docs', auth, async (req, res) => {
  try {
    const r = await req.db.request().query(
      `SELECT id, title, filename, file_url, file_size, created_at FROM legal_documents ORDER BY created_at DESC`
    ).catch(() => ({ recordset: [] }));
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Rotas Admin (JWT + role=admin) ──────────────────────────
app.use('/api/admin',   auth, adminOnly, adminRoutes);

// ── Marketing Automation ─────────────────────────────────────
// Rotas públicas + user: /api/marketing/track, /unsubscribe, /preferences
// Rotas admin: /api/marketing/admin/* (auth + adminOnly injectados internamente)
app.use('/api/marketing', (req, res, next) => {
  // Rotas /admin/* requerem autenticação + adminOnly
  if (req.path.startsWith('/admin')) {
    return auth(req, res, () => adminOnly(req, res, next));
  }
  next();
}, marketingRoutes);
// Injectar req.db nas rotas de marketing (o middleware de injecção DB já está activo acima)

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
    // ── user_events (criada aqui e também inline na rota de tracking) ──
    `CREATE TABLE IF NOT EXISTS user_events (
      id         SERIAL PRIMARY KEY,
      event_type VARCHAR(100),
      event      VARCHAR(80),
      page       VARCHAR(100),
      data       VARCHAR(500),
      properties TEXT,
      user_id    INTEGER,
      session_id VARCHAR(64),
      source     VARCHAR(80),
      medium     VARCHAR(80),
      campaign   VARCHAR(80),
      ip         VARCHAR(45),
      created_at TIMESTAMP DEFAULT NOW()
    )`,
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
    `CREATE TABLE IF NOT EXISTS app_settings (
      key        VARCHAR(100) PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS blog_posts (
      id           SERIAL PRIMARY KEY,
      title        VARCHAR(255) NOT NULL,
      slug         VARCHAR(300) NOT NULL UNIQUE,
      content      TEXT NOT NULL,
      excerpt      VARCHAR(300),
      image_url    TEXT,
      category     VARCHAR(100) DEFAULT 'Geral',
      author       VARCHAR(100),
      published    BOOLEAN DEFAULT FALSE,
      published_at TIMESTAMP,
      views        INTEGER DEFAULT 0,
      created_at   TIMESTAMP DEFAULT NOW()
    )`,
    `ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS image_url TEXT`,
    // ── Pagamentos (Stripe/PayPal/BCI) ──────────────────────────
    `CREATE TABLE IF NOT EXISTS payments (
      id                SERIAL PRIMARY KEY,
      user_id           INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount            NUMERIC(10,2) NOT NULL,
      currency          VARCHAR(10)   DEFAULT 'USD',
      status            VARCHAR(20)   NOT NULL DEFAULT 'pending',
      method            VARCHAR(30),
      stripe_session_id VARCHAR(255),
      paypal_order_id   VARCHAR(255),
      created_at        TIMESTAMP     DEFAULT NOW()
    )`,
    // ── Pedidos de pagamento manual (BCI/Akz) ───────────────────
    `CREATE TABLE IF NOT EXISTS payment_requests (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type         VARCHAR(20) NOT NULL,
      amount       INTEGER NOT NULL,
      cv_id        INTEGER REFERENCES cvs(id) ON DELETE SET NULL,
      status       VARCHAR(20) DEFAULT 'pending',
      admin_note   VARCHAR(255),
      created_at   TIMESTAMP DEFAULT NOW(),
      approved_at  TIMESTAMP
    )`,
    // ── Colunas users que podem faltar em BDs antigas ─────────────
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login    TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_id   VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id     VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active     BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone         VARCHAR(30)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url    VARCHAR(500)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_public_id VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at     TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by     INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expiry   TIMESTAMP`,
    // ── Índices de performance ───────────────────────────────────
    `CREATE INDEX IF NOT EXISTS ix_payments_user_id    ON payments(user_id)`,
    `CREATE INDEX IF NOT EXISTS ix_payments_status     ON payments(status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS ix_pay_req_status      ON payment_requests(status, created_at DESC)`,
    // ── Marketing Automation (tabelas) ───────────────────────────
    `CREATE TABLE IF NOT EXISTS marketing_segments (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      sql_filter  TEXT NOT NULL DEFAULT 'TRUE',
      color       VARCHAR(20) DEFAULT '#6366f1',
      created_at  TIMESTAMP DEFAULT NOW(),
      updated_at  TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS campaigns (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(200) NOT NULL,
      subject       VARCHAR(300),
      channel       VARCHAR(20) DEFAULT 'email',
      template_key  VARCHAR(80),
      body_html     TEXT,
      body_text     TEXT,
      segment_id    INTEGER REFERENCES marketing_segments(id),
      status        VARCHAR(20) DEFAULT 'draft',
      scheduled_at  TIMESTAMP,
      sent_at       TIMESTAMP,
      total_sent    INTEGER DEFAULT 0,
      total_opened  INTEGER DEFAULT 0,
      total_clicked INTEGER DEFAULT 0,
      created_by    INTEGER REFERENCES users(id),
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS campaign_sends (
      id           SERIAL PRIMARY KEY,
      campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      email        VARCHAR(200),
      channel      VARCHAR(20) DEFAULT 'email',
      sent_at      TIMESTAMP DEFAULT NOW(),
      opened_at    TIMESTAMP,
      clicked_at   TIMESTAMP,
      bounce       BOOLEAN DEFAULT FALSE,
      UNIQUE(campaign_id, email)
    )`,
    `CREATE TABLE IF NOT EXISTS automation_rules (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(200) NOT NULL,
      trigger_event VARCHAR(80) NOT NULL,
      delay_hours   INTEGER DEFAULT 0,
      channel       VARCHAR(20) DEFAULT 'email',
      subject       VARCHAR(300),
      body_html     TEXT,
      body_text     TEXT,
      condition_sql TEXT,
      active        BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS automation_sends (
      id           SERIAL PRIMARY KEY,
      rule_id      INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
      user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      email        VARCHAR(200),
      triggered_at TIMESTAMP DEFAULT NOW(),
      sent_at      TIMESTAMP,
      UNIQUE(rule_id, email)
    )`,
    `CREATE TABLE IF NOT EXISTS leads (
      id         SERIAL PRIMARY KEY,
      email      VARCHAR(200) UNIQUE NOT NULL,
      name       VARCHAR(200),
      phone      VARCHAR(30),
      ats_score  INTEGER,
      source     VARCHAR(80),
      converted  BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    // ── Colunas Marketing em users ────────────────────────────────
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_email     BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_whatsapp  BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_sms       BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS unsubscribe_token   VARCHAR(64)`,
    // ── user_events: adicionar colunas marketing SE faltarem ──────
    // (o autoMigrate criou com event_type; marketing usa event)
    `ALTER TABLE user_events ADD COLUMN IF NOT EXISTS event      VARCHAR(80)`,
    `ALTER TABLE user_events ADD COLUMN IF NOT EXISTS properties TEXT`,
    `ALTER TABLE user_events ADD COLUMN IF NOT EXISTS source     VARCHAR(80)`,
    `ALTER TABLE user_events ADD COLUMN IF NOT EXISTS medium     VARCHAR(80)`,
    `ALTER TABLE user_events ADD COLUMN IF NOT EXISTS campaign   VARCHAR(80)`,
    `ALTER TABLE user_events ADD COLUMN IF NOT EXISTS ip         VARCHAR(45)`,
    // ── user_events: adicionar event_type SE foi criado pelo marketing ─
    `ALTER TABLE user_events ADD COLUMN IF NOT EXISTS event_type VARCHAR(100)`,
    // ── cvs: estado rascunho/concluído ───────────────────────────────
    `ALTER TABLE cvs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'`,
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

async function startWithRetry(maxRetries = 5, delayMs = 3000) {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não está definida. Define esta variável no painel do Render (Environment).');
    process.exit(1);
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const pool = await getPool();
      await autoMigrate(pool);
      await migrateChatKnowledge(pool);
      redisConnector.del('admin:overview').catch(() => {});
      setupCrons(pool);
      setTimeout(() => importJobs(pool).catch(() => {}), 10000);
      server.listen(PORT, () => {
        console.log(`\n🚀 CV Premium`);
        console.log(`   Local:   http://localhost:${PORT}`);
        console.log(`   Admin:   http://localhost:${PORT}/api/admin/overview`);
        console.log(`   Health:  http://localhost:${PORT}/health`);
        console.log(`   Env:     ${process.env.NODE_ENV || 'development'}\n`);
      });
      return;
    } catch (err) {
      console.error(`❌ Tentativa ${attempt}/${maxRetries} falhou: ${err.message}`);
      if (attempt === maxRetries) {
        console.error('❌ Não foi possível ligar à base de dados. Verifica DATABASE_URL no Render.');
        process.exit(1);
      }
      console.log(`   A aguardar ${delayMs / 1000}s antes de tentar novamente...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

startWithRetry();

module.exports = { app, server };
