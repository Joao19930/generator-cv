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

const daysAgo = d => { const dt = new Date(); dt.setDate(dt.getDate()-d); return dt.toISOString().split('T')[0]; };

const HYPOTHETICAL_JOBS = [
  // ── Serviços Domésticos ──────────────────────────────────────
  { id:'hj1', title:'Empregada Doméstica', company:'Família Particular', city:'Luanda', country:'Angola', category:'Serviços Domésticos', description:'Procura-se empregada doméstica para limpeza, cozinha e cuidado de crianças. Regime de internamento. Experiência mínima 2 anos. Referências obrigatórias.', contact_type:'WhatsApp', url:'https://wa.me/244900000001', job_date: daysAgo(1), created_at: daysAgo(1) },
  { id:'hj2', title:'Cozinheiro(a) Residencial', company:'Família Expat', city:'Luanda', country:'Angola', category:'Serviços Domésticos', description:'Família expatriada procura cozinheiro(a) para preparar refeições diárias (almoço e jantar). Conhecimento de culinária angolana e internacional. Contrato permanente com benefícios.', contact_type:'Email', url:'mailto:recruta@exemplo.com', job_date: daysAgo(2), created_at: daysAgo(2) },
  { id:'hj3', title:'Babysitter / Ama', company:'Família Santos', city:'Talatona', country:'Angola', category:'Serviços Domésticos', description:'Procura-se ama para cuidar de 2 crianças (3 e 6 anos) das 07h às 17h. Segunda a sexta-feira. Experiência comprovada com crianças. Pessoa paciente, carinhosa e responsável.', contact_type:'Telefone', url:'tel:+244900000003', job_date: daysAgo(3), created_at: daysAgo(3) },
  { id:'hj4', title:'Jardineiro / Tratador de Piscina', company:'Condomínio Vila Verde', city:'Luanda', country:'Angola', category:'Serviços Domésticos', description:'Condomínio residencial procura jardineiro com experiência em manutenção de jardins tropicais e tratamento de piscinas. Horário: 07h-14h. Documentação em ordem obrigatória.', contact_type:'WhatsApp', url:'https://wa.me/244900000004', job_date: daysAgo(4), created_at: daysAgo(4) },
  { id:'hj5', title:'Motorista Particular', company:'Família Rodrigues', city:'Luanda', country:'Angola', category:'Serviços Domésticos', description:'Procura-se motorista com carta de condução categoria B válida, mínimo 5 anos de experiência e conhecimento de Luanda. Disponibilidade total. Salário competitivo + alimentação.', contact_type:'WhatsApp', url:'https://wa.me/244900000005', job_date: daysAgo(5), created_at: daysAgo(5) },
  // ── Administrativos ──────────────────────────────────────────
  { id:'hj6', title:'Secretária Executiva', company:'Grupo Zahara', city:'Luanda', country:'Angola', category:'Administrativos', description:'Multinacional angolana recruta secretária executiva para apoio à direcção geral. Requisitos: formação em secretariado ou gestão, domínio de Office, inglês fluente, experiência mínima 3 anos. CV Premium valorizado.', contact_type:'Email', url:'mailto:rh@zahara.ao', job_date: daysAgo(1), created_at: daysAgo(1) },
  { id:'hj7', title:'Assistente Administrativo', company:'Mota-Engil Angola', city:'Luanda', country:'Angola', category:'Administrativos', description:'Empresa de construção recruta assistente administrativo. Funções: arquivo, correspondência, apoio logístico e gestão de agenda. Formação em gestão administrativa e experiência mínima 2 anos.', contact_type:'Email', url:'mailto:rh@mota-engil.ao', job_date: daysAgo(2), created_at: daysAgo(2) },
  { id:'hj8', title:'Recepcionista Bilingue', company:'Hotel Epic Sana', city:'Luanda', country:'Angola', category:'Administrativos', description:'Hotel 5 estrelas recruta recepcionista com inglês fluente. Responsabilidades: atendimento ao cliente, check-in/check-out, gestão de reservas. Disponibilidade para turnos rotativos.', contact_type:'Email', url:'mailto:rh@epicsana.com', job_date: daysAgo(3), created_at: daysAgo(3) },
  { id:'hj9', title:'Assistente de Recursos Humanos', company:'Refriango', city:'Luanda', country:'Angola', category:'Administrativos', description:'Empresa FMCG recruta assistente de RH para apoio ao departamento. Funções: processamento de salários, gestão de férias, recrutamento. Licenciatura em Gestão ou RH. Excel avançado obrigatório.', contact_type:'Email', url:'mailto:rh@refriango.ao', job_date: daysAgo(4), created_at: daysAgo(4) },
  { id:'hj10',title:'Operador de Back-Office', company:'BAI Banco', city:'Luanda', country:'Angola', category:'Administrativos', description:'Banco recruta operadores de back-office para processamento de operações bancárias. Requisitos: licenciatura em Economia ou Finanças, atenção ao detalhe, capacidade de trabalho sob pressão.', contact_type:'Online', url:'https://bai.ao/carreiras', job_date: daysAgo(5), created_at: daysAgo(5) },
  // ── Função Pública ───────────────────────────────────────────
  { id:'hj11',title:'Técnico Superior (Concurso Público)', company:'Ministério das Finanças', city:'Luanda', country:'Angola', category:'Função Pública', description:'O Ministério das Finanças abre concurso para técnicos superiores. Requisitos: licenciatura em Economia, Finanças ou Contabilidade. Vínculo permanente ao Estado. Candidatura via portal do MAPESS.', contact_type:'Online', url:'https://mapess.gov.ao', job_date: daysAgo(2), created_at: daysAgo(2) },
  { id:'hj12',title:'Inspector do Trabalho', company:'Ministério do Trabalho (MAPESS)', city:'Luanda', country:'Angola', category:'Função Pública', description:'Recrutamento de inspectores do trabalho para fiscalização das condições laborais. Licenciatura em Direito ou Gestão de RH. Viaturas e subsídio de campo incluídos. Candidatura presencial ou online.', contact_type:'Online', url:'https://mapess.gov.ao', job_date: daysAgo(3), created_at: daysAgo(3) },
  { id:'hj13',title:'Professor do Ensino Secundário', company:'Ministério da Educação', city:'Diversas Províncias', country:'Angola', category:'Função Pública', description:'O MED abre vagas para professores do ensino secundário em todas as províncias. Licenciatura em área de ensino obrigatória. Subsídio de fixação para províncias do interior. Inscrições abertas durante 30 dias.', contact_type:'Online', url:'https://med.gov.ao', job_date: daysAgo(4), created_at: daysAgo(4) },
  { id:'hj14',title:'Técnico de Saúde Pública', company:'Ministério da Saúde (MINSA)', city:'Luanda', country:'Angola', category:'Função Pública', description:'O MINSA recruta técnicos de saúde pública para programas de vacinação e vigilância epidemiológica. Formação em saúde pública ou enfermagem. Contrato por 2 anos renovável.', contact_type:'Online', url:'https://minsa.gov.ao', job_date: daysAgo(5), created_at: daysAgo(5) },
  { id:'hj15',title:'Agente da Polícia Nacional (Recrutamento)', company:'Polícia Nacional de Angola', city:'Luanda', country:'Angola', category:'Função Pública', description:'Polícia Nacional abre concurso para ingresso na carreira policial. Requisitos: 18-30 anos, ensino médio completo, aptidão física e psicológica. Formação na Escola Nacional de Polícia incluída.', contact_type:'Presencial', url:'https://pna.gov.ao', job_date: daysAgo(6), created_at: daysAgo(6) },
];

// ── GET /api/content/jobs ─────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const r = await req.db.request()
      .query('SELECT id, title, company, city, country, category, description, job_date, start_date, end_date, url, contact_type, created_at FROM jobs WHERE active=TRUE ORDER BY job_date DESC, created_at DESC');
    const real = r.recordset || [];
    res.json([...real, ...HYPOTHETICAL_JOBS]);
  } catch (e) {
    res.json(HYPOTHETICAL_JOBS);
  }
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
