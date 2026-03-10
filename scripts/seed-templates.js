const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://cv_generator_db_ewox_user:htNyxZjlpLWv1XGIfjVUPMP89uXxvuvS@dpg-d6nlil9aae7s738g4g40-a.frankfurt-postgres.render.com/cv_generator_db_ewox',
  ssl: { rejectUnauthorized: false }
});

const estilos = ['Moderno', 'Minimalista', 'Profissional', 'Elegante', 'Clássico', 'Executivo', 'Criativo', 'Compacto', 'Bold', 'Clean'];

const categorias = [
  { cat: 'engenharia',      label: 'Engenharia',             profs: ['Engenheiro Civil', 'Engenheiro Informático', 'Engenheiro Mecânico', 'Engenheiro Electrotécnico', 'Engenheiro Químico', 'Engenheiro de Software', 'Engenheiro de Redes', 'Engenheiro Ambiental', 'Engenheiro Industrial', 'Engenheiro Aeronáutico'] },
  { cat: 'tecnologia',      label: 'Tecnologia & TI',        profs: ['Programador', 'Desenvolvedor Full Stack', 'Analista de Sistemas', 'DevOps', 'Cibersegurança', 'Data Scientist', 'UX Designer', 'UI Designer', 'Arquitecto de Software', 'Gestor de Projectos TI'] },
  { cat: 'educacao',        label: 'Educação',               profs: ['Professor Primário', 'Professor Secundário', 'Professor Universitário', 'Educador de Infância', 'Formador', 'Psicólogo Escolar', 'Director Pedagógico', 'Investigador Académico', 'Tutor', 'Coordenador Educativo'] },
  { cat: 'saude',           label: 'Saúde',                  profs: ['Médico Geral', 'Médico Especialista', 'Enfermeiro', 'Farmacêutico', 'Fisioterapeuta', 'Psicólogo Clínico', 'Nutricionista', 'Dentista', 'Técnico de Radiologia', 'Gestor Hospitalar'] },
  { cat: 'direito',         label: 'Direito & Jurídico',     profs: ['Advogado', 'Juiz', 'Notário', 'Consultor Jurídico', 'Magistrado', 'Advogado Corporativo', 'Defensor Público', 'Procurador', 'Paralegal', 'Gestor de Compliance'] },
  { cat: 'financas',        label: 'Finanças & Contabilidade', profs: ['Contabilista', 'Auditor', 'Analista Financeiro', 'Gestor de Investimentos', 'Controller', 'CFO', 'Actuário', 'Consultor Fiscal', 'Gestor de Risco', 'Analista de Crédito'] },
  { cat: 'gestao',          label: 'Gestão & Negócios',      profs: ['Gestor de Projectos', 'Director Executivo', 'CEO', 'Consultor de Gestão', 'Empreendedor', 'Gestor Operacional', 'Director Comercial', 'Gestor de Produto', 'COO', 'Business Analyst'] },
  { cat: 'marketing',       label: 'Marketing & Comunicação', profs: ['Gestor de Marketing', 'Social Media Manager', 'Copywriter', 'Jornalista', 'Relações Públicas', 'Designer Gráfico', 'Gestor de Conteúdo', 'SEO Specialist', 'Gestor de Marca', 'Produtor de Vídeo'] },
  { cat: 'vendas',          label: 'Vendas & Comercial',     profs: ['Representante de Vendas', 'Gestor de Vendas', 'Account Manager', 'Key Account', 'Director de Vendas', 'Consultor Comercial', 'Gestor de Loja', 'Vendedor Técnico', 'Inside Sales', 'Business Developer'] },
  { cat: 'arquitectura',    label: 'Arquitectura & Design',  profs: ['Arquitecto', 'Designer de Interiores', 'Urbanista', 'Paisagista', 'Designer Industrial', 'Designer de Moda', 'Fotógrafo', 'Ilustrador', 'Gestor de Arte', 'Director Criativo'] },
  { cat: 'rh',              label: 'Recursos Humanos',       profs: ['Gestor de RH', 'Recruiter', 'Formador Corporativo', 'Director de RH', 'Analista de RH', 'Gestor de Talento', 'Responsável de Cultura', 'Especialista em Compensações', 'Coach Executivo', 'Gestor de Benefícios'] },
  { cat: 'construcao',      label: 'Construção & Obras',     profs: ['Engenheiro de Obra', 'Gestor de Construção', 'Técnico de Topografia', 'Supervisor de Obras', 'Gestor de Contratos', 'Orçamentista', 'Técnico de Segurança', 'Director de Obra', 'Projectista', 'Fiscalizador'] },
  { cat: 'logistica',       label: 'Logística & Supply Chain', profs: ['Gestor de Logística', 'Responsável de Armazém', 'Gestor de Compras', 'Supply Chain Manager', 'Gestor de Transportes', 'Analista de Operações', 'Gestor de Stock', 'Coordenador de Expedição', 'Gestor de Procurement', 'Director de Operações'] },
  { cat: 'administrativo',  label: 'Administrativo & Secretariado', profs: ['Assistente Administrativo', 'Secretário Executivo', 'Recepcionista', 'Assistente de Direcção', 'Gestor de Escritório', 'Operador de Dados', 'Arquivista', 'Assistente Jurídico', 'Coordenador Administrativo', 'Técnico Administrativo'] },
  { cat: 'ciencias',        label: 'Ciências & Investigação', profs: ['Biólogo', 'Químico', 'Físico', 'Geólogo', 'Investigador', 'Analista de Laboratório', 'Biotecnólogo', 'Astrónomo', 'Oceanógrafo', 'Técnico de Laboratório'] },
  { cat: 'social',          label: 'Ciências Sociais & ONG', profs: ['Assistente Social', 'Psicólogo', 'Sociólogo', 'Gestor de ONG', 'Coordenador de Voluntariado', 'Animador Social', 'Mediador Cultural', 'Gestor de Projectos Sociais', 'Consultor de Desenvolvimento', 'Especialista em Políticas Públicas'] },
  { cat: 'turismo',         label: 'Turismo & Hotelaria',    profs: ['Gestor de Hotel', 'Director de F&B', 'Guia Turístico', 'Agente de Viagens', 'Recepcionista de Hotel', 'Chef de Cozinha', 'Gestor de Eventos', 'Revenue Manager', 'Concierge', 'Director Comercial Hoteleiro'] },
  { cat: 'energia',         label: 'Energia & Ambiente',     profs: ['Engenheiro de Energias Renováveis', 'Gestor Ambiental', 'Especialista em Solar', 'Técnico de Eficiência Energética', 'Gestor de Sustentabilidade', 'Engenheiro de Petróleo', 'Especialista em Eólica', 'Auditor Ambiental', 'Gestor de Resíduos', 'Consultor de Energia'] },
  { cat: 'recemgraduado',   label: 'Recém-Graduado',         profs: ['Recém-Licenciado', 'Estágio Curricular', 'Primeiro Emprego', 'Trainee', 'Junior Developer', 'Assistente de Investigação', 'Bolseiro', 'Voluntário Internacional', 'Jovem Empreendedor', 'Graduate Program'] },
  { cat: 'executivo',       label: 'Executivo & C-Level',    profs: ['CEO', 'CFO', 'CTO', 'COO', 'CMO', 'CHRO', 'Director Geral', 'Presidente', 'Vice-Presidente', 'Managing Director'] },
];

async function seed() {
  let total = 0;
  let order = 10;

  for (const { cat, profs } of categorias) {
    for (let i = 0; i < profs.length; i++) {
      const estilo = estilos[i % estilos.length];
      const name = `${profs[i]} — ${estilo}`;
      const slug = `${cat}-${profs[i].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${estilo.toLowerCase()}`;
      const isPremium = i >= 5; // primeiros 5 de cada categoria são gratuitos
      order++;

      await pool.query(
        `INSERT INTO templates (name, slug, is_premium, category, active, sort_order)
         VALUES ($1, $2, $3, $4, TRUE, $5)
         ON CONFLICT (slug) DO NOTHING`,
        [name, slug, isPremium, cat, order]
      );
      total++;
    }
  }

  console.log(`Inseridos ${total} templates.`);
  pool.end();
}

seed().catch(e => { console.error(e.message); pool.end(); });
