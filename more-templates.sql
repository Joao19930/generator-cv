-- more-templates.sql
-- Inserir 120 novos templates (novas categorias e profissões)
-- Executar no SSMS: USE CVGenerator; GO

USE CVGenerator;
GO

-- ── Turismo, Hotelaria, Restauração ──────────────────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Recepcionista de Hotel',      'recepcionista-hotel',       1, 'Turismo, Hotelaria, Restauração', 1, 10),
('Gestor de Hotel',             'gestor-hotel',              1, 'Turismo, Hotelaria, Restauração', 1, 11),
('Animador Turístico',          'animador-turistico',        1, 'Turismo, Hotelaria, Restauração', 1, 12),
('Agente de Viagens',           'agente-viagens',            1, 'Turismo, Hotelaria, Restauração', 1, 13),
('Guia Turístico',              'guia-turistico',            1, 'Turismo, Hotelaria, Restauração', 1, 14),
('Empregado de Mesa',           'empregado-mesa',            0, 'Turismo, Hotelaria, Restauração', 1, 15),
('Barman / Bartender',          'barman',                    1, 'Turismo, Hotelaria, Restauração', 1, 16),
('Cozinheiro',                  'cozinheiro',                0, 'Turismo, Hotelaria, Restauração', 1, 17),
('Director de Restaurante',     'director-restaurante',      1, 'Turismo, Hotelaria, Restauração', 1, 18),
('Sommelier',                   'sommelier',                 1, 'Turismo, Hotelaria, Restauração', 1, 19);
GO

-- ── Transportes, Logística, Distribuição ─────────────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Motorista Profissional',       'motorista-profissional',   0, 'Transportes, Logística', 1, 10),
('Gestor de Logística',          'gestor-logistica',         1, 'Transportes, Logística', 1, 11),
('Operador de Armazém',          'operador-armazem',         0, 'Transportes, Logística', 1, 12),
('Responsável de Compras',       'responsavel-compras',      1, 'Transportes, Logística', 1, 13),
('Coordenador de Frotas',        'coordenador-frotas',       1, 'Transportes, Logística', 1, 14),
('Despachante Aduaneiro',        'despachante-aduaneiro',    1, 'Transportes, Logística', 1, 15),
('Gestor de Supply Chain',       'gestor-supply-chain',      1, 'Transportes, Logística', 1, 16),
('Técnico de Tráfego Aéreo',     'tecnico-trafego-aereo',    1, 'Transportes, Logística', 1, 17),
('Piloto Comercial',             'piloto-comercial',         1, 'Transportes, Logística', 1, 18),
('Marinheiro / Oficial Naval',   'oficial-naval',            1, 'Transportes, Logística', 1, 19);
GO

-- ── Construção, Imobiliário ───────────────────────────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Engenheiro de Construção',     'engenheiro-construcao',    1, 'Construção, Imobiliário', 1, 10),
('Mestre de Obras',              'mestre-obras',             0, 'Construção, Imobiliário', 1, 11),
('Encanador / Canalizador',      'canalizador',              0, 'Construção, Imobiliário', 1, 12),
('Carpinteiro',                  'carpinteiro',              0, 'Construção, Imobiliário', 1, 13),
('Gestor Imobiliário',           'gestor-imobiliario',       1, 'Construção, Imobiliário', 1, 14),
('Consultor Imobiliário',        'consultor-imobiliario',    1, 'Construção, Imobiliário', 1, 15),
('Avaliador de Imóveis',         'avaliador-imoveis',        1, 'Construção, Imobiliário', 1, 16),
('Técnico de Energias Renováveis','tecnico-energias-renovaveis',1,'Construção, Imobiliário',1,17),
('Serralheiro',                  'serralheiro',              0, 'Construção, Imobiliário', 1, 18),
('Pintor de Construção Civil',   'pintor-construcao',        0, 'Construção, Imobiliário', 1, 19);
GO

