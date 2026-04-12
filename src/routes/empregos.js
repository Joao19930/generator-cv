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
  await db.request().query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_date DATE`).catch(() => {});
  await db.request().query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_date DATE`).catch(() => {});
  await db.request().query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP`).catch(() => {});
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
                       salary, url, source, job_date, end_date, imported_at, created_at, image_url, vacancies
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

// ── Inserir uma vaga (INSERT simples sem @param duplicado) ────
async function insertJob(db, { title, company, city, description, url, salary, source, category, job_date, deadline }) {
  // Normalizar datas recebidas da API
  const parseDate = v => {
    if (!v) return null;
    try { const d = new Date(v); return isNaN(d.getTime()) ? null : d; } catch { return null; }
  };
  const jd = parseDate(job_date);
  const dl = parseDate(deadline);

  await db.request()
    .input('t',    sql.VarChar,   (title   || '').substring(0, 255))
    .input('c',    sql.VarChar,   (company || 'Empresa').substring(0, 255))
    .input('l',    sql.VarChar,   (city    || '').substring(0, 100))
    .input('cat',  sql.VarChar,   (category|| '').substring(0, 100))
    .input('d',    sql.VarChar,   (description || '').substring(0, 2000))
    .input('u',    sql.VarChar,   (url     || '').substring(0, 500))
    .input('s',    sql.VarChar,   salary ? String(salary).substring(0, 100) : null)
    .input('src',  sql.VarChar,   source || 'manual')
    .input('jd',   sql.Date,      jd)
    .input('dl',   sql.Date,      dl)
    .query(`INSERT INTO jobs (title,company,city,category,description,url,salary,source,job_date,end_date,imported_at,active,created_at)
            VALUES (@t,@c,@l,@cat,@d,@u,@s,@src,@jd,@dl,NOW(),TRUE,NOW())`);
}

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
    const results = data.results || [];
    if (!results.length) { console.warn('[empregos] Adzuna: 0 resultados recebidos'); return false; }
    for (const j of results) {
      await insertJob(db, {
        title:       j.title,
        company:     j.company?.display_name,
        city:        j.location?.display_name,
        description: j.description,
        url:         j.redirect_url,
        salary:      j.salary_min ? `${Math.round(j.salary_min).toLocaleString('pt-AO')} Kz` : null,
        source:      'adzuna',
        category:    j.category?.tag || '',
        job_date:    j.created || null,
        deadline:    null
      }).catch(e => console.warn('[empregos] insert err:', e.message));
    }
    console.log(`[empregos] Adzuna: ${results.length} vagas importadas`);
    return true;
  } catch (e) {
    console.error('[empregos] Adzuna:', e.message);
    return false;
  }
}

// ── Importar via Arbeitnow (sem chave) ────────────────────────
async function importArbeitnow(db) {
  try {
    const { data } = await axios.get(
      'https://arbeitnow.com/api/job-board-api',
      { timeout: 15000 }
    );
    const jobs = data.data || [];
    if (!jobs.length) { console.warn('[empregos] Arbeitnow: 0 resultados'); return 0; }
    let ok = 0;
    for (const j of jobs) {
      await insertJob(db, {
        title:       j.title,
        company:     j.company_name,
        city:        j.remote ? 'Remoto' : (j.location || ''),
        description: (j.description || '').substring(0, 2000),
        url:         j.url,
        salary:      null,
        source:      'arbeitnow',
        category:    (j.tags && j.tags[0]) || '',
        job_date:    j.created_at || null,
        deadline:    null
      }).then(() => ok++).catch(e => console.warn('[empregos] arbeitnow insert:', e.message));
    }
    console.log(`[empregos] Arbeitnow: ${ok} vagas importadas`);
    return ok;
  } catch (e) {
    console.error('[empregos] Arbeitnow:', e.message);
    return 0;
  }
}

// ── Importar via Remotive (sem chave) ─────────────────────────
async function importRemotive(db) {
  try {
    const { data } = await axios.get(
      'https://remotive.com/api/remote-jobs',
      { params: { limit: 50 }, timeout: 15000 }
    );
    const jobs = data.jobs || [];
    if (!jobs.length) { console.warn('[empregos] Remotive: 0 resultados'); return 0; }
    let ok = 0;
    for (const j of jobs) {
      await insertJob(db, {
        title:       j.title,
        company:     j.company_name,
        city:        j.candidate_required_location || 'Remoto',
        description: (j.description || '').replace(/<[^>]+>/g, '').substring(0, 2000),
        url:         j.url,
        salary:      j.salary ? String(j.salary).substring(0, 100) : null,
        source:      'remotive',
        category:    j.category || '',
        job_date:    j.publication_date || null,
        deadline:    null
      }).then(() => ok++).catch(e => console.warn('[empregos] remotive insert:', e.message));
    }
    console.log(`[empregos] Remotive: ${ok} vagas importadas`);
    return ok;
  } catch (e) {
    console.error('[empregos] Remotive:', e.message);
    return 0;
  }
}

// ── Importar via Jobicy (sem chave) ───────────────────────────
async function importJobicy(db) {
  try {
    const { data } = await axios.get(
      'https://jobicy.com/api/v2/remote-jobs',
      { params: { count: 50 }, timeout: 15000 }
    );
    const jobs = data.jobs || [];
    if (!jobs.length) { console.warn('[empregos] Jobicy: 0 resultados'); return 0; }
    let ok = 0;
    for (const j of jobs) {
      const salary = j.annualSalaryMin
        ? `${j.annualSalaryMin}–${j.annualSalaryMax || j.annualSalaryMin} ${j.salaryCurrency || 'USD'}/ano`
        : null;
      await insertJob(db, {
        title:       j.jobTitle,
        company:     j.companyName,
        city:        j.jobGeo || 'Remoto',
        description: (j.jobDescription || '').replace(/<[^>]+>/g, '').substring(0, 2000),
        url:         j.url,
        salary:      salary,
        source:      'jobicy',
        category:    j.jobIndustry || '',
        job_date:    j.pubDate || null,
        deadline:    null
      }).then(() => ok++).catch(e => console.warn('[empregos] jobicy insert:', e.message));
    }
    console.log(`[empregos] Jobicy: ${ok} vagas importadas`);
    return ok;
  } catch (e) {
    console.error('[empregos] Jobicy:', e.message);
    return 0;
  }
}

// ── Importar via Himalayas (sem chave) ────────────────────────
async function importHimalayas(db) {
  try {
    const { data } = await axios.get(
      'https://himalayas.app/jobs/api',
      { params: { limit: 50 }, timeout: 15000 }
    );
    const jobs = data.jobs || [];
    if (!jobs.length) { console.warn('[empregos] Himalayas: 0 resultados'); return 0; }
    let ok = 0;
    for (const j of jobs) {
      const loc = Array.isArray(j.locations) && j.locations.length ? j.locations[0] : 'Remoto';
      await insertJob(db, {
        title:       j.title,
        company:     j.company?.name || j.companyName || '',
        city:        typeof loc === 'string' ? loc : (loc.name || 'Remoto'),
        description: (j.description || '').replace(/<[^>]+>/g, '').substring(0, 2000),
        url:         j.applyUrl || j.url || '',
        salary:      j.salary ? String(j.salary).substring(0, 100) : null,
        source:      'himalayas',
        category:    (j.tags && j.tags[0]) || '',
        job_date:    j.publishedAt || null,
        deadline:    null
      }).then(() => ok++).catch(e => console.warn('[empregos] himalayas insert:', e.message));
    }
    console.log(`[empregos] Himalayas: ${ok} vagas importadas`);
    return ok;
  } catch (e) {
    console.error('[empregos] Himalayas:', e.message);
    return 0;
  }
}

// ── Importar via The Muse (sem chave) ─────────────────────────
async function importTheMuse(db) {
  try {
    const { data } = await axios.get(
      'https://www.themuse.com/api/public/jobs',
      { params: { page: 0, descending: true }, timeout: 15000 }
    );
    const jobs = data.results || [];
    if (!jobs.length) { console.warn('[empregos] The Muse: 0 resultados'); return 0; }
    let ok = 0;
    for (const j of jobs) {
      const loc = j.locations && j.locations[0] ? j.locations[0].name : 'Internacional';
      const cat = j.categories && j.categories[0] ? j.categories[0].name : '';
      await insertJob(db, {
        title:       j.name,
        company:     j.company?.name || '',
        city:        loc,
        description: (j.contents || '').replace(/<[^>]+>/g, '').substring(0, 2000),
        url:         j.refs?.landing_page || '',
        salary:      null,
        source:      'themuse',
        category:    cat,
        job_date:    j.publication_date || null,
        deadline:    null
      }).then(() => ok++).catch(e => console.warn('[empregos] themuse insert:', e.message));
    }
    console.log(`[empregos] The Muse: ${ok} vagas importadas`);
    return ok;
  } catch (e) {
    console.error('[empregos] The Muse:', e.message);
    return 0;
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
    const jobs = data.jobs || [];
    if (!jobs.length) { console.warn('[empregos] Jooble: 0 resultados'); return false; }
    for (const j of jobs) {
      await insertJob(db, {
        title:       j.title,
        company:     j.company,
        city:        j.location,
        description: j.snippet,
        url:         j.link,
        salary:      j.salary,
        source:      'jooble',
        job_date:    j.updated || null,
        deadline:    null
      }).catch(e => console.warn('[empregos] insert err:', e.message));
    }
    console.log(`[empregos] Jooble: ${jobs.length} vagas importadas`);
    return true;
  } catch (e) {
    console.error('[empregos] Jooble:', e.message);
    return false;
  }
}

// ── Seed de vagas demo (quando sem API key) ───────────────────
async function seedDemoJobs(db) {
  // Limpa demos antigas e re-insere sempre (para apanhar actualizações)
  await db.request()
    .query(`DELETE FROM jobs WHERE source='demo'`)
    .catch(() => {});

  const demos = [
    // ── Tecnologia ──────────────────────────────────────────────
    { t: 'Desenvolvedor Full-Stack',         c: 'TechAngola Lda',       l: 'Luanda',    cat: 'Tecnologia',       d: 'Procuramos dev full-stack com experiência em Node.js, React e bases de dados SQL/NoSQL para integrar equipa de produto.', salary: '250.000 Kz' },
    { t: 'Técnico de Redes e Sistemas',      c: 'Multichoice Angola',   l: 'Luanda',    cat: 'Tecnologia',       d: 'Administração de redes, manutenção de servidores e suporte técnico de nível 2 para infra-estrutura corporativa.', salary: '200.000 Kz' },
    // ── Gestão ──────────────────────────────────────────────────
    { t: 'Gestor de Projecto Sénior',        c: 'Sonangol EP',          l: 'Luanda',    cat: 'Gestão',           d: 'Vaga para gestor de projecto com experiência em PMI/Agile. Responsável por projectos de transformação digital.', salary: '400.000 Kz' },
    { t: 'Director de Operações',            c: 'Grupo Zahara',         l: 'Luanda',    cat: 'Gestão',           d: 'Supervisão das operações diárias do grupo, gestão de KPIs, coordenação de direcções e reporte à administração.', salary: '550.000 Kz' },
    // ── Finanças ────────────────────────────────────────────────
    { t: 'Analista Financeiro',              c: 'Banco BFA',            l: 'Luanda',    cat: 'Finanças',         d: 'Análise de dados financeiros, elaboração de relatórios e apoio à tomada de decisão estratégica da direcção.', salary: '300.000 Kz' },
    { t: 'Contabilista Sénior',              c: 'Deloitte Angola',      l: 'Luanda',    cat: 'Finanças',         d: 'Elaboração de relatórios financeiros, auditoria interna e consultoria fiscal para carteira de clientes corporativos.', salary: '280.000 Kz' },
    // ── Comercial ───────────────────────────────────────────────
    { t: 'Gestor Comercial',                 c: 'Refriango',            l: 'Luanda',    cat: 'Comercial',        d: 'Gestão de carteira de clientes B2B, prospeção de novos mercados e cumprimento de metas mensais de vendas. Experiência mínima 3 anos.', salary: '280.000 Kz' },
    { t: 'Representante Comercial',          c: 'Coca-Cola SABCO Angola',l:'Luanda',    cat: 'Comercial',        d: 'Visitas a pontos de venda, negociação com distribuidores e acompanhamento de volumes de vendas por rota definida.', salary: '180.000 Kz' },
    { t: 'Director Comercial',               c: 'Angola Cables',        l: 'Luanda',    cat: 'Comercial',        d: 'Liderança da equipa comercial de 25 pessoas, definição de estratégia de vendas e crescimento de receita em 30%. Mínimo 7 anos de experiência.', salary: '600.000 Kz' },
    { t: 'Supervisor de Vendas',             c: 'Unilever Angola',      l: 'Luanda',    cat: 'Comercial',        d: 'Supervisão de equipa de vendedores, acompanhamento no terreno, análise de dados de sell-out e formação da equipa.', salary: '230.000 Kz' },
    { t: 'Agente de Vendas Externo',         c: 'Águas Caxito',         l: 'Bengo',     cat: 'Comercial',        d: 'Prospeção e captação de novos clientes para abastecimento de água, elaboração de propostas e seguimento pós-venda.', salary: '150.000 Kz' },
    { t: 'Key Account Manager',              c: 'Nestlé Angola',        l: 'Luanda',    cat: 'Comercial',        d: 'Gestão de contas estratégicas no canal moderno (supermercados, grossistas), negociação de espaço e promoções.', salary: '320.000 Kz' },
    // ── Seguradora ──────────────────────────────────────────────
    { t: 'Gestor de Sinistros',              c: 'NOSSA Seguros',        l: 'Luanda',    cat: 'Seguradora',       d: 'Análise e gestão de processos de sinistros auto, habitação e vida. Negociação com peritos, reparadores e clientes.', salary: '220.000 Kz' },
    { t: 'Actuário Júnior',                  c: 'AAA Seguros',          l: 'Luanda',    cat: 'Seguradora',       d: 'Cálculo de prémios, reservas técnicas e análise de risco actuarial para produtos de seguro de vida e não-vida.', salary: '300.000 Kz' },
    { t: 'Agente de Seguros',                c: 'ENSA Seguros',         l: 'Luanda',    cat: 'Seguradora',       d: 'Prospeção e venda de apólices (auto, saúde, vida, habitação), acompanhamento de carteira e renovações anuais.', salary: '160.000 Kz' },
    { t: 'Gestor de Apólices Empresariais',  c: 'Global Alliance Seguros',l:'Luanda',   cat: 'Seguradora',       d: 'Gestão de seguros colectivos, saúde empresarial e patrimónios para carteira de clientes corporativos.', salary: '280.000 Kz' },
    { t: 'Técnico de Subscrição de Seguros', c: 'Nossa Seguros',        l: 'Luanda',    cat: 'Seguradora',       d: 'Avaliação e aceitação de riscos de seguros não-vida, análise de propostas e definição de condições de cobertura.', salary: '240.000 Kz' },
    { t: 'Inspector de Sinistros Auto',      c: 'AAA Seguros',          l: 'Luanda',    cat: 'Seguradora',       d: 'Vistoria de veículos sinistrados, levantamento de danos, peritagem e elaboração de relatórios técnicos de avaliação.', salary: '200.000 Kz' },
    // ── Banca ────────────────────────────────────────────────────
    { t: 'Gestor de Cliente Empresarial',    c: 'Banco BIC',            l: 'Luanda',    cat: 'Banca',            d: 'Gestão de carteira de empresas, análise de crédito, produtos de cash management e apoio às necessidades financeiras dos clientes.', salary: '350.000 Kz' },
    { t: 'Analista de Crédito',              c: 'Banco Millennium Atlântico',l:'Luanda', cat: 'Banca',            d: 'Análise de processos de crédito empresarial, avaliação de risco, elaboração de pareceres e acompanhamento de carteira.', salary: '290.000 Kz' },
    { t: 'Caixa Bancário',                   c: 'Banco Keve',           l: 'Luanda',    cat: 'Banca',            d: 'Atendimento ao balcão, processamento de operações de caixa, câmbio de moeda e suporte a produtos bancários de retalho.', salary: '130.000 Kz' },
    { t: 'Gestor de Conta Particulares',     c: 'Banco BAI',            l: 'Luanda',    cat: 'Banca',            d: 'Gestão de carteira de clientes particulares, promoção de produtos de poupança, crédito pessoal e cartões.', salary: '220.000 Kz' },
    { t: 'Responsável de Compliance Bancário',c:'Banco BFA',            l: 'Luanda',    cat: 'Banca',            d: 'Implementação de políticas de conformidade regulatória, prevenção de branqueamento de capitais e reporte ao BNA.', salary: '420.000 Kz' },
    { t: 'Analista de Risco de Mercado',     c: 'Banco de Poupança e Crédito',l:'Luanda',cat:'Banca',            d: 'Monitorização de riscos de mercado, taxa de juro e liquidez. Elaboração de relatórios de stress testing e ALM.', salary: '380.000 Kz' },
    { t: 'Director de Agência Bancária',     c: 'Banco Sol',            l: 'Benguela',  cat: 'Banca',            d: 'Gestão operacional e comercial da agência, liderança de equipa, cumprimento de metas e qualidade de atendimento.', salary: '480.000 Kz' },
    // ── Outros ──────────────────────────────────────────────────
    { t: 'Designer UI/UX',                   c: 'Criativa Agency',      l: 'Luanda',    cat: 'Design',           d: 'Criar interfaces digitais de alto impacto, protótipos no Figma e guias de estilo para clientes nacionais e internacionais.', salary: '180.000 Kz' },
    { t: 'Engenheiro Civil',                 c: 'Mota-Engil Angola',    l: 'Luanda',    cat: 'Engenharia',       d: 'Supervisão de obras de construção civil, coordenação de equipas e controlo de qualidade em projectos de infra-estruturas.', salary: '350.000 Kz' },
    { t: 'Especialista em Marketing Digital',c: 'Unitel',               l: 'Luanda',    cat: 'Marketing',        d: 'Gestão de campanhas digitais, SEO, redes sociais e análise de métricas de performance para marca de telecomunicações.', salary: '220.000 Kz' },
    { t: 'Gestor de Recursos Humanos',       c: 'TAAG Linhas Aéreas',   l: 'Luanda',    cat: 'Recursos Humanos', d: 'Recrutamento, avaliação de desempenho e implementação de políticas de RH numa das maiores empresas nacionais.', salary: '260.000 Kz' },
    { t: 'Advogado Corporativo',             c: 'Miranda & Associados', l: 'Luanda',    cat: 'Jurídico',         d: 'Assessoria jurídica a empresas em direito comercial, contratos, direito petrolífero e transacções internacionais.', salary: '450.000 Kz' },
    { t: 'Coordenador de Logística',         c: 'DHL Angola',           l: 'Luanda',    cat: 'Logística',        d: 'Coordenação de operações de armazém, gestão de transportadoras e optimização de rotas de distribuição.', salary: '190.000 Kz' },
    { t: 'Médico Clínico Geral',             c: 'Clínica Girassol',     l: 'Luanda',    cat: 'Saúde',            d: 'Consultas de medicina geral e familiar, urgências e acompanhamento de pacientes em clínica privada de referência.', salary: '500.000 Kz' },
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

// ── Função principal (chamada pelo cron e no arranque) ────────
const ALL_EXTERNAL_SOURCES = `'adzuna','jooble','arbeitnow','remotive','jobicy','himalayas','themuse'`;

async function cleanOldInternational(db) {
  const r = await db.request()
    .query(`DELETE FROM jobs
            WHERE source IN (${ALL_EXTERNAL_SOURCES})
              AND job_date < NOW() - INTERVAL '20 days'
            RETURNING id`)
    .catch(() => ({ recordset: [] }));
  const n = r.recordset?.length || 0;
  if (n) console.log(`[empregos] ${n} vagas internacionais com >20 dias removidas`);
  return n;
}

async function importJobs(db) {
  try {
    await migrateTable(db);
    // Apagar vagas antigas antes de re-importar (evita duplicados)
    await db.request()
      .query(`DELETE FROM jobs WHERE source IN (${ALL_EXTERNAL_SOURCES})`)
      .catch(() => {});

    let total = 0;
    // APIs pagas (se configuradas)
    if (await importAdzuna(db)) total++;
    if (await importJooble(db)) total++;
    // APIs gratuitas (sem chave)
    total += await importArbeitnow(db);
    total += await importRemotive(db);
    total += await importJobicy(db);
    total += await importHimalayas(db);
    total += await importTheMuse(db);

    if (!total) {
      console.log('[empregos] Todas as APIs falharam — a usar vagas demo');
      await seedDemoJobs(db);
    }

    // Remover vagas internacionais com mais de 20 dias
    await cleanOldInternational(db);
  } catch (e) {
    console.error('[empregos] importJobs:', e.message);
  }
}

// ── GET /api/empregos/debug — diagnóstico ────────────────────
router.get('/debug', async (req, res) => {
  const info = {};
  try {
    info.adzuna_id  = process.env.ADZUNA_APP_ID  ? '✓ configurado' : '✗ em falta';
    info.adzuna_key = process.env.ADZUNA_APP_KEY ? '✓ configurado' : '✗ em falta';
    info.jooble_key = process.env.JOOBLE_API_KEY ? '✓ configurado' : '✗ em falta';
    info.country    = process.env.ADZUNA_COUNTRY || 'za (padrão)';
    const cnt = await req.db.request().query(`SELECT COUNT(*) AS total FROM jobs`);
    info.total_jobs = parseInt(cnt.recordset[0].total);
    const src = await req.db.request().query(`SELECT source, COUNT(*) AS n FROM jobs GROUP BY source`);
    info.by_source = src.recordset;
    const sample = await req.db.request().query(`SELECT id,title,company,city,source FROM jobs ORDER BY created_at DESC LIMIT 3`);
    info.sample = sample.recordset;
    if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
      try {
        const r = await axios.get(
          `https://api.adzuna.com/v1/api/jobs/${process.env.ADZUNA_COUNTRY||'za'}/search/1`,
          { params: { app_id: process.env.ADZUNA_APP_ID, app_key: process.env.ADZUNA_APP_KEY, results_per_page: 3 }, timeout: 10000 }
        );
        info.adzuna_api_test = { ok: true, count: r.data.count, results: r.data.results?.length };
      } catch (e) {
        info.adzuna_api_test = { ok: false, error: e.message };
      }
    }
  } catch (e) { info.error = e.message; }
  res.json(info);
});

