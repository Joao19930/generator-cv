// src/routes/content.js
// Rotas públicas: coaches, courses, jobs, testimonials
const express = require('express');
const router  = express.Router();
const { sql } = require('../config/database');

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
      .query('SELECT id, title, company, city, country, category, job_date, url, contact_type, created_at FROM jobs WHERE active=TRUE ORDER BY job_date DESC, created_at DESC');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/content/testimonials ────────────────────────────
router.get('/testimonials', async (req, res) => {
  try {
    const r = await req.db.request()
      .query('SELECT id, name, role, text, stars, created_at FROM testimonials WHERE active=TRUE ORDER BY created_at DESC');
    res.json(r.recordset);
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
