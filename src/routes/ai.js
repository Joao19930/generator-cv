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
    const cargoMatch = prompt.match(/cargo[:\s]+([^\n]+)/i);
    const cargo = cargoMatch ? cargoMatch[1].trim() : 'Profissional';
    return `${cargo} com sólida experiência na área, orientado(a) para resultados e com capacidade de trabalhar em ambientes exigentes. Destaco-me pela proactividade, rigor técnico e compromisso com a qualidade do trabalho entregue.`;
  }

  // Caso 2: melhorar bullet de experiência
  if (p.includes('melhora este') || p.includes('bullet') || p.includes('verbo de acção')) {
    const textMatch = prompt.match(/texto[:\s]+([^\n]+)/i) || prompt.match(/"([^"]+)"/);
    if (textMatch) {
      const t = textMatch[1].trim();
      return `Implementei e optimizei ${t.charAt(0).toLowerCase() + t.slice(1)}, contribuindo directamente para a melhoria dos resultados da organização.`;
    }
    return null;
  }

  // Caso 3: sugerir competências
  if (p.includes('competências') || p.includes('lista') || p.includes('skills')) {
    const cargoMatch = prompt.match(/profissional de ([^\n,]+)/i);
    const cargo = cargoMatch ? cargoMatch[1].trim().toLowerCase() : '';
    if (/inform|software|programa|ti\b|it\b/.test(cargo))
      return 'JavaScript, Python, SQL, Git, React, Node.js, Docker, APIs REST';
    if (/market|comunica|digital/.test(cargo))
      return 'Google Analytics, SEO, Redes Sociais, Copywriting, Canva, Email Marketing';
    if (/gestão|director|manager|lider/.test(cargo))
      return 'Liderança de Equipas, Gestão de Projectos, KPIs, Orçamentação, Excel Avançado';
    if (/contabil|financ|audit/.test(cargo))
      return 'Excel Avançado, SAP, Reconciliação Bancária, Relatórios Financeiros, IRT, INSS';
    return 'Microsoft Office, Comunicação Escrita, Trabalho em Equipa, Gestão do Tempo, Resolução de Problemas';
  }

  return null;
}

module.exports = router;
