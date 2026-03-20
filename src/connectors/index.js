// src/connectors/index.js
// ─────────────────────────────────────────────────────────────
// 20 CONECTORES — CV Premium
// Cada conector é um objecto com métodos prontos a usar
// ─────────────────────────────────────────────────────────────
require('dotenv').config();
const axios = require('axios');

// ═══════════════════════════════════════════════════════
// 1. SENDGRID — E-mails transacionais
// ═══════════════════════════════════════════════════════
let _sg;
const getSG = () => {
  if (!_sg) { _sg = require('@sendgrid/mail'); _sg.setApiKey(process.env.SENDGRID_API_KEY); }
  return _sg;
};

const emailConnector = {
  sendWelcome: (toEmail, name) =>
    getSG().send({ to: toEmail, from: process.env.EMAIL_FROM,
      templateId: process.env.SENDGRID_WELCOME_TEMPLATE,
      dynamicTemplateData: { name, link: process.env.APP_URL } }),

  sendCVReady: (toEmail, name, downloadLink) =>
    getSG().send({ to: toEmail, from: process.env.EMAIL_FROM,
      templateId: process.env.SENDGRID_CV_TEMPLATE,
      dynamicTemplateData: { name, downloadLink } }),

  sendPasswordReset: (toEmail, token) =>
    getSG().send({ to: toEmail, from: process.env.EMAIL_FROM,
      subject: 'Redefinição de senha — CV Premium',
      html: `<p>Clique <a href="${process.env.APP_URL}/reset?token=${token}">aqui</a> para redefinir a sua senha. Válido 1 hora.</p>` })
};

