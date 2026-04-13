-- ─────────────────────────────────────────────────────────────
-- MARKETING AUTOMATION — Migrações
-- Executar no SSMS ou via: npm run migrate (se configurado)
-- ─────────────────────────────────────────────────────────────

-- 1. Rastreio de eventos comportamentais
-- Guarda cada acção significativa do utilizador (anónimo ou autenticado)
CREATE TABLE IF NOT EXISTS user_events (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id   VARCHAR(64)  NOT NULL,
  event        VARCHAR(80)  NOT NULL,   -- ex: cv_created, pricing_visited, ats_used
  properties   TEXT,                    -- JSON com detalhes do evento
  page         VARCHAR(200),
  source       VARCHAR(80),             -- utm_source
  medium       VARCHAR(80),             -- utm_medium
  campaign     VARCHAR(80),             -- utm_campaign
  ip           VARCHAR(45),
  created_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_events_user    ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event   ON user_events(event);
CREATE INDEX IF NOT EXISTS idx_user_events_session ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_user_events_ts      ON user_events(created_at);

-- 2. Segmentos de utilizadores (definição SQL dinâmica)
CREATE TABLE IF NOT EXISTS marketing_segments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  sql_filter  TEXT NOT NULL,   -- WHERE clause dinâmica executada sobre users
  color       VARCHAR(20) DEFAULT '#6366f1',
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Segmentos pré-definidos
INSERT INTO marketing_segments (name, description, sql_filter, color) VALUES
  ('Novos utilizadores',    'Registados nos últimos 7 dias',        'created_at >= NOW() - INTERVAL ''7 days''', '#10b981'),
  ('Free sem CV',           'Plano free e sem CVs criados',          'plan = ''free'' AND (SELECT COUNT(*) FROM cvs WHERE user_id = users.id) = 0', '#f59e0b'),
  ('Free com CV',           'Plano free e com pelo menos 1 CV',      'plan = ''free'' AND (SELECT COUNT(*) FROM cvs WHERE user_id = users.id) > 0', '#3b82f6'),
  ('Premium activo',        'Plano premium com expiry futuro',        'plan = ''premium'' AND (plan_expiry IS NULL OR plan_expiry > NOW())', '#8b5cf6'),
  ('Inactivos 7 dias',      'Último login há mais de 7 dias',         'last_login < NOW() - INTERVAL ''7 days'' AND last_login IS NOT NULL', '#ef4444'),
  ('Inactivos 30 dias',     'Último login há mais de 30 dias',        'last_login < NOW() - INTERVAL ''30 days'' AND last_login IS NOT NULL', '#dc2626'),
  ('Visitaram pricing',     'Visitaram /pricing nos últimos 14 dias', 'id IN (SELECT DISTINCT user_id FROM user_events WHERE event = ''pricing_visited'' AND created_at >= NOW() - INTERVAL ''14 days'' AND user_id IS NOT NULL)', '#f97316'),
  ('Usaram ATS',            'Usaram a ferramenta ATS pública',        'id IN (SELECT DISTINCT user_id FROM user_events WHERE event = ''ats_used'' AND user_id IS NOT NULL)', '#06b6d4'),
  ('CV abandonado',         'Iniciaram CV mas nunca geraram PDF',     'plan = ''free'' AND (SELECT COUNT(*) FROM cvs WHERE user_id = users.id) > 0 AND (SELECT COUNT(*) FROM payments WHERE user_id = users.id AND status = ''paid'') = 0', '#ec4899')
ON CONFLICT (name) DO NOTHING;

-- 3. Campanhas de e-mail / WhatsApp
CREATE TABLE IF NOT EXISTS campaigns (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  subject       VARCHAR(300),               -- assunto do e-mail
  channel       VARCHAR(20) DEFAULT 'email', -- email | whatsapp | sms
  template_key  VARCHAR(80),                -- chave do template HTML
  body_html     TEXT,                       -- HTML do e-mail (override do template)
  body_text     TEXT,                       -- texto para WhatsApp/SMS
  segment_id    INTEGER REFERENCES marketing_segments(id),
  status        VARCHAR(20) DEFAULT 'draft', -- draft | scheduled | sent | paused
  scheduled_at  TIMESTAMP,
  sent_at       TIMESTAMP,
  total_sent    INTEGER DEFAULT 0,
  total_opened  INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- 4. Registo de envios por campanha (evita reenvios duplicados)
CREATE TABLE IF NOT EXISTS campaign_sends (
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
);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_cid ON campaign_sends(campaign_id);

-- 5. Regras de automação comportamental
CREATE TABLE IF NOT EXISTS automation_rules (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  trigger_event VARCHAR(80) NOT NULL,       -- evento que activa: cv_created, pricing_visited, etc.
  delay_hours   INTEGER DEFAULT 0,          -- delay após o trigger
  channel       VARCHAR(20) DEFAULT 'email',
  subject       VARCHAR(300),
  body_html     TEXT,
  body_text     TEXT,
  condition_sql TEXT,                       -- WHERE adicional sobre o utilizador (opcional)
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Regras pré-definidas de automação
INSERT INTO automation_rules (name, trigger_event, delay_hours, channel, subject, body_html, body_text) VALUES
  (
    'CV criado — upgrade nudge (24h)',
    'cv_created', 24, 'email',
    'O teu CV está quase perfeito — falta apenas descarregá-lo',
    '<h2>O teu CV está pronto!</h2><p>Criaste o teu CV com sucesso. Para o descarregar em PDF sem marca d''água, activa um plano a partir de <strong>4.000 Kz</strong>.</p><a href="{{APP_URL}}/pricing" class="btn">Ver Planos</a>',
    'O teu CV está pronto! Para descarregá-lo em PDF, activa um plano em {{APP_URL}}/pricing'
  ),
  (
    'Visitou pricing — sem compra (2h)',
    'pricing_visited', 2, 'email',
    'Ainda a pensar? Temos uma oferta para ti',
    '<h2>Vimos que visitaste os nossos planos</h2><p>Se tiveres alguma dúvida sobre o processo de pagamento, fala connosco pelo WhatsApp. Estamos aqui para ajudar!</p><div class="highlight"><strong>Plano Semanal:</strong> 4.000 Kz — 7 dias de acesso total<br><strong>Plano Mensal:</strong> 10.000 Kz — 30 dias + suporte prioritário</div><a href="{{APP_URL}}/pricing" class="btn">Activar Agora</a>',
    'Ainda a pensar no plano? Fala connosco no WhatsApp ou acede a {{APP_URL}}/pricing'
  ),
  (
    'Inactivo 7 dias — reengagement',
    'user_inactive_7d', 0, 'email',
    '{{name}}, o teu CV está à espera de ti',
    '<h2>{{name}}, não abandones o teu CV</h2><p>Já passaram 7 dias desde a tua última visita. Os recrutadores angolanos estão constantemente à procura de candidatos como tu.</p><a href="{{APP_URL}}/editor" class="btn">Continuar o Meu CV</a>',
    '{{name}}, já passaram 7 dias! O teu CV está à espera. Acede a {{APP_URL}}/editor'
  ),
  (
    'ATS usado — converter para registo',
    'ats_used', 1, 'email',
    'O teu score ATS — próximos passos',
    '<h2>Optimiza o teu CV para 100 pontos ATS</h2><p>Usaste a nossa ferramenta ATS. Para implementar todas as melhorias sugeridas, cria uma conta gratuita e usa a IA do CV Premium.</p><a href="{{APP_URL}}/register" class="btn">Criar Conta Gratuita</a>',
    'Quer atingir 100 pontos ATS? Cria uma conta gratuita em {{APP_URL}}/register'
  )
ON CONFLICT DO NOTHING;

-- 6. Registo de execuções de automação (evita duplicados)
CREATE TABLE IF NOT EXISTS automation_sends (
  id           SERIAL PRIMARY KEY,
  rule_id      INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email        VARCHAR(200),
  triggered_at TIMESTAMP DEFAULT NOW(),
  sent_at      TIMESTAMP,
  UNIQUE(rule_id, email)
);

-- 7. Preferências de notificação do utilizador
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_email  BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_whatsapp BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_sms    BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login       TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone            VARCHAR(30);

-- 8. Tabela de leads enriquecida (se não existir)
CREATE TABLE IF NOT EXISTS leads (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(200) UNIQUE NOT NULL,
  name       VARCHAR(200),
  phone      VARCHAR(30),
  ats_score  INTEGER,
  source     VARCHAR(80),
  converted  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
