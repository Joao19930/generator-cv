// src/routes/content.js
// Rotas públicas: coaches, courses, jobs, testimonials
const express = require('express');
const router  = express.Router();
const { sql } = require('../config/database');
const { auth } = require('../middleware/auth');

const HYPOTHETICAL_TESTIS = [
  { id: 'h1', name: 'Ana Luísa Ferreira',   role: 'Gestora de Marketing · Luanda',   text: 'Consegui o meu primeiro emprego numa multinacional graças ao CV que criei aqui. O score ATS foi decisivo — o recrutador disse que o meu CV se destacou logo.',        stars: 5, hypothetical: true },
  { id: 'h2', name: 'João Baptista Neto',   role: 'Engenheiro Civil · Benguela',      text: 'Nunca pensei que criar um CV profissional fosse tão fácil. Em menos de 20 minutos tinha um currículo que parecia feito por um designer.',                          stars: 5, hypothetical: true },
  { id: 'h3', name: 'Carla Domingos',       role: 'Enfermeira Sénior · Luanda',       text: 'A funcionalidade de IA para melhorar o texto da experiência é incrível. Transformou o meu CV completamente e já tenho 3 entrevistas agendadas.',                   stars: 5, hypothetical: true },
  { id: 'h4', name: 'Miguel Santos Tavares',role: 'Programador Full-Stack · Huambo',  text: 'Usei várias plataformas de CV mas esta é claramente a melhor para Angola. Os templates são modernos e o PDF fica perfeito.',                                       stars: 5, hypothetical: true },
  { id: 'h5', name: 'Isabel Cardoso',       role: 'Contabilista · Cabinda',           text: 'O serviço de distribuição de CV para empresas parceiras foi o que me diferenciou. Recebi contacto de uma empresa que eu nem sabia que estava a contratar.',        stars: 5, hypothetical: true },
  { id: 'h6', name: 'Pedro Lopes Mbinda',   role: 'Professor Universitário · Malanje',text: 'Excelente plataforma! A carta de apresentação gerada pela IA ficou melhor do que qualquer coisa que eu teria escrito sozinho.',                                    stars: 4, hypothetical: true },
  { id: 'h7', name: 'Fernanda Queirós',     role: 'Advogada · Luanda',               text: 'Profissional e intuitivo. Em 30 minutos tinha um CV completo com design impecável. Já recomendei a todos os meus colegas.',                                         stars: 5, hypothetical: true },
  { id: 'h8', name: 'António Sebastião',    role: 'Gestor Comercial · Lobito',        text: 'O CV Premium da Caos Criativo superou todas as minhas expectativas. Consegui entrevistas em 4 empresas na primeira semana após actualizar o meu currículo.',        stars: 5, hypothetical: true },
];

// ── GET /api/content/coaches ──────────────────────────────────
router.get('/coaches', async (req, res) => {
  try {
    const r = await req.db.request()
      .query('SELECT id, name, location, bio, skills, email, color, photo_url, created_at FROM coaches WHERE active=TRUE ORDER BY created_at DESC');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/content/courses ──────────────────────────────────
router.get('/courses', async (req, res) => {
  try {
    const r = await req.db.request()
      .query('SELECT id, title, source, category, rating, url, created_at FROM courses WHERE active=TRUE ORDER BY created_at DESC');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/content/jobs ─────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const r = await req.db.request()
      .query('SELECT id, title, company, city, country, category, description, job_date, start_date, end_date, url, contact_type, created_at FROM jobs WHERE active=TRUE ORDER BY job_date DESC, created_at DESC');
    res.json(r.recordset || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/content/testimonials ────────────────────────────
router.get('/testimonials', async (req, res) => {
  try {
    const r = await req.db.request()
      .query('SELECT id, name, role, text, stars, created_at FROM testimonials WHERE active=TRUE ORDER BY created_at DESC');
    const real = r.recordset || [];
    // Mostrar testemunhos reais primeiro, depois hipotéticos como complemento
    const combined = [...real, ...HYPOTHETICAL_TESTIS];
    res.json(combined);
  } catch (e) {
    // Se a tabela não existir ainda, retorna só os hipotéticos
    res.json(HYPOTHETICAL_TESTIS);
  }
});

// ── POST /api/content/testimonials — Submeter testemunho ─────
router.post('/testimonials', auth, async (req, res) => {
  const { name, role, text, stars } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'Nome e texto são obrigatórios' });
  const starsVal = Math.min(5, Math.max(1, parseInt(stars) || 5));
  try {
    await req.db.request()
      .input('name',  sql.NVarChar, name)
      .input('role',  sql.NVarChar, role || '')
      .input('text',  sql.NVarChar, text)
      .input('stars', sql.Int,      starsVal)
      .query(`INSERT INTO testimonials (name, role, text, stars, active, created_at)
              VALUES (@name, @role, @text, @stars, TRUE, NOW())`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/content/plans ────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json([
    { id: 1, name: 'Gratuito', price: 0, currency: 'Kz', period: 'mês', color: '#6b7280',
      features: ['2 CVs', '1 template gratuito', 'Score ATS básico', 'Download em PDF (com marca)'] },
    { id: 2, name: 'Pro', price: 2000, currency: 'Kz', period: 'mês', color: '#2563EB',
      popular: true,
      features: ['CVs ilimitados', '200+ templates premium', 'PDF sem marca de água', 'IA para melhorar texto', 'Importar do LinkedIn', 'Suporte por email'] },
    { id: 3, name: 'Premium', price: 3500, currency: 'Kz', period: 'mês', color: '#7C3AED',
      features: ['Tudo do Pro', 'Dashboard de candidaturas', 'Visível a recrutadores', 'Coaching incluído', 'Distribuição automática', 'Suporte prioritário 24/7'] }
  ]);
});

module.exports = router;