-- ── Vendas, Comércio, Retalho ─────────────────────────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Vendedor / Comercial',         'vendedor-comercial',       0, 'Vendas, Comércio, Retalho', 1, 10),
('Director Comercial',           'director-comercial',       1, 'Vendas, Comércio, Retalho', 1, 11),
('Gestor de Vendas',             'gestor-vendas',            1, 'Vendas, Comércio, Retalho', 1, 12),
('Representante Comercial',      'representante-comercial',  1, 'Vendas, Comércio, Retalho', 1, 13),
('Gestor de Loja',               'gestor-loja',              1, 'Vendas, Comércio, Retalho', 1, 14),
('Operador de Caixa',            'operador-caixa',           0, 'Vendas, Comércio, Retalho', 1, 15),
('E-commerce Manager',           'ecommerce-manager',        1, 'Vendas, Comércio, Retalho', 1, 16),
('Key Account Manager',          'key-account-manager',      1, 'Vendas, Comércio, Retalho', 1, 17),
('Promotor de Vendas',           'promotor-vendas',          0, 'Vendas, Comércio, Retalho', 1, 18),
('Comprador de Retalho',         'comprador-retalho',        1, 'Vendas, Comércio, Retalho', 1, 19);
GO

-- ── Tecnologia / Informática (mais específicos) ───────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('DevOps Engineer',              'devops-engineer',          1, 'Engenheiro, TI, Arquitecto', 1, 20),
('Data Scientist',               'data-scientist',           1, 'Engenheiro, TI, Arquitecto', 1, 21),
('Cybersecurity Analyst',        'cybersecurity-analyst',    1, 'Engenheiro, TI, Arquitecto', 1, 22),
('UX/UI Designer',               'ux-ui-designer',           1, 'Engenheiro, TI, Arquitecto', 1, 23),
('Product Manager',              'product-manager',          1, 'Engenheiro, TI, Arquitecto', 1, 24),
('QA Engineer',                  'qa-engineer',              1, 'Engenheiro, TI, Arquitecto', 1, 25),
('Machine Learning Engineer',    'machine-learning-engineer',1, 'Engenheiro, TI, Arquitecto', 1, 26),
('Cloud Architect',              'cloud-architect',          1, 'Engenheiro, TI, Arquitecto', 1, 27),
('Mobile Developer',             'mobile-developer',         1, 'Engenheiro, TI, Arquitecto', 1, 28),
('Database Administrator',       'database-administrator',   1, 'Engenheiro, TI, Arquitecto', 1, 29),
('Network Engineer',             'network-engineer',         1, 'Engenheiro, TI, Arquitecto', 1, 30),
('Scrum Master',                 'scrum-master',             1, 'Engenheiro, TI, Arquitecto', 1, 31);
GO

-- ── Desporto, Fitness, Bem-estar ─────────────────────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Personal Trainer',             'personal-trainer',         0, 'Desporto, Fitness, Bem-estar', 1, 10),
('Fisioterapeuta',               'fisioterapeuta',           1, 'Desporto, Fitness, Bem-estar', 1, 11),
('Nutricionista',                'nutricionista',            1, 'Desporto, Fitness, Bem-estar', 1, 12),
('Treinador Desportivo',         'treinador-desportivo',     1, 'Desporto, Fitness, Bem-estar', 1, 13),
('Psicólogo',                    'psicologo',                1, 'Desporto, Fitness, Bem-estar', 1, 14),
('Terapeuta Ocupacional',        'terapeuta-ocupacional',    1, 'Desporto, Fitness, Bem-estar', 1, 15),
('Instrutor de Yoga',            'instrutor-yoga',           0, 'Desporto, Fitness, Bem-estar', 1, 16),
('Massagista Terapêutico',       'massagista-terapeutico',   0, 'Desporto, Fitness, Bem-estar', 1, 17),
('Gestor de Ginásio',            'gestor-ginasio',           1, 'Desporto, Fitness, Bem-estar', 1, 18),
('Árbitro Desportivo',           'arbitro-desportivo',       1, 'Desporto, Fitness, Bem-estar', 1, 19);
GO

