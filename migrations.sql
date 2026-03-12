-- ============================================================
-- MIGRATIONS.SQL — CV Generator Pro (PostgreSQL)
-- Run on Railway PostgreSQL or any PostgreSQL instance
-- ============================================================

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100)  NOT NULL,
  email            VARCHAR(255)  NOT NULL UNIQUE,
  password_hash    VARCHAR(255),
  plan             VARCHAR(20)   DEFAULT 'free' NOT NULL,
  plan_expiry      TIMESTAMP,
  role             VARCHAR(20)   DEFAULT 'user' NOT NULL,
  google_id        VARCHAR(100),
  linkedin_id      VARCHAR(100),
  phone            VARCHAR(30),
  avatar_url       VARCHAR(500),
  avatar_public_id VARCHAR(255),
  is_active        BOOLEAN       DEFAULT TRUE NOT NULL,
  banned_at        TIMESTAMP,
  banned_by        INTEGER,
  last_login       TIMESTAMP,
  created_at       TIMESTAMP     DEFAULT NOW() NOT NULL
);

-- ── Templates ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  preview_url VARCHAR(500),
  is_premium  BOOLEAN DEFAULT FALSE,
  category    VARCHAR(50),
  active      BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO templates (name, slug, is_premium, category, active, sort_order) VALUES
('Clássico',    'classico',    FALSE, 'moderno',      TRUE, 1),
('Minimalista', 'minimalista', FALSE, 'moderno',      TRUE, 2),
('Criativo',    'criativo',    TRUE,  'criativo',     TRUE, 3),
('Executivo',   'executivo',   TRUE,  'profissional', TRUE, 4),
('Moderno',     'moderno',     TRUE,  'moderno',      TRUE, 5)
ON CONFLICT (slug) DO NOTHING;

-- ── CVs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cvs (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          VARCHAR(255)  NOT NULL,
  template_id    INTEGER       DEFAULT 1,
  template_name  VARCHAR(100),
  content_json   TEXT,
  s3_key         VARCHAR(500),
  is_public      BOOLEAN       DEFAULT FALSE,
  slug           VARCHAR(255)  UNIQUE,
  downloaded     BOOLEAN       DEFAULT FALSE,
  download_count INTEGER       DEFAULT 0,
  ats_score      INTEGER       DEFAULT 0,
  created_at     TIMESTAMP     DEFAULT NOW(),
  updated_at     TIMESTAMP     DEFAULT NOW()
);

-- ── Payments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER       NOT NULL REFERENCES users(id),
  amount            NUMERIC(10,2) NOT NULL,
  currency          VARCHAR(10)   DEFAULT 'USD',
  status            VARCHAR(20)   NOT NULL,
  method            VARCHAR(30),
  stripe_session_id VARCHAR(255),
  paypal_order_id   VARCHAR(255),
  created_at        TIMESTAMP     DEFAULT NOW()
);

-- ── ReferralCodes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_codes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id),
  code       VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP   DEFAULT NOW()
);

-- ── Referrals ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id          SERIAL PRIMARY KEY,
  referrer_id INTEGER   NOT NULL REFERENCES users(id),
  referred_id INTEGER   NOT NULL REFERENCES users(id),
  rewarded    BOOLEAN   DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── EmailQueue ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_queue (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER      REFERENCES users(id),
  email        VARCHAR(255) NOT NULL,
  subject      VARCHAR(255) NOT NULL,
  template     VARCHAR(100) NOT NULL,
  scheduled_at TIMESTAMP    NOT NULL,
  sent         BOOLEAN      DEFAULT FALSE,
  sent_at      TIMESTAMP,
  created_at   TIMESTAMP    DEFAULT NOW()
);

-- ── Leads ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL UNIQUE,
  source     VARCHAR(100),
  ats_score  INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Coaches ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coaches (
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
);
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);

-- ── Courses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  source     VARCHAR(100),
  category   VARCHAR(100),
  rating     VARCHAR(10),
  url        VARCHAR(500),
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Jobs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
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
);
-- Colunas adicionadas em v2 (ignoradas se já existirem)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_date   DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_date     DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_type VARCHAR(20) DEFAULT 'url';

-- ── Testimonials ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS testimonials (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  role       VARCHAR(100),
  text       TEXT,
  stars      INTEGER DEFAULT 5,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Page Views ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_views (
  id         SERIAL PRIMARY KEY,
  page       VARCHAR(100) NOT NULL,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Support Tickets ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255),
  message     TEXT NOT NULL,
  status      VARCHAR(20) DEFAULT 'open',
  reply       TEXT,
  replied_at  TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_cvs_user_id         ON cvs(user_id);
CREATE INDEX IF NOT EXISTS ix_cvs_created_at      ON cvs(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_payments_user_id    ON payments(user_id);
CREATE INDEX IF NOT EXISTS ix_payments_status     ON payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_email_queue_pending ON email_queue(scheduled_at) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS ix_users_plan          ON users(plan);
