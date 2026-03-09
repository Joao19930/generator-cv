// src/routes/auth.js
// ─────────────────────────────────────────────────────────────
// Rotas de autenticação: registo, login, Google, LinkedIn, logout
// ─────────────────────────────────────────────────────────────
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { sql }  = require('../config/database');
const { emailConnector, smtpConnector, googleConnector, linkedinConnector,
        hubspotConnector, zapierConnector, redisConnector, intercomConnector } = require('../connectors');
const { auth }       = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const GOOGLE_REDIRECT = `${process.env.APP_URL}/api/auth/google/callback`;
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT
);

const signToken = (user) =>
  jwt.sign({ id: user.Id, email: user.Email, role: user.Role, plan: user.Plan || user.plan },
    process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ── POST /api/auth/register ──────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, referralCode } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });

  try {
    const pool = req.db;
    const exists = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM users WHERE email = @email');
    if (exists.recordset.length)
      return res.status(409).json({ error: 'E-mail já registado' });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.request()
      .input('name',  sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('hash',  sql.NVarChar, hash)
      .query(`INSERT INTO users (name, email, password_hash, plan, role, created_at)
              VALUES (@name, @email, @hash, 'free', 'user', NOW())
              RETURNING id, name, email, plan, role`);

    const user  = result.recordset[0];
    const token = signToken(user);

    // Acções pós-registo (não bloquear a resposta)
    Promise.allSettled([
      emailConnector.sendWelcome(email, name).catch(() => smtpConnector.send(email, 'Bem-vindo ao CV Generator!', `<h2>Olá ${name}!</h2><p>A sua conta foi criada com sucesso.</p><a href="${process.env.APP_URL}">Criar CV agora</a>`)),
      hubspotConnector.createContact(email, name),
      zapierConnector.onNewUser({ email, name }),
      intercomConnector.createUser(email, name, user.Id),
      referralCode ? pool.request().input('code', sql.NVarChar, referralCode).input('newId', sql.Int, user.Id)
        .query(`INSERT INTO referrals (referrer_id, referred_id, created_at)
                SELECT user_id, @newId, NOW() FROM referral_codes WHERE code = @code`) : Promise.resolve()
    ]);

    res.status(201).json({ token, user: { id: user.Id, name: user.Name, email: user.Email, plan: user.Plan } });
  } catch (err) {
    console.error('register:', err.message);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });

  try {
    const pool = req.db;
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id, name, email, password_hash, plan, role FROM users WHERE email = @email AND is_active = TRUE');

    if (!result.recordset.length)
      return res.status(401).json({ error: 'Credenciais inválidas' });

    const user = result.recordset[0];
    const valid = await bcrypt.compare(password, user.PasswordHash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    pool.request().input('id', sql.Int, user.Id)
      .query('UPDATE users SET last_login = NOW() WHERE id = @id');

    const token = signToken(user);
    res.json({ token, user: { id: user.Id, name: user.Name, email: user.Email, plan: user.Plan, role: user.Role } });
  } catch (err) {
    console.error('login:', err.message);
    res.status(500).json({ error: 'Erro ao iniciar sessão' });
  }
});

// ── GET /auth/google — redireciona para Google ───────────────
router.get('/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['profile', 'email'],
  });
  res.redirect(url);
});

// ── GET /api/auth/google/callback ────────────────────────────
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`${process.env.APP_URL}/login?error=google_denied`);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const pool = req.db;
    let user = (await pool.request()
      .input('googleId', sql.NVarChar, payload.sub)
      .query('SELECT id, name, email, plan, role FROM users WHERE google_id = @googleId'))
      .recordset[0];

    if (!user) {
      const ins = await pool.request()
        .input('name',     sql.NVarChar, payload.name)
        .input('email',    sql.NVarChar, payload.email)
        .input('googleId', sql.NVarChar, payload.sub)
        .input('avatar',   sql.NVarChar, payload.picture || '')
        .query(`INSERT INTO users (name, email, google_id, avatar_url, plan, role, created_at)
                VALUES (@name, @email, @googleId, @avatar, 'free', 'user', NOW())
                RETURNING id, name, email, plan, role`);
      user = ins.recordset[0];
      zapierConnector.onNewUser({ email: user.Email, name: user.Name, source: 'google' }).catch(() => {});
    }

    const token = signToken(user);
    const userJson = JSON.stringify({ id: user.Id, name: user.Name, email: user.Email, plan: user.Plan, role: user.Role })
      .replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    res.send(`<!DOCTYPE html><html><body><script>
      localStorage.setItem('cv_token', '${token}');
      localStorage.setItem('cv_user', '${userJson}');
      window.location.href = '/app';
    </script></body></html>`);
  } catch (err) {
    console.error('google-callback ERROR:', err.message, err.stack);
    const msg = encodeURIComponent(err.message || 'google_failed');
    res.redirect(`${process.env.APP_URL}/login?error=google_failed&detail=${msg}`);
  }
});

// ── POST /api/auth/google ────────────────────────────────────
router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  try {
    const payload = await googleConnector.verify(idToken);
    const pool = req.db;
    let user = (await pool.request().input('googleId', sql.NVarChar, payload.sub)
      .query('SELECT id, name, email, plan, role FROM users WHERE google_id = @googleId')).recordset[0];

    if (!user) {
      const ins = await pool.request()
        .input('name',     sql.NVarChar, payload.name)
        .input('email',    sql.NVarChar, payload.email)
        .input('googleId', sql.NVarChar, payload.sub)
        .input('avatar',   sql.NVarChar, payload.picture)
        .query(`INSERT INTO users (name, email, google_id, avatar_url, plan, role, created_at)
                VALUES (@name, @email, @googleId, @avatar, 'free', 'user', NOW())
                RETURNING id, name, email, plan, role`);
      user = ins.recordset[0];
      zapierConnector.onNewUser({ email: user.Email, name: user.Name, source: 'google' });
    }
    res.json({ token: signToken(user), user: { id: user.Id, name: user.Name, email: user.Email, plan: user.Plan } });
  } catch (err) {
    console.error('google-auth:', err.message);
    res.status(401).json({ error: 'Token Google inválido' });
  }
});

