// src/routes/empregos.js
// ─────────────────────────────────────────────────────────────
// Módulo de Vagas de Emprego — listagem pública + importação
// APIs suportadas: Adzuna (ADZUNA_APP_ID + ADZUNA_APP_KEY)
//                 Jooble  (JOOBLE_API_KEY)
//                 Demo    (fallback automático)
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { sql } = require('../config/database');

// ── Garantir colunas novas na tabela jobs ─────────────────────
async function migrateTable(db) {
  await db.request().query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary VARCHAR(100)`).catch(() => {});
  await db.request().query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source VARCHAR(100)`).catch(() => {});
}

// ── Construir WHERE dinamicamente (parâmetros seguros) ────────
function buildWhere(r, { search = '', city = '', remote = '' }) {
  const parts = ['active = TRUE'];

  if (search) {
    const s = search.substring(0, 100);
    r.input('st', sql.VarChar, `%${s}%`);
    r.input('sc', sql.VarChar, `%${s}%`);
    r.input('sd', sql.VarChar, `%${s}%`);
    parts.push('(title ILIKE @st OR company ILIKE @sc OR description ILIKE @sd)');
  }
  if (city) {
    const c = city.substring(0, 100);
    r.input('ci', sql.VarChar, `%${c}%`);
    r.input('co', sql.VarChar, `%${c}%`);
    parts.push('(city ILIKE @ci OR country ILIKE @co)');
  }
  if (remote === '1') {
    parts.push("(city ILIKE '%remot%' OR title ILIKE '%remot%' OR description ILIKE '%remot%')");
  }

  return 'WHERE ' + parts.join(' AND ');
}

// ── GET /api/empregos — listagem pública com filtros ──────────
router.get('/', async (req, res) => {
  try {
    const { search = '', city = '', remote = '', page = '1', limit = '20' } = req.query;
    const lim = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const off = (Math.max(1, parseInt(page) || 1) - 1) * lim;

    const r1 = req.db.request();
    const where = buildWhere(r1, { search, city, remote });
    r1.input('lim', sql.Int, lim);
    r1.input('off', sql.Int, off);

    const r2 = req.db.request();
    buildWhere(r2, { search, city, remote });

    const [rows, cnt] = await Promise.all([
      r1.query(`SELECT id, title, company, city, country, category, description,
                       salary, url, source, job_date, created_at
                FROM jobs ${where}
                ORDER BY created_at DESC
                LIMIT @lim OFFSET @off`),
      r2.query(`SELECT COUNT(*) AS total FROM jobs ${where}`)
    ]);

    res.json({
      jobs:  rows.recordset,
      total: parseInt(cnt.recordset[0].total) || 0,
      page:  parseInt(page) || 1,
      limit: lim
    });
  } catch (e) {
    console.error('[empregos] list:', e.message);
    res.status(500).json({ error: 'Erro ao carregar vagas' });
  }
});

// ── GET /api/empregos/destacadas — 5 vagas para dashboard ─────
router.get('/destacadas', async (req, res) => {
  try {
    const r = await req.db.request().query(
      `SELECT id, title, company, city, country, category, salary, url, source
       FROM jobs WHERE active = TRUE ORDER BY created_at DESC LIMIT 5`
    );
    res.json({ jobs: r.recordset });
  } catch (e) {
    console.error('[empregos] destacadas:', e.message);
    res.status(500).json({ error: 'Erro' });
  }
});

