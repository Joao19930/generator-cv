// src/routes/chat.js
// ─────────────────────────────────────────────────────────────
// Chatbot IA — CV Premium
// POST /api/chat  → público (sem JWT)
// Fallback local quando a API Anthropic não está disponível
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
      `SELECT section_key, section_title, content FROM chat_knowledge WHERE is_active = TRUE ORDER BY id`
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
    `És o assistente virtual do CV Premium — plataforma angolana de criação de CVs profissionais.\n` +
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

// ── FALLBACK LOCAL ────────────────────────────────────────────
// Regras de resposta sem necessidade de API
const FALLBACK_RULES = [
  // Saudações
  { rx: /^(olá|ola|bom dia|boa tarde|boa noite|oi\b|hello|hey)/i,
    r: `Olá! 👋 Sou o assistente do **CV Premium**. Estou aqui para te ajudar a criar um CV profissional e encontrar emprego em Angola.\n\nPodes perguntar-me sobre:\n• Como criar ou editar o teu CV\n• Templates disponíveis\n• Score ATS e como melhorá-lo\n• Dicas para o mercado de trabalho angolano\n• Importação do LinkedIn\n\nNo que posso ajudar?` },

  // Criar CV
  { rx: /criar.*(cv|currículo)|novo.*(cv|currículo)|(cv|currículo).*(criar|novo|começ)/i,
    r: `Para criar um CV no **CV Premium**, segue estes passos:\n\n1. Clica em **"+ Novo CV"** no painel principal\n2. Serás levado directamente ao editor\n3. Preenche os teus dados: informações pessoais, experiência, formação e competências\n4. O CV é guardado automaticamente à medida que escreves\n5. Descarrega em PDF quando estiveres satisfeito\n\n💡 Dica: usa os botões **✨ Gerar com IA** para gerar automaticamente o teu resumo profissional e responsabilidades de cada função.` },

  // Templates
  { rx: /template|modelo|design|estilo|aparência/i,
    r: `Temos mais de **200 templates profissionais** organizados em 4 categorias:\n\n• **Com Foto** — destaca a tua imagem profissional\n• **Sem Foto** — foco total no conteúdo\n• **ATS** — optimizados para sistemas de triagem automática\n• **Executivo** — para cargos de liderança e direcção\n\nPodes mudar de template a qualquer momento sem perder os teus dados. Acede em **Painel → Templates**.` },

  // ATS / Score ATS
  { rx: /ats|score|pontuação|keywords|palavras.chave|triagem/i,
    r: `O **Score ATS** mede a compatibilidade do teu CV com sistemas automáticos de triagem usados pelas empresas.\n\n**Como funciona:**\n1. Vai a **Painel → Score ATS**\n2. Cola o texto do teu CV\n3. Cola a descrição da vaga a que te candidatas\n4. Clica em ⚡ Analisar\n\n**Para melhorar o score:**\n• Usa exactamente as palavras-chave da vaga\n• Evita tabelas e colunas (dificultam a leitura por robots)\n• Escolhe um template ATS na plataforma\n• Quantifica os teus resultados (ex: "aumentei vendas em 30%")` },

  // PDF / Download
  { rx: /pdf|download|descarregar|baixar|imprimir/i,
    r: `Para descarregar o teu CV em **PDF**:\n\n1. Abre o CV no editor\n2. Clica no botão **"Descarregar PDF"** no topo\n3. O PDF é gerado em alta qualidade, pronto a enviar\n\n💡 O PDF é optimizado para impressão A4 e para envio por email.` },

  // LinkedIn Import
  { rx: /linkedin|importar.*perfil|perfil.*linkedin/i,
    r: `Podes importar o teu perfil do **LinkedIn** para criar um CV automaticamente:\n\n1. Vai a **Menu → LinkedIn Import**\n2. Entra com a tua conta LinkedIn\n3. Cola o texto do teu perfil LinkedIn na caixa\n4. Clica em **✨ Analisar com IA**\n5. A IA extrai automaticamente as tuas experiências, formação e competências\n6. Revê os dados e escolhe um template\n\nÉ a forma mais rápida de criar um CV completo!` },

  // Preço / Planos / Gratuito
  { rx: /preço|plano|gratuito|free|pagar|custo|premium|pro\b|quanto custa/i,
    r: `O **CV Premium** tem um plano gratuito generoso:\n\n**Gratuito (sem custo):**\n• Criar até **3 CVs**\n• Acesso a templates gratuitos\n• Download em PDF\n• Score ATS\n• Assistente IA\n\nPara acesso ilimitado a todos os templates premium e funcionalidades avançadas, consulta a secção **Planos** no painel.\n\n💡 Começa gratuitamente — não precisas de cartão de crédito!` },

  // Resumo profissional / Sumário
  { rx: /resumo|sumário|sobre mim|perfil profissional|summary/i,
    r: `O **Resumo Profissional** é uma das secções mais importantes do CV. Dicas para um bom resumo:\n\n✅ **Começa com anos de experiência e especialização**\nEx: "Gestor Comercial com 8 anos de experiência no sector bancário angolano..."\n\n✅ **Inclui 2-3 competências técnicas chave**\n\n✅ **Menciona um resultado concreto** (número, percentagem, conquista)\n\n✅ **Termina com o teu objectivo profissional**\n\n❌ Evita frases genéricas como "sou uma pessoa dedicada e trabalhadora"\n\nUsa o botão **✨ Gerar com IA** no editor para gerar um resumo automaticamente com base nos teus dados!` },

  // Experiência / Responsabilidades
  { rx: /experiência|função|responsabilidade|cargo|trabalho|emprego/i,
    r: `Para descrever bem a tua **Experiência Profissional** no CV:\n\n✅ **Usa verbos de acção no início de cada ponto**\nEx: Geriu, Desenvolveu, Implementou, Aumentou, Reduziu...\n\n✅ **Quantifica os resultados**\nEx: "Aumentou as vendas em 45% em 12 meses"\n\n✅ **Sê específico** — diz o quê, como e com que resultado\n\n✅ **Lista 5-7 responsabilidades por cargo**\n\nNo editor, usa **✨ Sugerir funções** para gerar automaticamente responsabilidades específicas para o teu cargo!` },

  // Formação / Educação
  { rx: /formação|educação|curso|universidade|faculdade|licenciatura|mestrado|certificado/i,
    r: `Na secção de **Formação Académica**, inclui:\n\n• Grau académico (Licenciatura, Mestrado, etc.)\n• Nome da instituição\n• Área de estudo\n• Ano de conclusão\n\n**Certificações e cursos complementares** também contam — adiciona-os na secção específica do editor.\n\n💡 Dica: se tens pouca experiência profissional, destaca mais a formação e projectos académicos.` },

  // Competências / Skills
  { rx: /competência|skill|habilidade|soft skill|hard skill/i,
    r: `Na secção de **Competências**, organiza assim:\n\n**Competências Técnicas (Hard Skills):**\nFerramentas, software, línguas de programação, certificações...\n\n**Competências Transversais (Soft Skills):**\nLiderança, comunicação, trabalho em equipa, gestão de tempo...\n\n💡 Dica: usa exactamente as mesmas palavras que aparecem na descrição da vaga. Isso aumenta o Score ATS e a probabilidade de passares na triagem automática.` },

  // Carta de apresentação
  { rx: /carta.*apresentação|cover letter|candidatura/i,
    r: `O **CV Premium** gera Cartas de Apresentação profissionais com IA!\n\nVai a **Painel → Carta de Apresentação** e escolhe o tipo:\n\n• **Emprego** — para responder a uma vaga específica\n• **Espontânea** — para enviar sem vaga aberta\n• **Promoção Interna** — para subir na mesma empresa\n• **Mudança de Carreira** — para transição de área\n• **LinkedIn** — mensagem directa para recrutadores\n\nA IA personaliza a carta com o teu nome, cargo e empresa em segundos!` },

  // Vagas / Empregos
  { rx: /vaga|emprego|job|oportunidade|oferta.*trabalho|trabalho.*oferta/i,
    r: `Na aba **Vagas de Emprego** do painel encontras oportunidades actualizadas regularmente, incluindo:\n\n• Comercial e Vendas\n• Banca e Seguros\n• Tecnologia\n• Engenharia\n• Saúde\n• Gestão e Administração\n• e muito mais!\n\nPodes filtrar por categoria e pesquisar pelo cargo ou empresa. Novas vagas são adicionadas semanalmente! 🔔` },

  // Suporte / Ajuda / Problema
  { rx: /suporte|ajuda|problema|erro|bug|não funciona|contacto/i,
    r: `Lamento o inconveniente! Para suporte técnico:\n\n📧 **Email:** suporte@cvpremium.net\n📱 **WhatsApp:** disponível no rodapé do site\n\nDescreve o teu problema com o máximo de detalhe possível (o que aconteceu, em que página, e se apareceu alguma mensagem de erro).\n\nResponderemos no prazo de 24 horas em dias úteis.` },

  // Obrigado / Despedida
  { rx: /obrigad|obg|thanks|fixe|ótimo|excelente|perfeito/i,
    r: `De nada! 😊 Fico contente em ter ajudado.\n\nSe precisares de mais alguma coisa — seja para o CV, ATS ou candidatura — estou aqui!\n\nBoa sorte nas tuas candidaturas! 🚀` },
];