// ── GET /api/auth/linkedin — redireciona para LinkedIn ───────
router.get('/linkedin', (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.LINKEDIN_CLIENT_ID,
    redirect_uri:  process.env.LINKEDIN_REDIRECT_URI,
    scope:         'openid profile email',
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

// ── GET /api/auth/linkedin/callback ─────────────────────────
router.get('/linkedin/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`${process.env.APP_URL}/login?error=linkedin_denied`);

  try {
    // 1. Trocar code por access token
    const tokenRes = await require('axios').post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  process.env.LINKEDIN_REDIRECT_URI,
        client_id:     process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const accessToken = tokenRes.data.access_token;

    // 2. Obter perfil via OpenID Connect userinfo
    const profileRes = await require('axios').get(
      'https://api.linkedin.com/v2/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const p = profileRes.data;
    // p.sub = LinkedIn ID, p.name, p.email, p.picture
    const linkedinId = p.sub;
    const fullName   = p.name || `${p.given_name || ''} ${p.family_name || ''}`.trim();
    const email      = p.email || '';
    const avatar     = p.picture || '';

    const pool = req.db;
    let user = (await pool.request()
      .input('linkedinId', sql.NVarChar, linkedinId)
      .query('SELECT id, name, email, plan, role FROM users WHERE linkedin_id = @linkedinId'))
      .recordset[0];

    if (!user) {
      // Verificar se já existe conta com esse email
      const byEmail = email ? (await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT id, name, email, plan, role FROM users WHERE email = @email'))
        .recordset[0] : null;

      if (byEmail) {
        await pool.request()
          .input('id',         sql.Int,      byEmail.Id)
          .input('linkedinId', sql.NVarChar, linkedinId)
          .input('avatar',     sql.NVarChar, avatar)
          .query('UPDATE users SET linkedin_id = @linkedinId, avatar_url = @avatar WHERE id = @id');
        user = byEmail;
      } else {
        const ins = await pool.request()
          .input('name',       sql.NVarChar, fullName)
          .input('email',      sql.NVarChar, email)
          .input('linkedinId', sql.NVarChar, linkedinId)
          .input('avatar',     sql.NVarChar, avatar)
          .query(`INSERT INTO users (name, email, linkedin_id, avatar_url, plan, role, created_at)
                  VALUES (@name, @email, @linkedinId, @avatar, 'free', 'user', NOW())
                  RETURNING id, name, email, plan, role`);
        user = ins.recordset[0];
        zapierConnector.onNewUser({ email: user.Email, name: user.Name, source: 'linkedin' }).catch(() => {});
      }
    }

    const token = signToken(user);
    const userJson = JSON.stringify({ id: user.Id, name: user.Name, email: user.Email, plan: user.Plan, role: user.Role })
      .replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    res.send(`<!DOCTYPE html><html><body><script>
      localStorage.setItem('cv_token', '${token}');
      localStorage.setItem('cv_user', '${userJson}');
      window.location.href = '/app';
    </script></body></html>`);
  } catch (err) {
    console.error('linkedin-callback ERROR:', err.message, err.stack);
    const msg = encodeURIComponent(err.message || 'linkedin_failed');
    res.redirect(`${process.env.APP_URL}/login?error=linkedin_failed&detail=${msg}`);
  }
});

// ── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', auth, async (req, res) => {
  try {
    const decoded = jwt.decode(req.token);
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) await redisConnector.blacklistToken(req.token, ttl);
    res.json({ message: 'Sessão encerrada' });
  } catch {
    res.json({ message: 'Sessão encerrada' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const pool   = req.db;
    const result = await pool.request().input('id', sql.Int, req.user.id)
      .query('SELECT id, name, email, plan, plan_expiry, role, avatar_url, phone, created_at FROM users WHERE id = @id');
    if (!result.recordset.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/auth/me ─────────────────────────────────────────
router.put('/me', auth, async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: 'O nome é obrigatório' });

  try {
    const pool = req.db;
    await pool.request()
      .input('id',    sql.Int,      req.user.id)
      .input('name',  sql.NVarChar, name.trim())
      .input('phone', sql.NVarChar, phone || '')
      .query('UPDATE users SET name = @name, phone = @phone WHERE id = @id');

    const result = await pool.request().input('id', sql.Int, req.user.id)
      .query('SELECT id, name, email, plan, plan_expiry, role, avatar_url, phone, created_at FROM users WHERE id = @id');
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/change-password ───────────────────────────
router.post('/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });

  try {
    const pool = req.db;
    const result = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT password_hash FROM users WHERE id = @id');

    if (!result.recordset.length)
      return res.status(404).json({ error: 'Utilizador não encontrado' });

    const user = result.recordset[0];
    if (!user.PasswordHash)
      return res.status(400).json({ error: 'Conta OAuth — não tem senha definida' });

    const valid = await bcrypt.compare(currentPassword, user.PasswordHash);
    if (!valid) return res.status(400).json({ error: 'Senha atual incorreta' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.request()
      .input('id',   sql.Int,      req.user.id)
      .input('hash', sql.NVarChar, hash)
      .query('UPDATE users SET password_hash = @hash WHERE id = @id');

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
