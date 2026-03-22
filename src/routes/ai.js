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
    const cargoMatch = prompt.match(/Cargo[:\s]+([^,.\n]+)/i);
    const cargo = cargoMatch ? cargoMatch[1].trim() : 'Profissional';
    const anosMatch = prompt.match(/Anos de experiência[:\s]+(\d+)/i);
    const anos = anosMatch ? parseInt(anosMatch[1]) : 0;
    const skillsMatch = prompt.match(/Competências[:\s]+([^\n]+)/i);
    const skills = skillsMatch ? skillsMatch[1].trim() : '';
    const expMatch = prompt.match(/Experiências[:\s]+([^\n]+)/i);
    const expRaw = expMatch ? expMatch[1].trim() : '';

    const anosStr = anos > 0 ? `${anos} anos de experiência` : 'vasta experiência';
    const c = cargo.toLowerCase();

    const empresaMatch = expRaw.match(/na ([^;(]+)/i);
    const empresa = empresaMatch ? empresaMatch[1].trim() : '';
    const ctxEmpresa = empresa && empresa !== 'não especificado' ? ` em organizações como ${empresa}` : ' no mercado angolano';

    const skillArr = skills.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const skillsFrase = skillArr.length >= 2
      ? `Domina ${skillArr.join(', ')}`
      : 'Possui competências técnicas sólidas na área';

    if (/rh|recursos humanos|people|talento/.test(c)) {
      return `Gestor(a) de Recursos Humanos com ${anosStr}${ctxEmpresa}, especializado(a) em recrutamento, avaliação de desempenho e relações laborais. ${skillsFrase}, com profundo conhecimento da legislação laboral angolana. Liderou processos que reduziram o turnover em 20% e melhoraram o clima organizacional. Procura contribuir para organizações que valorizam o capital humano como vantagem competitiva.`;
    }
    if (/comercial|vendas|sales|negócios|negoc/.test(c)) {
      return `${cargo} com ${anosStr}${ctxEmpresa}, especializado(a) em desenvolvimento de negócio e fidelização de clientes B2B e B2C. ${skillsFrase}, com historial de superação de metas — aumentou o volume de vendas em 30% no último ano fiscal. Referência em negociação de contratos e identificação de oportunidades no mercado angolano. Tem como objectivo integrar uma equipa comercial de referência e continuar a gerar impacto mensurável.`;
    }
    if (/financ|contab|audit|tesour/.test(c)) {
      return `${cargo} com ${anosStr}${ctxEmpresa}, especializado(a) em contabilidade geral, reporte financeiro e conformidade fiscal. ${skillsFrase}, com sólido conhecimento das obrigações perante a AGT e INSS. Implementou controlos que reduziram erros de reconciliação em 35% e melhoraram a fiabilidade dos relatórios mensais. Procura contribuir para a solidez financeira de organizações em crescimento em Angola.`;
    }
    if (/inform|ti\b|software|programa|system|develop|dados/.test(c)) {
      return `${cargo} com ${anosStr}${ctxEmpresa}, especializado(a) em desenvolvimento de sistemas e transformação digital. ${skillsFrase}, com experiência em gestão de projectos tecnológicos e arquitectura de soluções. Entregou sistemas que melhoraram a performance operacional em 40% e reduziram custos de manutenção. Pretende aplicar competências técnicas em organizações angolanas em processo de modernização.`;
    }
    if (/gest|direct|manager|lider|coord/.test(c)) {
      return `${cargo} com ${anosStr}${ctxEmpresa}, com experiência comprovada em liderança de equipas e gestão por objectivos. ${skillsFrase}, com foco em optimização de processos e desenvolvimento de talento interno. Conduziu iniciativas que reduziram custos operacionais em 20% mantendo elevados padrões de qualidade. Pretende liderar projectos de crescimento em organizações com visão estratégica em Angola.`;
    }
    if (/market|comunic|digital|publicid/.test(c)) {
      return `${cargo} com ${anosStr}${ctxEmpresa}, especializado(a) em marketing digital, gestão de marca e comunicação estratégica. ${skillsFrase}, com campanhas que aumentaram o reconhecimento de marca em 50% e geraram leads qualificados. Combina criatividade com análise de dados para maximizar o ROI das acções de marketing. Procura aplicar esta visão em marcas angolanas com ambição de crescimento acelerado.`;
    }
    return `${cargo} com ${anosStr}${ctxEmpresa}, com historial comprovado na entrega de resultados em ambientes exigentes. ${skillsFrase}, sendo reconhecido(a) pela capacidade analítica e resolução eficaz de problemas. Contribuiu para a melhoria de processos que aumentaram a produtividade das equipas em mais de 25%. Procura um desafio profissional onde possa aplicar a sua experiência e gerar impacto real em Angola.`;
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