// ── Importar via Adzuna ───────────────────────────────────────
async function importAdzuna(db) {
  const appId   = process.env.ADZUNA_APP_ID;
  const appKey  = process.env.ADZUNA_APP_KEY;
  const country = process.env.ADZUNA_COUNTRY || 'za';
  if (!appId || !appKey) return false;

  try {
    const { data } = await axios.get(
      `https://api.adzuna.com/v1/api/jobs/${country}/search/1`,
      { params: { app_id: appId, app_key: appKey, results_per_page: 50 }, timeout: 15000 }
    );
    let n = 0;
    for (const j of (data.results || [])) {
      const title  = (j.title || '').substring(0, 255);
      const comp   = ((j.company?.display_name) || 'Empresa').substring(0, 255);
      const loc    = (j.location?.display_name || '').substring(0, 100);
      const desc   = (j.description || '').substring(0, 2000);
      const url    = (j.redirect_url || '').substring(0, 500);
      const salary = j.salary_min ? `${Math.round(j.salary_min).toLocaleString('pt-AO')} Kz` : null;
      await db.request()
        .input('t',   sql.VarChar, title)
        .input('c',   sql.VarChar, comp)
        .input('l',   sql.VarChar, loc)
        .input('d',   sql.VarChar, desc)
        .input('u',   sql.VarChar, url)
        .input('s',   sql.VarChar, salary)
        .input('src', sql.VarChar, 'adzuna')
        .query(`INSERT INTO jobs (title,company,city,description,url,salary,source,active,created_at)
                SELECT @t,@c,@l,@d,@u,@s,@src,TRUE,NOW()
                WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE url=@u AND url!='')`).catch(() => {});
      n++;
    }
    console.log(`[empregos] Adzuna: ${n} vagas`);
    return true;
  } catch (e) {
    console.error('[empregos] Adzuna:', e.message);
    return false;
  }
}

// ── Importar via Jooble ───────────────────────────────────────
async function importJooble(db) {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) return false;

  try {
    const { data } = await axios.post(
      `https://jooble.org/api/${key}`,
      { keywords: '', location: 'Angola', resultsOnPage: 50 },
      { timeout: 15000 }
    );
    let n = 0;
    for (const j of (data.jobs || [])) {
      const title  = (j.title   || '').substring(0, 255);
      const comp   = (j.company || 'Empresa').substring(0, 255);
      const loc    = (j.location || 'Angola').substring(0, 100);
      const desc   = (j.snippet || '').substring(0, 2000);
      const url    = (j.link    || '').substring(0, 500);
      const salary = j.salary ? String(j.salary).substring(0, 100) : null;
      await db.request()
        .input('t',   sql.VarChar, title)
        .input('c',   sql.VarChar, comp)
        .input('l',   sql.VarChar, loc)
        .input('d',   sql.VarChar, desc)
        .input('u',   sql.VarChar, url)
        .input('s',   sql.VarChar, salary)
        .input('src', sql.VarChar, 'jooble')
        .query(`INSERT INTO jobs (title,company,city,description,url,salary,source,active,created_at)
                SELECT @t,@c,@l,@d,@u,@s,@src,TRUE,NOW()
                WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE url=@u AND url!='')`).catch(() => {});
      n++;
    }
    console.log(`[empregos] Jooble: ${n} vagas`);
    return true;
  } catch (e) {
    console.error('[empregos] Jooble:', e.message);
    return false;
  }
}