// ═══════════════════════════════════════════════════════
// 2. SMTP NODEMAILER — Fallback / Dev (Gmail funciona já)
// ═══════════════════════════════════════════════════════
let _transport;
const getTransport = () => {
  if (!_transport) {
    const nodemailer = require('nodemailer');
    _transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: process.env.SMTP_PORT || 587,
      secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return _transport;
};

const smtpConnector = {
  send: (to, subject, html) =>
    getTransport().sendMail({ from: process.env.EMAIL_FROM, to, subject, html })
};

// ═══════════════════════════════════════════════════════
// 3. STRIPE — Pagamentos
// ═══════════════════════════════════════════════════════
let _stripe;
const getStripe = () => {
  if (!_stripe) _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return _stripe;
};

const stripeConnector = {
  createCheckoutSession: (userId, email, plan = 'monthly') => {
    const prices = { monthly: process.env.STRIPE_PRICE_MONTHLY, yearly: process.env.STRIPE_PRICE_YEARLY };
    return getStripe().checkout.sessions.create({
      payment_method_types: ['card'], customer_email: email,
      line_items: [{ price: prices[plan], quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/pricing`,
      metadata: { userId: userId.toString() }
    });
  },
  createOneTime: (email, amountUSD) =>
    getStripe().checkout.sessions.create({
      payment_method_types: ['card'], customer_email: email,
      line_items: [{ price_data: { currency: 'usd', product_data: { name: 'CV Premium Download' }, unit_amount: Math.round(amountUSD * 100) }, quantity: 1 }],
      mode: 'payment',
      success_url: `${process.env.APP_URL}/download`,
      cancel_url: `${process.env.APP_URL}/pricing`
    }),
  constructEvent: (rawBody, sig) =>
    getStripe().webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
};

// ═══════════════════════════════════════════════════════
// 4. CLOUDINARY — Fotos de perfil
// ═══════════════════════════════════════════════════════
let _cloudinary;
const getCloud = () => {
  if (!_cloudinary) {
    _cloudinary = require('cloudinary').v2;
    _cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
  }
  return _cloudinary;
};

const cloudinaryConnector = {
  uploadPhoto: (filePath, userId) =>
    getCloud().uploader.upload(filePath, { folder: `cv-generator/${userId}`, transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face' }] }),
  deletePhoto: (publicId) => getCloud().uploader.destroy(publicId),
  optimizedUrl: (publicId) => getCloud().url(publicId, { fetch_format: 'auto', quality: 'auto' })
};

// ═══════════════════════════════════════════════════════
// 5. AWS S3 — Armazenar PDFs gerados
// ═══════════════════════════════════════════════════════
const s3Connector = {
  upload: async (buffer, filename, userId) => {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: process.env.AWS_REGION, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY, secretAccessKey: process.env.AWS_SECRET_KEY } });
    const key = `cvs/${userId}/${Date.now()}-${filename}`;
    await s3.send(new PutObjectCommand({ Bucket: process.env.AWS_BUCKET, Key: key, Body: buffer, ContentType: 'application/pdf' }));
    return key;
  },
  getUrl: async (key, expiresIn = 3600) => {
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    const s3 = new S3Client({ region: process.env.AWS_REGION, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY, secretAccessKey: process.env.AWS_SECRET_KEY } });
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.AWS_BUCKET, Key: key }), { expiresIn });
  }
};

// ═══════════════════════════════════════════════════════
// 6. CLAUDE (Anthropic) — IA: melhorar texto, score ATS, resumo, carta
// ═══════════════════════════════════════════════════════
let _claude;
const getAI = () => {
  if (!_claude) { const Anthropic = require('@anthropic-ai/sdk'); _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); }
  return _claude;
};
const claudeAsk = async (prompt, maxTokens = 1024) => {
  const r = await getAI().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  });
  return r.content[0].text;
};

const openaiConnector = {
  improveText: async (text, jobTitle) => {
    return claudeAsk(`Melhore este texto de experiência para o cargo "${jobTitle}" com foco em ATS. Retorne só o texto melhorado em português angolano, máx 3 linhas: "${text}"`);
  },
  generateCoverLetter: async ({ name, role, company, years, skills, type }) => {
    const typeLabels = {
      emprego:'candidatura a uma vaga específica', espontanea:'candidatura espontânea',
      estagio:'candidatura a estágio profissional', promocao:'promoção interna',
      mudanca:'mudança de área de carreira', linkedin:'mensagem no LinkedIn'
    };
    const prompt = `Escreve uma carta de apresentação profissional do tipo "${typeLabels[type]||'candidatura'}" em português de Angola (formal mas directo).\n\nCandidato: ${name}\nCargo: ${role}${company?'\nEmpresa: '+company:''}${years?'\nExperiência: '+years:''}${skills?'\nCompetências/conquistas: '+skills:''}\n\nEstrutura: saudação, parágrafo de motivação, parágrafo de valor concreto, fecho com disponibilidade, despedida com o nome.\nMáximo 320 palavras. Devolve apenas o texto da carta.`;
    return claudeAsk(prompt, 800);
  },
  generateSummary: async (name, jobTitle, experiences) => {
    return claudeAsk(`Crie um resumo profissional de 4 linhas focado em ATS para ${name}, cargo ${jobTitle}, em português angolano. Experiências: ${experiences}. Retorne apenas o texto do resumo.`);
  },
  atsScore: async (cvText, jobDescription) => {
    const raw = await claudeAsk(`Analise a compatibilidade ATS. CV: "${cvText}". VAGA: "${jobDescription}". Retorne APENAS JSON válido sem markdown: {"score":0-100,"keywords_missing":[],"suggestions":[]}`, 512);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  },
  generateResponsibilities: async (jobTitle) => {
    return claudeAsk(`Lista 6 responsabilidades profissionais típicas para o cargo "${jobTitle}" em português angolano. Formato: cada linha começa com "• " e é concisa (máx 12 palavras). Retorna apenas as 6 linhas, sem introdução.`, 400);
  }
};

// ═══════════════════════════════════════════════════════
// 7. PUPPETEER — Gerar PDF a partir do HTML do CV
// ═══════════════════════════════════════════════════════
const pdfConnector = {
  fromHTML: async (htmlContent) => {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' } });
    await browser.close();
    return pdf; // Buffer pronto para upload ao S3
  }
};

// ═══════════════════════════════════════════════════════
// 8. REDIS — Cache, rate limit, blacklist JWT
// ═══════════════════════════════════════════════════════
let _redis;
const getRedis = () => {
  if (!_redis) {
    const Redis = require('ioredis');
    _redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times) => times > 3 ? null : Math.min(times * 200, 2000)
    });
    _redis.on('error', () => {}); // suprimir erros não tratados — Redis é opcional
  }
  return _redis;
};

const redisConnector = {
  set:   (key, data, ttl = 3600) => getRedis().set(key, JSON.stringify(data), 'EX', ttl).catch(() => null),
  get:   async (key) => { try { const d = await getRedis().get(key); return d ? JSON.parse(d) : null; } catch { return null; } },
  del:   (key) => getRedis().del(key).catch(() => null),
  rateCheck: async (ip, limit = 200, window = 3600) => {
    try {
      const k = `rate:${ip}`; const n = await getRedis().incr(k);
      if (n === 1) await getRedis().expire(k, window);
      return n <= limit;
    } catch { return true; } // Redis indisponível → deixar passar
  },
  blacklistToken: (token, ttl) => getRedis().set(`bl:${token}`, '1', 'EX', ttl).catch(() => null),
  isBlacklisted:  async (token) => { try { return !!(await getRedis().get(`bl:${token}`)); } catch { return false; } }
};

// ═══════════════════════════════════════════════════════
// 9. SOCKET.IO — Notificações em tempo real
// ═══════════════════════════════════════════════════════
const socketConnector = {
  init: (httpServer) => {
    const { Server } = require('socket.io');
    const io = new Server(httpServer, { cors: { origin: process.env.APP_URL, methods: ['GET','POST'] } });
    io.on('connection', (socket) => {
      socket.on('join', (userId) => socket.join(`u:${userId}`));
      socket.on('joinAdmin', () => socket.join('admins'));
    });
    global._io = io;
    return io;
  },
  toUser:  (userId, event, data) => { if (global._io) global._io.to(`u:${userId}`).emit(event, data); },
  toAdmin: (event, data)         => { if (global._io) global._io.to('admins').emit(event, data); }
};

// ═══════════════════════════════════════════════════════
// 10. GOOGLE OAUTH — Login com Google
// ═══════════════════════════════════════════════════════
const googleConnector = {
  verify: async (idToken) => {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    return ticket.getPayload(); // { sub, email, name, picture }
  }
};

// ═══════════════════════════════════════════════════════
// 11. LINKEDIN OAUTH — Login + importar perfil
// ═══════════════════════════════════════════════════════
const linkedinConnector = {
  getToken: async (code) => {
    const r = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: { grant_type: 'authorization_code', code, redirect_uri: process.env.LINKEDIN_REDIRECT_URI, client_id: process.env.LINKEDIN_CLIENT_ID, client_secret: process.env.LINKEDIN_CLIENT_SECRET }
    });
    return r.data.access_token;
  },
  getProfile: async (token) => {
    const h = { Authorization: `Bearer ${token}` };
    const [p, e] = await Promise.all([
      axios.get('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName)', { headers: h }),
      axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', { headers: h })
    ]);
    return { linkedinId: p.data.id, firstName: p.data.localizedFirstName, lastName: p.data.localizedLastName, email: e.data.elements[0]['handle~'].emailAddress };
  }
};

// ═══════════════════════════════════════════════════════
// 12. TWILIO — SMS OTP e notificações
// ═══════════════════════════════════════════════════════
const twilioConnector = {
  sendOTP: (phone, otp) => {
    const t = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    return t.messages.create({ body: `CV Premium — código: ${otp}. Válido 10 min.`, from: process.env.TWILIO_PHONE, to: phone });
  }
};

// ═══════════════════════════════════════════════════════
// 13. PAYPAL — Pagamento alternativo
// ═══════════════════════════════════════════════════════
const paypalConnector = {
  createOrder: async (amountUSD) => {
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const { data: { access_token } } = await axios.post(`${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`, 'grant_type=client_credentials', { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
    const { data } = await axios.post(`${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
      { intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: 'USD', value: amountUSD.toString() } }] },
      { headers: { Authorization: `Bearer ${access_token}` } });
    return data;
  }
};

// ═══════════════════════════════════════════════════════
// 14. GOOGLE ANALYTICS 4 — Tracking server-side
// ═══════════════════════════════════════════════════════
const gaConnector = {
  track: (clientId, eventName, params = {}) =>
    axios.post(`https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`, { client_id: clientId, events: [{ name: eventName, params }] }).catch(() => {}),
  cvCreated:  (cId) => gaConnector.track(cId, 'cv_created'),
  purchase:   (cId, value) => gaConnector.track(cId, 'purchase', { value, currency: 'USD' })
};

// ═══════════════════════════════════════════════════════
// 15. MIXPANEL — Analytics de produto
// ═══════════════════════════════════════════════════════
let _mp;
const getMp = () => { if (!_mp) { _mp = require('mixpanel').init(process.env.MIXPANEL_TOKEN); } return _mp; };

const mixpanelConnector = {
  track:    (event, userId, props = {}) => getMp().track(event, { distinct_id: userId, ...props }),
  identify: (userId, email, plan)       => getMp().people.set(userId, { $email: email, plan, $last_login: new Date() })
};

// ═══════════════════════════════════════════════════════
// 16. HUBSPOT CRM — Captura de leads
// ═══════════════════════════════════════════════════════
const hubspotConnector = {
  createContact: (email, name, plan = 'free') =>
    axios.post('https://api.hubapi.com/crm/v3/objects/contacts',
      { properties: { email, firstname: name.split(' ')[0], lastname: name.split(' ').slice(1).join(' '), plan_type: plan } },
      { headers: { Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}` } }).catch(() => {})
};

// ═══════════════════════════════════════════════════════
// 17. RECAPTCHA v3 — Anti-bot
// ═══════════════════════════════════════════════════════
const recaptchaConnector = {
  verify: async (token, min = 0.5) => {
    const r = await axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${token}`);
    return r.data.success && r.data.score >= min;
  }
};

// ═══════════════════════════════════════════════════════
// 18. INTERCOM — Suporte in-app
// ═══════════════════════════════════════════════════════
const crypto = require('crypto');
const intercomConnector = {
  hash: (userId) => crypto.createHmac('sha256', process.env.INTERCOM_SECRET_KEY).update(String(userId)).digest('hex'),
  createUser: (email, name, userId) =>
    axios.post('https://api.intercom.io/contacts',
      { role: 'user', email, name, external_id: String(userId) },
      { headers: { Authorization: `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}` } }).catch(() => {})
};

// ═══════════════════════════════════════════════════════
// 19. ZAPIER WEBHOOKS — Automações
// ═══════════════════════════════════════════════════════
const zapierConnector = {
  fire: (url, data) => url ? axios.post(url, data).catch(() => {}) : Promise.resolve(),
  onNewUser:  (user)          => zapierConnector.fire(process.env.ZAPIER_NEW_USER_WEBHOOK,  { event: 'new_user',  ...user, ts: new Date().toISOString() }),
  onPurchase: (user, amt, pl) => zapierConnector.fire(process.env.ZAPIER_PURCHASE_WEBHOOK,  { event: 'purchase', email: user.email, amount: amt, plan: pl, ts: new Date().toISOString() }),
  onLead:     (email, score)  => zapierConnector.fire(process.env.ZAPIER_LEAD_WEBHOOK,      { event: 'new_lead', email, ats_score: score, ts: new Date().toISOString() })
};

// ═══════════════════════════════════════════════════════
// 20. INDEED / JOB BOARDS — Vagas in-app
// ═══════════════════════════════════════════════════════
const jobConnector = {
  search: (q, location, co = 'ao') =>
    axios.get('https://api.indeed.com/ads/apisearch', { params: { publisher: process.env.INDEED_PUBLISHER_ID, q, l: location, co, format: 'json', v: '2', limit: 10 } })
      .then(r => r.data.results).catch(() => [])
};

// ─────────────────────────────────────────────────────
module.exports = {
  emailConnector,       // 1  SendGrid
  smtpConnector,        // 2  SMTP / Nodemailer
  stripeConnector,      // 3  Stripe
  cloudinaryConnector,  // 4  Cloudinary
  s3Connector,          // 5  AWS S3
  openaiConnector,      // 6  OpenAI
  pdfConnector,         // 7  Puppeteer PDF
  redisConnector,       // 8  Redis
  socketConnector,      // 9  Socket.IO
  googleConnector,      // 10 Google OAuth
  linkedinConnector,    // 11 LinkedIn OAuth
  twilioConnector,      // 12 Twilio SMS
  paypalConnector,      // 13 PayPal
  gaConnector,          // 14 Google Analytics 4
  mixpanelConnector,    // 15 Mixpanel
  hubspotConnector,     // 16 HubSpot CRM
  recaptchaConnector,   // 17 reCAPTCHA v3
  intercomConnector,    // 18 Intercom
  zapierConnector,      // 19 Zapier Webhooks
  jobConnector          // 20 Indeed / Job Boards
};
