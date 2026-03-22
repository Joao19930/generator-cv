const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

let _client;
const getClient = () => {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
};

// POST /api/ai/stream — streaming proxy para Anthropic
router.post('/stream', async (req, res) => {
  const { messages, system } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const stream = await getClient().messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: system || '',
      messages: messages.slice(-10),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ delta: { text: event.delta.text } })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// POST /api/ai — chamada simples (não-streaming) para o editor React
router.post('/', async (req, res) => {
  const { prompt, max_tokens = 800 } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    const msg = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content?.[0]?.text || '';
    res.json({ text });
  } catch (err) {
    // Fallback local quando não há créditos
    const text = localFallback(prompt);
    if (text) return res.json({ text });
    res.status(503).json({ error: 'Serviço IA indisponível. Adiciona créditos em console.anthropic.com.' });
  }
});

// Fallback local para quando não há créditos Anthropic
function localFallback(prompt) {
  const p = prompt.toLowerCase();

  // Caso 1: gerar resumo profissional
  if (p.includes('resumo profissional') || p.includes('escreve um resumo')) {
    // Parar no primeiro delimitador (vírgula, ponto, newline) para não capturar instruções
    const cargoMatch = prompt.match(/cargo[:\s]+([^,.\n]+)/i);
    const cargo = cargoMatch ? cargoMatch[1].trim() : 'Profissional';
    return `${cargo} com sólida experiência na área, orientado(a) para resultados e com capacidade de trabalhar em ambientes dinâmicos e exigentes. Ao longo da carreira, desenvolvi competências técnicas e relacionais que me permitem contribuir de forma consistente para os objectivos das organizações. Destaco-me pela proactividade, rigor técnico e compromisso com a qualidade do trabalho entregue. Procuro continuamente evoluir e acrescentar valor em cada projecto em que me envolvo.`;
  }

  // Caso 2: melhorar bullet isolado (prompt curto, contém "melhora este" ou "verbo de acção")
  if (p.includes('melhora este') || p.includes('verbo de ac')) {
    const textMatch = prompt.match(/texto[:\s]+([^\n]+)/i) || prompt.match(/"([^"]+)"/);
    if (textMatch) {
      const t = textMatch[1].trim();
      return `Implementei e optimizei ${t.charAt(0).toLowerCase() + t.slice(1)}, contribuindo directamente para a melhoria dos resultados da organização.`;
    }
  }

  // Caso 3: sugerir competências
  if (p.includes('compet') || p.includes('lista') || p.includes('skills')) {
    const cargoMatch = prompt.match(/profissional de ([^\n,]+)/i);
    const cargo = cargoMatch ? cargoMatch[1].trim().toLowerCase() : '';
    if (/inform|software|programa|ti\b|it\b/.test(cargo))
      return 'JavaScript, Python, SQL, Git, React, Node.js, Docker, APIs REST';
    if (/market|comunica|digital/.test(cargo))
      return 'Google Analytics, SEO, Redes Sociais, Copywriting, Canva, Email Marketing';
    if (/gest|director|manager|lider/.test(cargo))
      return 'Liderança de Equipas, Gestão de Projectos, KPIs, Orçamentação, Excel Avançado';
    if (/contabil|financ|audit/.test(cargo))
      return 'Excel Avançado, SAP, Reconciliação Bancária, Relatórios Financeiros, IRT, INSS';
    return 'Microsoft Office, Comunicação Escrita, Trabalho em Equipa, Gestão do Tempo, Resolução de Problemas';
  }

  // Caso 4: descrição de experiência (ExperienceSection do editor React)
  // Detectar pelo par Cargo+Empresa que é exclusivo deste prompt
  if (p.includes('cargo:') && p.includes('empresa:')) {
    const cargoMatch = prompt.match(/Cargo[:\s]+([^\n]+)/i);
    const empresaMatch = prompt.match(/Empresa[:\s]+([^\n]+)/i);
    const cargo = cargoMatch ? cargoMatch[1].trim() : 'Profissional';
    const empresa = empresaMatch ? empresaMatch[1].trim() : '';
    const temEmpresa = empresa && empresa !== 'não especificada';
    const ctx = temEmpresa ? ` na ${empresa}` : '';
    const c = cargo.toLowerCase();

    if (/rh|recursos humanos|people|talento/.test(c)) {
      return `Liderou processos de recrutamento e selecção de quadros${ctx}, reduzindo o tempo de contratação\nImplementou políticas de avaliação de desempenho e planos de desenvolvimento individual\nGeriu relações laborais e assegurou conformidade com a legislação angolana do trabalho\nCoordená formações internas e programas de integração para novos colaboradores`;
    }
    if (/comercial|vendas|sales|negócios|negoc/.test(c)) {
      return `Geriu carteira de clientes${ctx}, superando as metas comerciais em 30% no último ano\nNegociou contratos e parcerias estratégicas com empresas e instituições em Luanda\nIdentificou oportunidades de mercado e desenvolveu propostas comerciais competitivas\nElaborou relatórios de desempenho comercial e apresentou resultados à direcção`;
    }
    if (/financ|contab|audit|tesour/.test(c)) {
      return `Supervisionou a contabilidade geral e preparação de demonstrações financeiras${ctx}\nGarantiu conformidade fiscal e cumprimento das obrigações com AGT e INSS\nElaborou orçamentos, previsões de cash-flow e análises de desvios mensais\nCoordená auditorias internas e implementou melhorias nos controlos financeiros`;
    }
    if (/inform|ti\b|software|programa|system|develop|dados/.test(c)) {
      return `Desenvolveu e manteve sistemas e aplicações${ctx} utilizando tecnologias modernas\nImplementou melhorias que reduziram falhas e aumentaram a performance em 40%\nColaborou com equipas multidisciplinares em projectos de transformação digital\nDocumentou processos e assegurou a segurança e integridade dos dados`;
    }
    if (/gest|direct|manager|lider|coord/.test(c)) {
      return `Liderou equipa de colaboradores${ctx}, promovendo cultura de responsabilidade e resultados\nDefiniu objectivos estratégicos e acompanhou indicadores de desempenho mensais\nOptimizou processos operacionais, reduzindo custos em 20% sem comprometer a qualidade\nReportou à administração e propôs planos de melhoria contínua`;
    }
    if (/market|comunic|digital|publicid/.test(c)) {
      return `Planeou e executou campanhas de marketing digital e tradicional${ctx}\nGestionou redes sociais e conteúdos, aumentando o alcance em 50% em 6 meses\nAnalisou métricas de desempenho e ajustou estratégias para maximizar o ROI\nCoordená produção de materiais de comunicação e identidade de marca`;
    }
    return `Desempenhou as funções de ${cargo}${ctx} com elevado sentido de responsabilidade e orientação para resultados\nOptimizou processos internos, contribuindo para a melhoria da eficiência operacional\nColaborou activamente com as diferentes áreas, assegurando o cumprimento de prazos e objectivos\nElaborou relatórios de actividade e propôs melhorias implementadas com sucesso`;
  }

  // Fallback genérico — nunca retornar null para prompts longos
  if (p.length > 100) {
    return 'Profissional com sólida experiência na área, orientado(a) para resultados e com capacidade de adaptação a diferentes contextos organizacionais. Destaca-se pelo rigor técnico, proactividade e compromisso com a entrega de valor.';
  }

  return null;
}

module.exports = router;
