// chat-widget.js — Chatbot flutuante CV Generator Pro
// Injector automático: basta incluir <script src="/chat-widget.js"></script>
(function () {
  'use strict';

  // Evitar inicialização dupla
  if (window.__cvgenChatInit) return;
  window.__cvgenChatInit = true;

  // ── Mensagens de boas-vindas por contexto ─────────────────
  const PAGE_CONTEXT = {
    '/editor' : 'Estás a editar o teu CV. Posso ajudar com o conteúdo, dicas ATS ou sugestões de texto!',
    '/preview': 'O teu CV está quase pronto! Tens dúvidas sobre o formato ou queres dicas finais?',
    '/app'    : 'Olá! Posso ajudar-te a criar ou melhorar o teu CV.',
    '/ats'    : 'Estás a analisar a compatibilidade ATS. Posso explicar como melhorar a pontuação!',
    '/demo'   : 'Estás a explorar os templates. Pergunta-me qual o melhor para a tua área!',
  };

  const welcomeMsg = (function () {
    const p = window.location.pathname;
    for (const key of Object.keys(PAGE_CONTEXT)) {
      if (p.startsWith(key)) return PAGE_CONTEXT[key];
    }
    return 'Olá! 👋 Sou o assistente do CV Generator Pro. Como posso ajudar-te hoje?';
  })();

  const QUICK_ACTIONS = [
    'Como criar um bom CV?',
    'O que é ATS?',
    'Dicas para resumo profissional',
    'Que template devo escolher?',
  ];

  // ── Estilos ───────────────────────────────────────────────
  const STYLES = `
    #cvgen-chat-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9998;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff; border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(99,102,241,.45);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; transition: transform .2s, box-shadow .2s;
    }
    #cvgen-chat-btn:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(99,102,241,.6); }
    #cvgen-chat-btn .badge {
      position: absolute; top: -2px; right: -2px;
      background: #ef4444; color: #fff; font-size: 11px; font-weight: 700;
      min-width: 18px; height: 18px; border-radius: 9px; padding: 0 4px;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #fff;
    }
    #cvgen-chat-panel {
      position: fixed; bottom: 90px; right: 24px; z-index: 9999;
      width: 360px; max-width: calc(100vw - 48px);
      background: #fff; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      display: flex; flex-direction: column; overflow: hidden;
      transform: scale(.92) translateY(16px); opacity: 0;
      pointer-events: none;
      transition: transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s;
    }
    #cvgen-chat-panel.open {
      transform: scale(1) translateY(0); opacity: 1; pointer-events: all;
    }
    #cvgen-chat-header {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff; padding: 14px 16px;
      display: flex; align-items: center; gap: 10px;
    }
    #cvgen-chat-header .avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,.25);
      display: flex; align-items: center; justify-content: center; font-size: 18px;
      flex-shrink: 0;
    }
    #cvgen-chat-header .info { flex: 1; }
    #cvgen-chat-header .info strong { display: block; font-size: 14px; }
    #cvgen-chat-header .info span { font-size: 11px; opacity: .8; }
    #cvgen-chat-close {
      background: none; border: none; color: rgba(255,255,255,.8);
      font-size: 20px; cursor: pointer; padding: 4px; line-height: 1;
    }
    #cvgen-chat-close:hover { color: #fff; }
    #cvgen-chat-messages {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
      max-height: 340px; min-height: 200px;
      scroll-behavior: smooth;
    }
    #cvgen-chat-messages::-webkit-scrollbar { width: 4px; }
    #cvgen-chat-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
    .cvgen-msg {
      max-width: 80%; padding: 9px 12px; border-radius: 12px;
      font-size: 13px; line-height: 1.45; word-break: break-word;
    }
    .cvgen-msg.bot {
      background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 3px; align-self: flex-start;
    }
    .cvgen-msg.user {
      background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
      border-bottom-right-radius: 3px; align-self: flex-end;
    }
    .cvgen-msg.typing { opacity: .65; font-style: italic; }
    .cvgen-quick-actions {
      display: flex; flex-wrap: wrap; gap: 5px; padding: 0 12px 8px;
    }
    .cvgen-quick-actions button {
      background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 20px;
      font-size: 11px; padding: 4px 10px; cursor: pointer; color: #475569;
      transition: background .15s;
    }
    .cvgen-quick-actions button:hover { background: #e2e8f0; }
    #cvgen-chat-form {
      display: flex; gap: 8px; padding: 10px 12px 12px;
      border-top: 1px solid #f1f5f9;
    }
    #cvgen-chat-input {
      flex: 1; border: 1px solid #e2e8f0; border-radius: 20px;
      padding: 8px 14px; font-size: 13px; outline: none;
      transition: border-color .15s; resize: none;
      font-family: inherit; line-height: 1.4;
    }
    #cvgen-chat-input:focus { border-color: #6366f1; }
    #cvgen-chat-send {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff; border: none; border-radius: 50%;
      width: 36px; height: 36px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; align-self: flex-end;
      transition: opacity .15s;
    }
    #cvgen-chat-send:disabled { opacity: .5; cursor: not-allowed; }
    #cvgen-chat-send svg { width: 16px; height: 16px; }
    @media (max-width: 400px) {
      #cvgen-chat-panel { right: 12px; bottom: 80px; }
      #cvgen-chat-btn { right: 12px; bottom: 16px; }
    }
  `;

  // ── Injetar HTML ──────────────────────────────────────────
  function init() {
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'cvgen-chat-btn';
    btn.setAttribute('aria-label', 'Abrir chat de apoio');
    btn.innerHTML = `💬<span class="badge" id="cvgen-badge" style="display:none">1</span>`;

    const panel = document.createElement('div');
    panel.id = 'cvgen-chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat de apoio CV Generator');
    panel.innerHTML = `
      <div id="cvgen-chat-header">
        <div class="avatar">🤖</div>
        <div class="info">
          <strong>Assistente CV Generator</strong>
          <span>● Online — resposta em segundos</span>
        </div>
        <button id="cvgen-chat-close" aria-label="Fechar chat">✕</button>
      </div>
      <div id="cvgen-chat-messages" role="log" aria-live="polite"></div>
      <div class="cvgen-quick-actions" id="cvgen-quick"></div>
      <form id="cvgen-chat-form">
        <textarea id="cvgen-chat-input" rows="1" placeholder="Escreve a tua pergunta…" aria-label="Mensagem"></textarea>
        <button type="submit" id="cvgen-chat-send" aria-label="Enviar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    const messagesEl = panel.querySelector('#cvgen-chat-messages');
    const inputEl    = panel.querySelector('#cvgen-chat-input');
    const sendBtn    = panel.querySelector('#cvgen-chat-send');
    const quickEl    = panel.querySelector('#cvgen-quick');
    const badge      = btn.querySelector('#cvgen-badge');

    let messages  = []; // histórico [{role, content}]
    let isOpen    = false;
    let isLoading = false;
    let firstOpen = true;

    // ── Auto-resize textarea ──────────────────────────────
    inputEl.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 90) + 'px';
    });

    // ── Renderizar mensagem ───────────────────────────────
    function addMessage(role, content, extra = '') {
      const div = document.createElement('div');
      div.className = `cvgen-msg ${role}${extra ? ' ' + extra : ''}`;
      div.textContent = content;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    // ── Quick actions ─────────────────────────────────────
    function renderQuickActions(show = true) {
      quickEl.innerHTML = '';
      if (!show) return;
      QUICK_ACTIONS.forEach(text => {
        const b = document.createElement('button');
        b.textContent = text;
        b.type = 'button';
        b.addEventListener('click', () => sendMessage(text));
        quickEl.appendChild(b);
      });
    }

    // ── Enviar mensagem ───────────────────────────────────
    async function sendMessage(text) {
      text = (text || inputEl.value).trim();
      if (!text || isLoading) return;

      inputEl.value = '';
      inputEl.style.height = 'auto';
      renderQuickActions(false);

      addMessage('user', text);
      messages.push({ role: 'user', content: text });

      isLoading = true;
      sendBtn.disabled = true;
      const typing = addMessage('bot', '…', 'typing');

      try {
        const res = await fetch('/api/chat', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ messages })
        });
        const data = await res.json();
        typing.remove();

        const reply = data.reply || data.error || 'Não obtive resposta. Tenta de novo.';
        addMessage('bot', reply);
        messages.push({ role: 'assistant', content: reply });
      } catch {
        typing.remove();
        addMessage('bot', 'Sem ligação ao servidor. Verifica a tua internet e tenta novamente.');
      } finally {
        isLoading = false;
        sendBtn.disabled = false;
        inputEl.focus();
      }
    }

    // ── Abrir/fechar ──────────────────────────────────────
    function openChat() {
      isOpen = true;
      panel.classList.add('open');
      badge.style.display = 'none';
      btn.innerHTML = `✕<span class="badge" id="cvgen-badge" style="display:none">1</span>`;

      if (firstOpen) {
        firstOpen = false;
        addMessage('bot', welcomeMsg);
        messages.push({ role: 'assistant', content: welcomeMsg });
        renderQuickActions(true);
      }
      setTimeout(() => inputEl.focus(), 300);
    }

    function closeChat() {
      isOpen = false;
      panel.classList.remove('open');
      btn.innerHTML = `💬<span class="badge" id="cvgen-badge" style="display:none">1</span>`;
    }

    btn.addEventListener('click', () => isOpen ? closeChat() : openChat());
    panel.querySelector('#cvgen-chat-close').addEventListener('click', closeChat);

    // ── Submit ────────────────────────────────────────────
    panel.querySelector('#cvgen-chat-form').addEventListener('submit', e => {
      e.preventDefault();
      sendMessage();
    });

    // Enter envia (Shift+Enter = nova linha)
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    // Badge de notificação após 4s (primeira visita)
    if (!sessionStorage.getItem('cvgen_chat_seen')) {
      setTimeout(() => {
        if (!isOpen) {
          const b = document.getElementById('cvgen-badge');
          if (b) b.style.display = 'flex';
          sessionStorage.setItem('cvgen_chat_seen', '1');
        }
      }, 4000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
