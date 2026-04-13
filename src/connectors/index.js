// src/connectors/index.js
// ─────────────────────────────────────────────────────────────
// 20 CONECTORES — CV Premium
// Cada conector é um objecto com métodos prontos a usar
// ─────────────────────────────────────────────────────────────
require('dotenv').config();
const axios = require('axios');

// ═══════════════════════════════════════════════════════
// 1. SENDGRID — E-mails transacionais (HTML inline)
// ═══════════════════════════════════════════════════════
let _sg;
const getSG = () => {
  if (!_sg) { _sg = require('@sendgrid/mail'); _sg.setApiKey(process.env.SENDGRID_API_KEY); }
  return _sg;
};

const _emailBase = (content) => `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif}
  .wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px 40px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px;letter-spacing:.5px}
  .header p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px}
  .body{padding:32px 40px}
  .body p{color:#374151;line-height:1.7;margin:0 0 16px;font-size:15px}
  .btn{display:inline-block;margin:8px 0 24px;padding:14px 32px;background:#2563eb;color:#fff!important;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px}
  .footer{background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb}
  .footer p{color:#9ca3af;font-size:12px;margin:0}
  .highlight{background:#eff6ff;border-left:4px solid #2563eb;padding:12px 16px;border-radius:4px;margin:16px 0}
  .highlight strong{color:#1d4ed8}
</style></head>
<body><div class="wrap">
  <div class="header">
    <h1>CV Premium</h1>
    <p>cvpremium.net</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} CV Premium — Luanda, Angola</p>
    <p style="margin-top:4px">Este e-mail foi enviado automaticamente. Não responda a esta mensagem.</p>
  </div>
</div></body></html>`;

const _send = (to, subject, content) =>
  getSG().send({ to, from: { email: process.env.EMAIL_FROM || 'noreply@cvpremium.net', name: 'CV Premium' }, subject, html: _emailBase(content) });