function localFallback(userMessage) {
  const msg = userMessage.trim();
  for (const rule of FALLBACK_RULES) {
    if (rule.rx.test(msg)) return rule.r;
  }
  // Resposta genérica
  return `Olá! Sou o assistente do **CV Premium**. De momento estou com capacidade limitada, mas posso ajudar-te com:\n\n• **Criar um CV** — clica em "+ Novo CV" no painel\n• **Score ATS** — analisa a compatibilidade do teu CV com vagas\n• **Templates** — mais de 200 modelos profissionais\n• **Carta de Apresentação** — gerada com IA\n• **Vagas de Emprego** — oportunidades actualizadas\n\nPara suporte directo: suporte@cvpremium.net 📧`;
}

// ── POST /api/chat ───────────────────────────────────────────
router.post('/', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: 'messages obrigatório' });

  const history = messages.slice(-10).map(m => ({
    role   : m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000)
  }));

  const lastUserMsg = history.filter(m => m.role === 'user').pop()?.content || '';

  // Tentar API Anthropic primeiro
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const sections     = await getKnowledge(req.db);
      const systemPrompt = buildSystemPrompt(sections);
      const Anthropic    = require('@anthropic-ai/sdk');
      const client       = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const r = await client.messages.create({
        model     : 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system    : systemPrompt,
        messages  : history
      });

      return res.json({ reply: r.content[0].text });
    } catch (e) {
      // Se for erro de créditos ou quota, usa fallback silenciosamente
      const isBillingError = e.status === 400 || e.status === 429 ||
        (e.message && e.message.toLowerCase().includes('credit'));
      if (!isBillingError) {
        console.error('🔴 Chat API error:', e.message, e.status || '');
      }
      // Cai para o fallback local
    }
  }

  // Fallback local — responde sem API
  const reply = localFallback(lastUserMsg);
  res.json({ reply, _fallback: true });
});

// Invalidar cache após edição de conhecimento
function invalidateKnowledgeCache() {
  _knowledgeCache   = null;
  _knowledgeCacheTs = 0;
}

module.exports = { router, invalidateKnowledgeCache };
