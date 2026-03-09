-- ============================================================
-- MIGRATIONS.SQL — CV Generator Pro
-- Executar no SQL Server Management Studio (SSMS)
-- Banco: CVGenerator
-- ============================================================

USE CVGenerator;
GO

-- ── Users (expandido) ─────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
CREATE TABLE Users (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  Name            NVARCHAR(100)  NOT NULL,
  Email           NVARCHAR(255)  NOT NULL UNIQUE,
  PasswordHash    NVARCHAR(255),
  [Plan]          NVARCHAR(20)   DEFAULT 'free'  NOT NULL,
  PlanExpiry      DATETIME,
  Role            NVARCHAR(20)   DEFAULT 'user'  NOT NULL,
  GoogleId        NVARCHAR(100),
  LinkedInId      NVARCHAR(100),
  Phone           NVARCHAR(30),
  AvatarUrl       NVARCHAR(500),
  AvatarPublicId  NVARCHAR(255),
  IsActive        BIT            DEFAULT 1 NOT NULL,
  BannedAt        DATETIME,
  BannedBy        INT,
  LastLogin       DATETIME,
  CreatedAt       DATETIME       DEFAULT GETDATE() NOT NULL
);
GO

-- ── Templates ─────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Templates' AND xtype='U')
CREATE TABLE Templates (
  Id          INT IDENTITY(1,1) PRIMARY KEY,
  Name        NVARCHAR(100) NOT NULL,
  Slug        NVARCHAR(100) NOT NULL UNIQUE,
  PreviewUrl  NVARCHAR(500),
  IsPremium   BIT DEFAULT 0,
  Category    NVARCHAR(50),
  Active      BIT DEFAULT 1,
  SortOrder   INT DEFAULT 0,
  CreatedAt   DATETIME DEFAULT GETDATE()
);
GO

-- Inserir templates base (ignora se já existirem)
IF NOT EXISTS (SELECT 1 FROM Templates WHERE Slug = 'classico')
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Clássico',    'classico',    0, 'moderno',      1, 1),
('Minimalista', 'minimalista', 0, 'moderno',      1, 2),
('Criativo',    'criativo',    1, 'criativo',     1, 3),
('Executivo',   'executivo',   1, 'profissional', 1, 4),
('Moderno',     'moderno',     1, 'moderno',      1, 5);
GO

-- ── CVs ───────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CVs' AND xtype='U')
CREATE TABLE CVs (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  UserId        INT           NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
  Title         NVARCHAR(255) NOT NULL,
  TemplateId    INT           DEFAULT 1,
  TemplateName  NVARCHAR(100),
  ContentJson   NVARCHAR(MAX),
  S3Key         NVARCHAR(500),
  IsPublic      BIT           DEFAULT 0,
  Slug          NVARCHAR(255) UNIQUE,
  Downloaded    BIT           DEFAULT 0,
  DownloadCount INT           DEFAULT 0,
  AtsScore      INT           DEFAULT 0,
  CreatedAt     DATETIME      DEFAULT GETDATE(),
  UpdatedAt     DATETIME      DEFAULT GETDATE()
);
GO

-- ── Payments ──────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Payments' AND xtype='U')
CREATE TABLE Payments (
  Id                INT IDENTITY(1,1) PRIMARY KEY,
  UserId            INT           NOT NULL REFERENCES Users(Id),
  Amount            DECIMAL(10,2) NOT NULL,
  Currency          NVARCHAR(10)  DEFAULT 'USD',
  Status            NVARCHAR(20)  NOT NULL,
  Method            NVARCHAR(30),
  StripeSessionId   NVARCHAR(255),
  PaypalOrderId     NVARCHAR(255),
  CreatedAt         DATETIME      DEFAULT GETDATE()
);
GO

-- ── ReferralCodes ─────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ReferralCodes' AND xtype='U')
CREATE TABLE ReferralCodes (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  UserId    INT          NOT NULL REFERENCES Users(Id),
  Code      NVARCHAR(20) NOT NULL UNIQUE,
  CreatedAt DATETIME     DEFAULT GETDATE()
);
GO