const emailConnector = {
  sendWelcome: (toEmail, name) =>
    _send(toEmail, `Bem-vindo ao CV Premium, ${name.split(' ')[0]}!`, `
      <p>Olá <strong>${name.split(' ')[0]}</strong>,</p>
      <p>A sua conta foi criada com sucesso. Agora podes criar o teu CV profissional em minutos, com templates modernos e suporte de Inteligência Artificial.</p>
      <div class="highlight">
        <strong>O que podes fazer gratuitamente:</strong><br>
        ✅ Criar e editar CVs ilimitados<br>
        ✅ Usar IA para melhorar o teu perfil<br>
        ✅ Calcular o teu score ATS<br>
        ✅ Gerar carta de apresentação
      </div>
      <p>Para descarregar o teu CV em PDF, activa um plano a partir de <strong>4.000 Kz</strong>.</p>
      <a href="${process.env.APP_URL}/app" class="btn">Criar o Meu CV Agora</a>
      <p style="font-size:13px;color:#6b7280">Qualquer dúvida, fala connosco pelo WhatsApp ou pelo site.</p>
    `),

  sendPlanActivated: (toEmail, name, planType) => {
    const labels = { week: 'Semanal (7 dias)', month: 'Mensal (30 dias)', semanal: 'Semanal (7 dias)', mensal: 'Mensal (30 dias)' };
    const label  = labels[planType] || planType;
    return _send(toEmail, `Plano ${label} activado — CV Premium`, `
      <p>Olá <strong>${name.split(' ')[0]}</strong>,</p>
      <p>O teu pagamento foi verificado e o teu plano foi activado com sucesso! 🎉</p>
      <div class="highlight">
        <strong>Plano activo:</strong> ${label}<br>
        <strong>Acesso a:</strong> Download de PDF em todos os templates, incluindo templates premium
      </div>
      <p>Já podes descarregar o teu CV em PDF directamente na tua conta.</p>
      <a href="${process.env.APP_URL}/app" class="btn">Descarregar o Meu CV</a>
      <p style="font-size:13px;color:#6b7280">Se tiveres algum problema, entra em contacto pelo WhatsApp.</p>
    `);
  },

  sendCVReady: (toEmail, name, downloadLink) =>
    _send(toEmail, 'O teu CV está pronto para descarregar!', `
      <p>Olá <strong>${name.split(' ')[0]}</strong>,</p>
      <p>O teu CV foi gerado com sucesso e está pronto para descarregar em PDF.</p>
      <a href="${downloadLink}" class="btn">Descarregar CV em PDF</a>
      <p style="font-size:13px;color:#6b7280">O link é válido por 7 dias. Se expirar, podes gerar um novo CV na tua conta.</p>
    `),

  sendPasswordReset: (toEmail, token) =>
    _send(toEmail, 'Redefinição de senha — CV Premium', `
      <p>Recebemos um pedido para redefinir a senha da tua conta.</p>
      <p>Clica no botão abaixo para criar uma nova senha. O link é válido durante <strong>1 hora</strong>.</p>
      <a href="${process.env.APP_URL}/reset?token=${token}" class="btn">Redefinir Senha</a>
      <p style="font-size:13px;color:#6b7280">Se não pediste a redefinição da senha, ignora este e-mail. A tua senha não será alterada.</p>
    `),
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
  optimizedUrl: (publicId) => getCloud().url(publicId, { fetch_format: 'auto', quality: 'auto' }),
  uploadPDF: async (buffer, userId, filename) => {
    const streamifier = require('streamifier');
    return new Promise((resolve, reject) => {
      const stream = getCloud().uploader.upload_stream(
        { folder: `cv-pdfs/${userId}`, public_id: filename, resource_type: 'raw', format: 'pdf' },
        (error, result) => error ? reject(error) : resolve(result)
      );
      streamifier.createReadStream(buffer).pipe(stream);
    });
  },
  getPDFUrl: (publicId) => getCloud().url(publicId, { resource_type: 'raw', secure: true }),
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
  generateSummary: async (name, jobTitle, experiences, skills, sector, yearsExp) => {
    const contextParts = [];
    if (experiences) contextParts.push(`Experiências anteriores: ${experiences}`);
    if (skills) contextParts.push(`Competências-chave: ${skills}`);
    if (sector) contextParts.push(`Sector: ${sector}`);
    if (yearsExp) contextParts.push(`Anos de experiência: ${yearsExp}`);
    const context = contextParts.join('\n');
    const prompt = `Escreve um resumo profissional de alto impacto para um CV, em português de Angola (formal e directo).

Candidato: ${name || jobTitle}
Cargo: ${jobTitle}
${context}

Requisitos obrigatórios:
- 3 a 4 frases densas, sem introduções genéricas ("Sou um profissional…" é proibido)
- Começa directamente com uma declaração de valor: anos de experiência, sector e especialização
- Segunda frase: menciona 2-3 competências técnicas ou realizações concretas e mensuráveis
- Terceira frase: aborda impacto gerado (crescimento, eficiência, liderança, receita, etc.)
- Última frase: menciona ambição/objectivo profissional alinhado com o cargo
- Usar verbos de acção fortes (liderou, desenvolveu, implementou, optimizou, geriu…)
- Incluir palavras-chave ATS do sector
- Tom: confiante, específico, sem clichés

Devolve APENAS o texto do resumo, sem títulos, sem aspas, sem comentários.`;
    return claudeAsk(prompt, 600);
  },
  atsScore: async (cvText, jobDescription) => {
    const raw = await claudeAsk(`Analise a compatibilidade ATS. CV: "${cvText}". VAGA: "${jobDescription}". Retorne APENAS JSON válido sem markdown: {"score":0-100,"keywords_missing":[],"suggestions":[]}`, 512);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  },
  generateResponsibilities: async (jobTitle, company, sector, yearsExp) => {
    const contextParts = [];
    if (company) contextParts.push(`Empresa: ${company}`);
    if (sector) contextParts.push(`Sector: ${sector}`);
    if (yearsExp) contextParts.push(`Nível: ${yearsExp}`);
    const context = contextParts.length ? '\nContexto: ' + contextParts.join(' | ') : '';
    const prompt = `Escreve 7 a 8 responsabilidades reais e concretas para o cargo "${jobTitle}" num CV, em português de Angola (pt-AO).${context}

REGRA ABSOLUTA — PROIBIDO usar qualquer uma destas frases genéricas:
- "Execução das funções inerentes ao cargo"
- "Colaboração com a equipa para atingir os objectivos"
- "Elaboração de relatórios de actividades e resultados"
- "Cumprimento dos procedimentos internos e normas de qualidade"
- "Atendimento e apoio a clientes/parceiros conforme necessário"
- "Participação em formações e actividades de melhoria contínua"
- "Responsável por", "Encarregue de", "Apoio a", "Colaboração em"

OBRIGATÓRIO — cada linha deve:
1. Descrever uma tarefa REAL e ESPECÍFICA deste cargo no dia-a-dia (o que a pessoa faz com as mãos, com o corpo, com a mente)
2. Ser tão específica que só faz sentido para ESTE cargo e não para qualquer outro
3. Começar com infinitivo (Preparar, Confeccionar, Garantir, Controlar, Organizar, Gerir, Coordenar, Supervisionar...)
4. Ter 8 a 18 palavras — concisa mas descritiva

Exemplo correcto para "Cozinheira":
• Preparar e confeccionar refeições diárias (pequeno-almoço, almoço e jantar)
• Elaborar pratos conforme o menu definido ou orientação superior
• Garantir higiene e segurança alimentar em todo o processo de confecção
• Controlar a conservação dos alimentos respeitando validades e métodos de armazenamento
• Organizar e manter a cozinha limpa e em condições de trabalho
• Gerir stocks básicos e comunicar necessidades de reposição ao responsável
• Adaptar refeições a necessidades específicas (dietas, alergias, crianças)
• Coordenar os tempos de preparo para cumprir os horários das refeições

Agora faz o mesmo para "${jobTitle}". Devolve apenas as linhas, sem introdução, sem conclusão, sem numeração.`;
    return claudeAsk(prompt, 700);
  }
};