-- ── Arte, Música, Entretenimento ─────────────────────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Actor / Actriz',               'actor',                    1, 'Arte, Música, Entretenimento', 1, 10),
('Músico / Instrumentista',      'musico',                   1, 'Arte, Música, Entretenimento', 1, 11),
('Produtor Musical',             'produtor-musical',         1, 'Arte, Música, Entretenimento', 1, 12),
('Fotógrafo',                    'fotografo',                1, 'Arte, Música, Entretenimento', 1, 13),
('Videógrafo / Editor de Vídeo', 'videografo',               1, 'Arte, Música, Entretenimento', 1, 14),
('Animador 3D',                  'animador-3d',              1, 'Arte, Música, Entretenimento', 1, 15),
('Locutor / Apresentador',       'locutor',                  1, 'Arte, Música, Entretenimento', 1, 16),
('Bailarino / Coreógrafo',       'bailarino',                1, 'Arte, Música, Entretenimento', 1, 17),
('Gestor de Eventos',            'gestor-eventos',           1, 'Arte, Música, Entretenimento', 1, 18),
('Game Designer',                'game-designer',            1, 'Arte, Música, Entretenimento', 1, 19);
GO

-- ── Ciências, Investigação ────────────────────────────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Investigador Científico',      'investigador-cientifico',  1, 'Ciências, Investigação',       1, 10),
('Biólogo',                      'biologo',                  1, 'Ciências, Investigação',       1, 11),
('Químico',                      'quimico',                  1, 'Ciências, Investigação',       1, 12),
('Físico',                       'fisico',                   1, 'Ciências, Investigação',       1, 13),
('Geólogo',                      'geologo',                  1, 'Ciências, Investigação',       1, 14),
('Ambientalista',                'ambientalista',            1, 'Ciências, Investigação',       1, 15),
('Engenheiro Ambiental',         'engenheiro-ambiental',     1, 'Ciências, Investigação',       1, 16),
('Meteorologista',               'meteorologista',           1, 'Ciências, Investigação',       1, 17),
('Astrónomo',                    'astronomo',                1, 'Ciências, Investigação',       1, 18),
('Técnico de Laboratório',       'tecnico-laboratorio',      1, 'Ciências, Investigação',       1, 19);
GO

-- ── Agricultura, Ambiente ─────────────────────────────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Engenheiro Agrónomo',          'engenheiro-agronomo',      1, 'Agricultura, Ambiente',        1, 10),
('Técnico Agrícola',             'tecnico-agricola',         0, 'Agricultura, Ambiente',        1, 11),
('Veterinário',                  'veterinario',              1, 'Agricultura, Ambiente',        1, 12),
('Gestor de Propriedade Rural',  'gestor-propriedade-rural', 1, 'Agricultura, Ambiente',        1, 13),
('Técnico de Silvicultura',      'tecnico-silvicultura',     1, 'Agricultura, Ambiente',        1, 14),
('Engenheiro de Recursos Hídricos','engenheiro-hidrico',     1, 'Agricultura, Ambiente',        1, 15),
('Técnico de Pesca',             'tecnico-pesca',            0, 'Agricultura, Ambiente',        1, 16),
('Consultor de Sustentabilidade','consultor-sustentabilidade',1,'Agricultura, Ambiente',        1, 17),
('Zootecnista',                  'zootecnista',              1, 'Agricultura, Ambiente',        1, 18),
('Técnico de Qualidade Alimentar','tecnico-qualidade-alimentar',1,'Agricultura, Ambiente',      1, 19);
GO

-- ── Forças de Segurança, Militar ─────────────────────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Oficial das Forças Armadas',   'oficial-forcas-armadas',   1, 'Forças de Segurança, Militar', 1, 10),
('Agente da PSP',                'agente-psp',               0, 'Forças de Segurança, Militar', 1, 11),
('Inspector da PJ',              'inspector-pj',             1, 'Forças de Segurança, Militar', 1, 12),
('Bombeiro',                     'bombeiro',                 0, 'Forças de Segurança, Militar', 1, 13),
('Oficial de GNR',               'oficial-gnr',              1, 'Forças de Segurança, Militar', 1, 14),
('Técnico de Emergência Médica', 'tecnico-emergencia-medica',1, 'Forças de Segurança, Militar', 1, 15),
('Protecção Civil',              'protecao-civil',           1, 'Forças de Segurança, Militar', 1, 16),
('Analista de Inteligência',     'analista-inteligencia',    1, 'Forças de Segurança, Militar', 1, 17),
('Oficial de Prisões',           'oficial-prisoes',          1, 'Forças de Segurança, Militar', 1, 18),
('Oficial de Alfândega',         'oficial-alfandega',        1, 'Forças de Segurança, Militar', 1, 19);
GO