// ── POST /api/empregos/importar — trigger manual ──────────────
router.post('/importar', async (req, res) => {
  const log = [];
  try {
    await migrateTable(req.db);
    log.push('✓ migração de colunas OK');

    // Apagar vagas importadas anteriores
    const del = await req.db.request()
      .query(`DELETE FROM jobs WHERE source IN (${ALL_EXTERNAL_SOURCES}) RETURNING id`)
      .catch(() => ({ recordset: [] }));
    log.push(`✓ ${del.recordset?.length || 0} vagas antigas apagadas`);

    // ── Adzuna ──────────────────────────────────────────────────
    const appId  = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    const country= process.env.ADZUNA_COUNTRY || 'za';
    if (appId && appKey) {
      try {
        const { data } = await axios.get(
          `https://api.adzuna.com/v1/api/jobs/${country}/search/1`,
          { params: { app_id: appId, app_key: appKey, results_per_page: 50 }, timeout: 15000 }
        );
        const results = data.results || [];
        log.push(`✓ Adzuna: ${results.length} vagas recebidas`);
        let ok = 0, err = 0;
        for (const j of results) {
          try {
            await insertJob(req.db, {
              title: j.title, company: j.company?.display_name, city: j.location?.display_name,
              description: j.description, url: j.redirect_url,
              salary: j.salary_min ? `${Math.round(j.salary_min).toLocaleString('pt-AO')} Kz` : null,
              source: 'adzuna', category: j.category?.tag || '',
              job_date: j.created || null, deadline: null
            });
            ok++;
          } catch (e) { err++; }
        }
        log.push(`  → Inseridas: ${ok} | Erros: ${err}`);
      } catch (e) { log.push(`✗ Adzuna erro: ${e.message.substring(0, 100)}`); }
    } else {
      log.push('⚠ Adzuna: ADZUNA_APP_ID / ADZUNA_APP_KEY não configurados');
    }

    // ── Arbeitnow (sem chave) ───────────────────────────────────
    try {
      const { data } = await axios.get('https://arbeitnow.com/api/job-board-api', { timeout: 15000 });
      const jobs = data.data || [];
      log.push(`✓ Arbeitnow: ${jobs.length} vagas recebidas`);
      let ok = 0, err = 0;
      for (const j of jobs) {
        try {
          await insertJob(req.db, {
            title: j.title, company: j.company_name,
            city: j.remote ? 'Remoto' : (j.location || ''),
            description: (j.description || '').substring(0, 2000),
            url: j.url, salary: null,
            source: 'arbeitnow', category: (j.tags && j.tags[0]) || '',
            job_date: j.created_at || null, deadline: null
          });
          ok++;
        } catch (e) { err++; }
      }
      log.push(`  → Inseridas: ${ok} | Erros: ${err}`);
    } catch (e) { log.push(`✗ Arbeitnow erro: ${e.message.substring(0, 100)}`); }

    // ── Remotive (sem chave) ────────────────────────────────────
    try {
      const { data } = await axios.get('https://remotive.com/api/remote-jobs', { params: { limit: 50 }, timeout: 15000 });
      const jobs = data.jobs || [];
      log.push(`✓ Remotive: ${jobs.length} vagas recebidas`);
      let ok = 0, err = 0;
      for (const j of jobs) {
        try {
          await insertJob(req.db, {
            title: j.title, company: j.company_name,
            city: j.candidate_required_location || 'Remoto',
            description: (j.description || '').replace(/<[^>]+>/g, '').substring(0, 2000),
            url: j.url, salary: j.salary ? String(j.salary).substring(0, 100) : null,
            source: 'remotive', category: j.category || '',
            job_date: j.publication_date || null, deadline: null
          });
          ok++;
        } catch (e) { err++; }
      }
      log.push(`  → Inseridas: ${ok} | Erros: ${err}`);
    } catch (e) { log.push(`✗ Remotive erro: ${e.message.substring(0, 100)}`); }

    // ── Jobicy (sem chave) ──────────────────────────────────────
    try {
      const { data } = await axios.get('https://jobicy.com/api/v2/remote-jobs', { params: { count: 50 }, timeout: 15000 });
      const jobs = data.jobs || [];
      log.push(`✓ Jobicy: ${jobs.length} vagas recebidas`);
      let ok = 0, err = 0;
      for (const j of jobs) {
        try {
          const salary = j.annualSalaryMin
            ? `${j.annualSalaryMin}–${j.annualSalaryMax || j.annualSalaryMin} ${j.salaryCurrency || 'USD'}/ano`
            : null;
          await insertJob(req.db, {
            title: j.jobTitle, company: j.companyName,
            city: j.jobGeo || 'Remoto',
            description: (j.jobDescription || '').replace(/<[^>]+>/g, '').substring(0, 2000),
            url: j.url, salary,
            source: 'jobicy', category: j.jobIndustry || '',
            job_date: j.pubDate || null, deadline: null
          });
          ok++;
        } catch (e) { err++; }
      }
      log.push(`  → Inseridas: ${ok} | Erros: ${err}`);
    } catch (e) { log.push(`✗ Jobicy erro: ${e.message.substring(0, 100)}`); }

    // ── Himalayas (sem chave) ───────────────────────────────────
    try {
      const { data } = await axios.get('https://himalayas.app/jobs/api',
        { params: { limit: 50 }, timeout: 15000 });
      const jobs = data.jobs || [];
      log.push(`✓ Himalayas: ${jobs.length} vagas recebidas`);
      let ok = 0, err = 0;
      for (const j of jobs) {
        try {
          const loc = Array.isArray(j.locations) && j.locations.length ? j.locations[0] : 'Remoto';
          await insertJob(req.db, {
            title: j.title, company: j.company?.name || j.companyName || '',
            city: typeof loc === 'string' ? loc : (loc.name || 'Remoto'),
            description: (j.description || '').replace(/<[^>]+>/g, '').substring(0, 2000),
            url: j.applyUrl || j.url || '',
            salary: j.salary ? String(j.salary).substring(0, 100) : null,
            source: 'himalayas', category: (j.tags && j.tags[0]) || '',
            job_date: j.publishedAt || null, deadline: null
          });
          ok++;
        } catch (e) { err++; }
      }
      log.push(`  → Inseridas: ${ok} | Erros: ${err}`);
    } catch (e) { log.push(`✗ Himalayas erro: ${e.message.substring(0, 100)}`); }

    // ── The Muse (sem chave) ────────────────────────────────────
    try {
      const { data } = await axios.get('https://www.themuse.com/api/public/jobs',
        { params: { page: 0, descending: true }, timeout: 15000 });
      const jobs = data.results || [];
      log.push(`✓ The Muse: ${jobs.length} vagas recebidas`);
      let ok = 0, err = 0;
      for (const j of jobs) {
        try {
          const loc = j.locations && j.locations[0] ? j.locations[0].name : 'Internacional';
          const cat = j.categories && j.categories[0] ? j.categories[0].name : '';
          await insertJob(req.db, {
            title: j.name, company: j.company?.name || '',
            city: loc,
            description: (j.contents || '').replace(/<[^>]+>/g, '').substring(0, 2000),
            url: j.refs?.landing_page || '',
            salary: null, source: 'themuse', category: cat,
            job_date: j.publication_date || null, deadline: null
          });
          ok++;
        } catch (e) { err++; }
      }
      log.push(`  → Inseridas: ${ok} | Erros: ${err}`);
    } catch (e) { log.push(`✗ The Muse erro: ${e.message.substring(0, 100)}`); }

    // Remover vagas internacionais com mais de 20 dias
    const oldDel = await req.db.request()
      .query(`DELETE FROM jobs
              WHERE source IN (${ALL_EXTERNAL_SOURCES})
                AND job_date < NOW() - INTERVAL '20 days'
              RETURNING id`)
      .catch(() => ({ recordset: [] }));
    const oldN = oldDel.recordset?.length || 0;
    if (oldN) log.push(`✓ ${oldN} vagas internacionais com >20 dias removidas`);

    // Contagem final de vagas importadas de APIs externas
    const cnt = await req.db.request().query(
      `SELECT source, COUNT(*) AS n FROM jobs
       WHERE source IN (${ALL_EXTERNAL_SOURCES}) GROUP BY source`
    ).catch(() => ({ recordset: [] }));
    const totals = cnt.recordset.map(r => `${r.source}:${r.n}`).join(', ');
    const totalImported = cnt.recordset.reduce((s, r) => s + parseInt(r.n || 0), 0);
    log.push(`→ Vagas de APIs externas: ${totals || 'nenhuma'}`);

    // Se nenhuma API externa funcionou, inserir vagas demo angolanas
    if (totalImported === 0) {
      log.push('⚠ APIs externas sem resultado — a inserir vagas demo angolanas…');
      await seedDemoJobs(req.db);
      const demoCount = await req.db.request()
        .query(`SELECT COUNT(*) AS n FROM jobs WHERE source='demo'`)
        .catch(() => ({ recordset: [{ n: 0 }] }));
      log.push(`✓ Vagas demo: ${parseInt(demoCount.recordset[0].n || 0)} vagas disponíveis`);
    }

    // Contagem total final
    const total = await req.db.request()
      .query(`SELECT COUNT(*) AS n FROM jobs WHERE active=TRUE`)
      .catch(() => ({ recordset: [{ n: 0 }] }));
    log.push(`✓ Total de vagas activas na plataforma: ${parseInt(total.recordset[0].n || 0)}`);

  } catch (e) { log.push(`✗ Erro geral: ${e.message}`); }
  res.json({ log });
});

module.exports = { router, importJobs, migrateTable };