-- ── Referrals ─────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Referrals' AND xtype='U')
CREATE TABLE Referrals (
  Id          INT IDENTITY(1,1) PRIMARY KEY,
  ReferrerId  INT  NOT NULL REFERENCES Users(Id),
  ReferredId  INT  NOT NULL REFERENCES Users(Id),
  Rewarded    BIT  DEFAULT 0,
  CreatedAt   DATETIME DEFAULT GETDATE()
);
GO

-- ── EmailQueue (drip campaigns) ───────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EmailQueue' AND xtype='U')
CREATE TABLE EmailQueue (
  Id          INT IDENTITY(1,1) PRIMARY KEY,
  UserId      INT           REFERENCES Users(Id),
  Email       NVARCHAR(255) NOT NULL,
  Subject     NVARCHAR(255) NOT NULL,
  [Template]  NVARCHAR(100) NOT NULL,
  ScheduledAt DATETIME      NOT NULL,
  Sent        BIT           DEFAULT 0,
  SentAt      DATETIME,
  CreatedAt   DATETIME      DEFAULT GETDATE()
);
GO

-- ── Leads (sem registo) ───────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Leads' AND xtype='U')
CREATE TABLE Leads (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  Email     NVARCHAR(255) NOT NULL UNIQUE,
  Source    NVARCHAR(100),
  ATSScore  INT,
  CreatedAt DATETIME DEFAULT GETDATE()
);
GO

-- ── Coaches ───────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Coaches' AND xtype='U')
CREATE TABLE Coaches (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  Name      NVARCHAR(100) NOT NULL,
  Location  NVARCHAR(100),
  Bio       NVARCHAR(MAX),
  Skills    NVARCHAR(500),
  Email     NVARCHAR(255),
  Color     NVARCHAR(20) DEFAULT '#6366f1',
  Active    BIT DEFAULT 1,
  CreatedAt DATETIME DEFAULT GETDATE()
);
GO

-- ── Courses ────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Courses' AND xtype='U')
CREATE TABLE Courses (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  Title     NVARCHAR(255) NOT NULL,
  Source    NVARCHAR(100),
  Category  NVARCHAR(100),
  Rating    NVARCHAR(10),
  Url       NVARCHAR(500),
  Active    BIT DEFAULT 1,
  CreatedAt DATETIME DEFAULT GETDATE()
);
GO

-- ── Jobs ───────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Jobs' AND xtype='U')
CREATE TABLE Jobs (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  Title     NVARCHAR(255) NOT NULL,
  Company   NVARCHAR(255),
  City      NVARCHAR(100),
  Country   NVARCHAR(100),
  Category  NVARCHAR(100),
  JobDate   DATE,
  Url       NVARCHAR(500),
  Active    BIT DEFAULT 1,
  CreatedAt DATETIME DEFAULT GETDATE()
);
GO

-- ── Testimonials ───────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Testimonials' AND xtype='U')
CREATE TABLE Testimonials (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  Name      NVARCHAR(100) NOT NULL,
  Role      NVARCHAR(100),
  [Text]    NVARCHAR(MAX),
  Stars     INT DEFAULT 5,
  Active    BIT DEFAULT 1,
  CreatedAt DATETIME DEFAULT GETDATE()
);
GO

-- ── Colunas adicionadas posteriormente (para BDs já existentes) ──
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('CVs') AND name='AtsScore')
  ALTER TABLE CVs ADD AtsScore INT DEFAULT 0;
GO

-- ── Índices para performance ──────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CVs_UserId')
  CREATE INDEX IX_CVs_UserId ON CVs(UserId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CVs_CreatedAt')
  CREATE INDEX IX_CVs_CreatedAt ON CVs(CreatedAt DESC);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Payments_UserId')
  CREATE INDEX IX_Payments_UserId ON Payments(UserId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Payments_Status')
  CREATE INDEX IX_Payments_Status ON Payments(Status, CreatedAt DESC);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_EmailQueue_Pending')
  CREATE INDEX IX_EmailQueue_Pending ON EmailQueue(ScheduledAt) WHERE Sent = 0;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Users_Plan')
  CREATE INDEX IX_Users_Plan ON Users([Plan]);
GO

PRINT 'Migracoes concluidas com sucesso!';
GO
