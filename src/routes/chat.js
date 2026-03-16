// src/routes/chat.js
// ─────────────────────────────────────────────────────────────
// Chatbot IA — CV Generator Pro
// POST /api/chat  → público (sem JWT)
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();

// Cache em memória (5 minutos) para não ir à BD em cada mensagem
let _knowledgeCache    = null;
let _knowledgeCacheTs  = 0;

async function getKnowledge(db) {
  const now = Date.now();
  if (_knowledgeCache && now - _knowledgeCacheTs < 5 * 60 * 1000) return _knowledgeCache;
  try {
    const r = await db.request().query(
      `SELECT section_key, section_title, content FROM chat_knowledge WHERE is_active = 1 ORDER BY id`
    );
    _knowledgeCache   = r.recordset;
    _knowledgeCacheTs = now;
  } catch {
    _knowledgeCache = [];
  }
  return _knowledgeCache;
}

function buildSystemPrompt(sections) {
  let prompt =
    `És o assistente virtual do CV Generator Pro — plataforma angolana de criação de CVs profissionais.\n` +
    `Responde sempre em português (PT/AO). Sê conciso, amigável e prático.\n` +
    `Especializa-te em criação de CVs, otimização ATS e dicas de emprego para Angola e PALOP.\n` +
    `Quando o utilizador precisar de ajuda técnica específica da plataforma, encaminha-o para o suporte.\n` +
    `Não inventes informações que não estejam na tua base de conhecimento.\n\n`;

  if (sections.length > 0) {
    prompt += `=== BASE DE CONHECIMENTO ===\n\n`;
    for (const s of sections) {
      prompt += `## ${s.section_title}\n${s.content}\n\n`;
    }
  }
  return prompt;
}

// ── POST /api/chat ───────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: 'messages obrigatório' });

    // Limitar histórico a 10 mensagens e truncar conteúdo
    const history = messages.slice(-10).map(m => ({
      role   : m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 2000)
    }));

    const sections    = await getKnowledge(req.db);
    const systemPrompt = buildSystemPrompt(sections);

    const Anthropic = require('@anthropic-ai/sdk');
    const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const r = await client.messages.create({
      model     : 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system    : systemPrompt,
      messages  : history
    });

    res.json({ reply: r.content[0].text });
  } catch (e) {
    console.error('🔴 Chat error:', e.message);
    res.status(500).json({ error: 'Não foi possível processar a mensagem. Tente novamente.' });
  }
});

// Invalidar cache após edição de conhecimento
function invalidateKnowledgeCache() {
  _knowledgeCache   = null;
  _knowledgeCacheTs = 0;
}

module.exports = { router, invalidateKnowledgeCache };