-- ── Social, Serviços Comunitários ────────────────────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Assistente Social',            'assistente-social',        0, 'Social, Serviços Comunitários',1, 10),
('Psicólogo Clínico',            'psicologo-clinico',        1, 'Social, Serviços Comunitários',1, 11),
('Educador Social',              'educador-social',          1, 'Social, Serviços Comunitários',1, 12),
('Técnico de Reinserção Social', 'tecnico-reinsercao',       1, 'Social, Serviços Comunitários',1, 13),
('Gestor de ONG',                'gestor-ong',               1, 'Social, Serviços Comunitários',1, 14),
('Voluntário Coordenador',       'voluntario-coordenador',   0, 'Social, Serviços Comunitários',1, 15),
('Mediador Cultural',            'mediador-cultural',        1, 'Social, Serviços Comunitários',1, 16),
('Terapeuta Familiar',           'terapeuta-familiar',       1, 'Social, Serviços Comunitários',1, 17),
('Técnico de Apoio à Infância',  'tecnico-apoio-infancia',   0, 'Social, Serviços Comunitários',1, 18),
('Coordenador de Lar de Idosos', 'coordenador-lar-idosos',   1, 'Social, Serviços Comunitários',1, 19);
GO

-- ── Financeiro / Contabilidade (mais específicos) ────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Consultor Financeiro',         'consultor-financeiro',     1, 'Bancário, Finanças, Contabilidade', 1, 20),
('Analista de Investimentos',    'analista-investimentos',   1, 'Bancário, Finanças, Contabilidade', 1, 21),
('Gestor de Fundos',             'gestor-fundos',            1, 'Bancário, Finanças, Contabilidade', 1, 22),
('Controller Financeiro',        'controller-financeiro',    1, 'Bancário, Finanças, Contabilidade', 1, 23),
('Especialista em Seguros',      'especialista-seguros',     1, 'Bancário, Finanças, Contabilidade', 1, 24),
('Técnico de Seguros',           'tecnico-seguros',          1, 'Bancário, Finanças, Contabilidade', 1, 25),
('Agente Imobiliário',           'agente-imobiliario',       1, 'Bancário, Finanças, Contabilidade', 1, 26),
('Analista de Crédito',          'analista-credito',         1, 'Bancário, Finanças, Contabilidade', 1, 27),
('Economista',                   'economista',               1, 'Bancário, Finanças, Contabilidade', 1, 28),
('Técnico de Fiscalidade',       'tecnico-fiscalidade',      1, 'Bancário, Finanças, Contabilidade', 1, 29);
GO

-- ── Saúde (mais específicos) ──────────────────────────────────
INSERT INTO Templates (Name, Slug, IsPremium, Category, Active, SortOrder) VALUES
('Cirurgião',                    'cirurgiao',                1, 'Médico, Enfermeiro, Saúde',    1, 20),
('Pediatra',                     'pediatra',                 1, 'Médico, Enfermeiro, Saúde',    1, 21),
('Cardiologista',                'cardiologista',            1, 'Médico, Enfermeiro, Saúde',    1, 22),
('Psiquiatra',                   'psiquiatra',               1, 'Médico, Enfermeiro, Saúde',    1, 23),
('Técnico de Radiologia',        'tecnico-radiologia',       1, 'Médico, Enfermeiro, Saúde',    1, 24),
('Auxiliar de Acção Médica',     'auxiliar-acao-medica',     0, 'Médico, Enfermeiro, Saúde',    1, 25),
('Técnico de Análises Clínicas', 'tecnico-analises-clinicas',1, 'Médico, Enfermeiro, Saúde',    1, 26),
('Óptico',                       'optico',                   1, 'Médico, Enfermeiro, Saúde',    1, 27),
('Técnico de Ortopedia',         'tecnico-ortopedia',        1, 'Médico, Enfermeiro, Saúde',    1, 28),
('Logopedista',                  'logopedista',              1, 'Médico, Enfermeiro, Saúde',    1, 29);
GO

SELECT COUNT(*) AS TotalTemplates FROM Templates WHERE Active = 1;
GO