// ── Seed de vagas demo (quando sem API key) ───────────────────
async function seedDemoJobs(db) {
  const cnt = await db.request()
    .query(`SELECT COUNT(*) AS n FROM jobs WHERE source='demo'`)
    .catch(() => ({ recordset: [{ n: 1 }] }));
  if (parseInt(cnt.recordset[0].n) > 0) return;

  const demos = [
    { t: 'Desenvolvedor Full-Stack',         c: 'TechAngola Lda',    l: 'Luanda',    cat: 'Tecnologia',   d: 'Procuramos dev full-stack com experiência em Node.js, React e bases de dados SQL/NoSQL para integrar equipa de produto.', salary: '250.000 Kz' },
    { t: 'Gestor de Projecto Sénior',         c: 'Sonangol EP',       l: 'Luanda',    cat: 'Gestão',        d: 'Vaga para gestor de projecto com experiência em PMI/Agile. Responsável por projectos de transformação digital.', salary: '400.000 Kz' },
    { t: 'Analista Financeiro',               c: 'Banco BFA',         l: 'Luanda',    cat: 'Finanças',      d: 'Análise de dados financeiros, elaboração de relatórios e apoio à tomada de decisão estratégica da direcção.', salary: '300.000 Kz' },
    { t: 'Designer UI/UX',                    c: 'Criativa Agency',   l: 'Luanda',    cat: 'Design',        d: 'Criar interfaces digitais de alto impacto, protótipos no Figma e guias de estilo para clientes nacionais e internacionais.', salary: '180.000 Kz' },
    { t: 'Engenheiro Civil',                  c: 'Mota-Engil Angola', l: 'Luanda',    cat: 'Engenharia',    d: 'Supervisão de obras de construção civil, coordenação de equipas e controlo de qualidade em projectos de infra-estruturas.', salary: '350.000 Kz' },
    { t: 'Especialista em Marketing Digital', c: 'Unitel',            l: 'Luanda',    cat: 'Marketing',     d: 'Gestão de campanhas digitais, SEO, redes sociais e análise de métricas de performance para marca de telecomunicações.', salary: '220.000 Kz' },
    { t: 'Técnico de Redes e Sistemas',       c: 'Multichoice Angola',l: 'Luanda',    cat: 'Tecnologia',    d: 'Administração de redes, manutenção de servidores e suporte técnico de nível 2 para infra-estrutura corporativa.', salary: '200.000 Kz' },
    { t: 'Contabilista Sénior',               c: 'Deloitte Angola',   l: 'Luanda',    cat: 'Finanças',      d: 'Elaboração de relatórios financeiros, auditoria interna e consultoria fiscal para carteira de clientes corporativos.', salary: '280.000 Kz' },
    { t: 'Gestor de Recursos Humanos',        c: 'TAAG Linhas Aéreas',l: 'Luanda',    cat: 'Recursos Humanos', d: 'Recrutamento, avaliação de desempenho e implementação de políticas de RH numa das maiores empresas nacionais.', salary: '260.000 Kz' },
    { t: 'Advogado Corporativo',              c: 'Miranda & Associados',l:'Luanda',   cat: 'Jurídico',      d: 'Assessoria jurídica a empresas em direito comercial, contratos, direito petrolífero e transacções internacionais.', salary: '450.000 Kz' },
    { t: 'Coordenador de Logística',          c: 'DHL Angola',        l: 'Luanda',    cat: 'Logística',     d: 'Coordenação de operações de armazém, gestão de transportadoras e optimização de rotas de distribuição.', salary: '190.000 Kz' },
    { t: 'Médico Clínico Geral',              c: 'Clínica Girassol',  l: 'Luanda',    cat: 'Saúde',         d: 'Consultas de medicina geral e familiar, urgências e acompanhamento de pacientes em clínica privada de referência.', salary: '500.000 Kz' },
  ];

  for (const j of demos) {
    await db.request()
      .input('t',   sql.VarChar, j.t)
      .input('c',   sql.VarChar, j.c)
      .input('l',   sql.VarChar, j.l)
      .input('cat', sql.VarChar, j.cat)
      .input('d',   sql.VarChar, j.d)
      .input('sal', sql.VarChar, j.salary)
      .input('src', sql.VarChar, 'demo')
      .query(`INSERT INTO jobs (title,company,city,category,description,salary,url,source,active,created_at)
              VALUES (@t,@c,@l,@cat,@d,@sal,'https://cvpremium.net/empregos',@src,TRUE,NOW())`).catch(() => {});
  }
  console.log('[empregos] Demo jobs inseridos');
}

// ── Função principal (chamada pelo cron) ──────────────────────
async function importJobs(db) {
  try {
    await migrateTable(db);
    // Limpar vagas importadas com mais de 7 dias
    await db.request()
      .query(`DELETE FROM jobs WHERE source IN ('adzuna','jooble') AND created_at < NOW() - INTERVAL '7 days'`)
      .catch(() => {});
    const ok = await importAdzuna(db) || await importJooble(db);
    if (!ok) await seedDemoJobs(db);
  } catch (e) {
    console.error('[empregos] importJobs:', e.message);
  }
}

module.exports = { router, importJobs, migrateTable };