// ═══════════════════════════════════════════════════════
// 7. PUPPETEER — Gerar PDF a partir do HTML do CV
// ═══════════════════════════════════════════════════════
const pdfConnector = {
  fromHTML: async (htmlContent) => {
    const puppeteer = require('puppeteer');

    // Remover Google Fonts — causam substituições de métricas durante o
    // carregamento assíncrono que fazem palavras colarem no PDF.
    const safeHtml = htmlContent
      .replace(/<link[^>]+fonts\.googleapis\.com[^>]*>/gi, '')
      .replace(/<link[^>]+fonts\.gstatic\.com[^>]*>/gi, '')
      .replace(/<link[^>]+rel=["']preconnect["'][^>]*>/gi, '');

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ]
      });
      const page = await browser.newPage();
      await page.setContent(safeHtml, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 200));
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
      });
      return pdf;
    } catch (err) {
      console.error('[PDF] Puppeteer error:', err.message);
      throw err;
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
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
// 12. TWILIO — SMS OTP, notificações e WhatsApp Business
// ═══════════════════════════════════════════════════════
const twilioConnector = {
  // SMS: código OTP
  sendOTP: (phone, otp) => {
    const t = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    return t.messages.create({ body: `CV Premium — código: ${otp}. Válido 10 min.`, from: process.env.TWILIO_PHONE, to: phone });
  },

  // WhatsApp Business via Twilio (prefixo whatsapp:)
  // Requer número aprovado no Twilio WhatsApp Sandbox ou Business Profile
  // TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  (sandbox)
  // ou número aprovado: whatsapp:+244XXXXXXXXX
  sendWhatsApp: (toPhone, message) => {
    const t = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    const to   = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;
    return t.messages.create({ body: message, from, to });
  },

  // SMS genérico (marketing, não OTP)
  sendSMS: (toPhone, message) => {
    const t = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    return t.messages.create({ body: message.slice(0, 160), from: process.env.TWILIO_PHONE, to: toPhone });
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
  onLead:     (email, score)  => zapierConnector.fire(process.env.ZAPIER_LEAD_WEBHOOK,      { event: 'new_lead', email, ats_score: score, ts: new Date().toISOString() }),
  onNewJob:   (job)           => zapierConnector.fire(process.env.ZAPIER_NEW_JOB_WEBHOOK,   { event: 'new_job', ...job, ts: new Date().toISOString() })
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
  jobConnector,         // 20 Indeed / Job Boards
  claudeAsk             // Claude directo (para rotas que precisam)
};
