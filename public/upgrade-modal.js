// upgrade-modal.js — Sistema de upgrade de planos CV Premium
// Injector automático: incluído via <script src="/upgrade-modal.js"></script>
(function () {
  'use strict';
  if (window.__cvgenUpgradeInit) return;
  window.__cvgenUpgradeInit = true;

  const WA = '244944524292';
  const PLANOS = {
    semanal: {
      icon: '⚡', nome: 'Plano Semanal', preco: '3.000 Kz', periodo: '7 dias',
      cor: '#D97706', corLight: '#FEF3C7',
      msg: 'Olá, quero ativar o Plano Semanal (3.000 Kz / 7 dias) do CV Premium.',
      features: ['Criar e editar CVs', 'Download PDF', 'Todos os templates', 'Score ATS completo', 'IA para textos']
    },
    premium: {
      icon: '👑', nome: 'Plano Premium', preco: '7.000 Kz', periodo: 'mês',
      cor: '#2563EB', corLight: '#EEF2FF',
      msg: 'Olá, quero ativar o Plano Premium (7.000 Kz / mês) do CV Premium.',
      features: ['Tudo do Semanal', 'Carta de apresentação IA', 'Geração de resumo IA', 'Templates exclusivos', 'Suporte prioritário']
    }
  };

  // ── Obter plano atual ──────────────────────────────────────
  function getUserPlan() {
    try {
      // Lê do JWT cv_token (chave usada pela app)
      const token = localStorage.getItem('cv_token') || localStorage.getItem('token');
      if (token) {
        const p = JSON.parse(atob(token.split('.')[1]));
        return (p.plan || 'free').toLowerCase();
      }
      // Fallback: objeto user em localStorage
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return (u.plan || 'free').toLowerCase();
    } catch { return 'free'; }
  }

  function isPaid() {
    const p = getUserPlan();
    return p === 'premium' || p === 'semanal' || p === 'pro';
  }

  // Atualizar plano via /api/auth/me (garante dados frescos)
  async function refreshPlan() {
    try {
      const token = localStorage.getItem('cv_token') || localStorage.getItem('token');
      if (!token) return;
      const r = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const d = await r.json();
      const user = d.user || d;
      if (user.plan) {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        stored.plan = user.plan;
        stored.plan_expiry = user.plan_expiry;
        localStorage.setItem('user', JSON.stringify(stored));
      }
    } catch (_) {}
  }

  // ── Estilos do modal ───────────────────────────────────────
  const STYLES = `
    #upg-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(15,23,42,.65);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
      opacity: 0; transition: opacity .25s;
      pointer-events: none;
    }
    #upg-overlay.open { opacity: 1; pointer-events: all; }
    #upg-modal {
      background: #fff;
      border-radius: 20px;
      width: 100%;
      max-width: 560px;
      box-shadow: 0 32px 80px rgba(0,0,0,.25);
      overflow: hidden;
      transform: translateY(20px) scale(.97);
      transition: transform .3s cubic-bezier(.34,1.56,.64,1);
    }
    #upg-overlay.open #upg-modal { transform: translateY(0) scale(1); }
    #upg-header {
      background: linear-gradient(135deg, #1e1b4b, #4f46e5);
      padding: 28px 28px 24px;
      color: #fff;
      position: relative;
    }
    #upg-close {
      position: absolute; top: 16px; right: 16px;
      background: rgba(255,255,255,.15); border: none; color: #fff;
      width: 30px; height: 30px; border-radius: 50%;
      font-size: 16px; cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      transition: background .15s;
    }
    #upg-close:hover { background: rgba(255,255,255,.25); }
    #upg-lock { font-size: 36px; margin-bottom: 12px; }
    #upg-title { font-size: 20px; font-weight: 800; margin-bottom: 6px; font-family: 'Sora', sans-serif; }
    #upg-subtitle { font-size: 13px; opacity: .8; line-height: 1.5; font-family: 'Sora', sans-serif; }
    #upg-body { padding: 24px 28px 28px; }
    #upg-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
    .upg-card {
      border: 2px solid #E2E8F0;
      border-radius: 14px; padding: 18px 16px;
      cursor: pointer; transition: all .2s;
      position: relative;
    }
    .upg-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.1); }
    .upg-card.semanal:hover { border-color: #D97706; }
    .upg-card.premium:hover { border-color: #2563EB; }
    .upg-card-icon { font-size: 24px; margin-bottom: 8px; }
    .upg-card-name { font-size: 14px; font-weight: 800; color: #0F172A; margin-bottom: 2px; font-family: 'Sora', sans-serif; }
    .upg-card-price { font-size: 18px; font-weight: 800; margin-bottom: 2px; font-family: 'Sora', sans-serif; }
    .upg-card-period { font-size: 11px; color: #64748B; margin-bottom: 12px; font-family: 'Sora', sans-serif; }
    .upg-card-features { list-style: none; display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
    .upg-card-features li { font-size: 11px; color: #475569; display: flex; align-items: center; gap: 5px; font-family: 'Sora', sans-serif; }
    .upg-card-features li::before { content: '✓'; color: #16A34A; font-weight: 700; flex-shrink: 0; }
    .upg-btn-wa {
      width: 100%; padding: 10px; border: none; border-radius: 10px;
      font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      gap: 6px; transition: all .2s; color: #fff;
    }
    .upg-btn-wa.semanal { background: linear-gradient(135deg, #F59E0B, #D97706); }
    .upg-btn-wa.semanal:hover { opacity: .9; }
    .upg-btn-wa.premium { background: linear-gradient(135deg, #2563EB, #6366F1); }
    .upg-btn-wa.premium:hover { opacity: .9; }
    #upg-free-link {
      display: block; text-align: center; font-size: 12px; color: #94A3B8;
      text-decoration: none; cursor: pointer; font-family: 'Sora', sans-serif;
      transition: color .15s;
    }
    #upg-free-link:hover { color: #64748B; }
    /* Banner premium no dashboard */
    #upg-banner {
      background: linear-gradient(135deg, #1e1b4b 0%, #4f46e5 60%, #7c3aed 100%);
      border-radius: 14px;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: opacity .2s;
    }
    #upg-banner:hover { opacity: .95; }
    #upg-banner::before {
      content: '✦';
      position: absolute; right: 20px; top: -10px;
      font-size: 80px; opacity: .08; color: #fff;
      pointer-events: none;
    }
    #upg-banner-icon { font-size: 32px; flex-shrink: 0; }
    #upg-banner-text { flex: 1; }
    #upg-banner-title { font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 2px; font-family: 'Sora', sans-serif; }
    #upg-banner-sub { font-size: 12px; color: rgba(255,255,255,.75); font-family: 'Sora', sans-serif; line-height: 1.4; }
    #upg-banner-cta {
      background: #fff; color: #4f46e5;
      padding: 8px 18px; border-radius: 10px;
      font-size: 12px; font-weight: 800; white-space: nowrap;
      font-family: 'Sora', sans-serif; flex-shrink: 0;
      border: none; cursor: pointer;
    }
    /* Bloqueio no editor */
    #upg-editor-block {
      position: fixed; inset: 0; z-index: 9000;
      background: rgba(15,23,42,.7);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    #upg-editor-box {
      background: #fff; border-radius: 20px;
      padding: 40px 32px; max-width: 420px; width: 100%;
      text-align: center; box-shadow: 0 32px 80px rgba(0,0,0,.3);
    }
    #upg-editor-box .lock { font-size: 48px; margin-bottom: 16px; }
    #upg-editor-box h2 { font-size: 20px; font-weight: 800; color: #0F172A; margin-bottom: 8px; font-family: 'Sora', sans-serif; }
    #upg-editor-box p  { font-size: 13px; color: #64748B; margin-bottom: 24px; line-height: 1.6; font-family: 'Sora', sans-serif; }
    .upg-editor-btns { display: flex; flex-direction: column; gap: 10px; }
    .upg-editor-btn {
      padding: 13px; border: none; border-radius: 12px;
      font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center;
      justify-content: center; gap: 8px; transition: all .2s;
      text-decoration: none;
    }
    .upg-eb-semanal { background: linear-gradient(135deg,#F59E0B,#D97706); color: #fff; }
    .upg-eb-semanal:hover { opacity: .9; transform: translateY(-1px); }
    .upg-eb-premium { background: linear-gradient(135deg,#2563EB,#6366F1); color: #fff; }
    .upg-eb-premium:hover { opacity: .9; transform: translateY(-1px); }
    .upg-eb-back { background: #F1F5F9; color: #475569; }
    .upg-eb-back:hover { background: #E2E8F0; }
    @media (max-width: 480px) {
      #upg-cards { grid-template-columns: 1fr; }
      #upg-body { padding: 20px; }
      #upg-header { padding: 24px 20px 20px; }
    }
  `;

  // ── Criar modal HTML ───────────────────────────────────────
  function buildModal() {
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'upg-overlay';
    overlay.innerHTML = `
      <div id="upg-modal">
        <div id="upg-header">
          <button id="upg-close" aria-label="Fechar">✕</button>
          <div id="upg-lock">🔐</div>
          <div id="upg-title">Funcionalidade Premium</div>
          <div id="upg-subtitle">Activa um plano para criar e editar CVs profissionais sem limites.</div>
        </div>
        <div id="upg-body">
          <div id="upg-cards">
            ${buildCard('semanal')}
            ${buildCard('premium')}
          </div>
          <a id="upg-free-link" onclick="document.getElementById('upg-overlay').classList.remove('open')">
            Continuar com plano gratuito →
          </a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('upg-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  }

  function buildCard(tipo) {
    const p = PLANOS[tipo];
    const feats = p.features.map(f => `<li>${f}</li>`).join('');
    return `
      <div class="upg-card ${tipo}">
        <div class="upg-card-icon">${p.icon}</div>
        <div class="upg-card-name">${p.nome}</div>
        <div class="upg-card-price" style="color:${p.cor}">${p.preco}</div>
        <div class="upg-card-period">por ${p.periodo}</div>
        <ul class="upg-card-features">${feats}</ul>
        <button class="upg-btn-wa ${tipo}" onclick="window.UpgradeSystem.activar('${tipo}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Activar via WhatsApp
        </button>
      </div>
    `;
  }

  // ── Modal ─────────────────────────────────────────────────
  function openModal(reason) {
    const overlay = document.getElementById('upg-overlay');
    if (!overlay) return;
    const sub = document.getElementById('upg-subtitle');
    if (sub && reason) sub.textContent = reason;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = document.getElementById('upg-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function activar(tipo) {
    const p = PLANOS[tipo];
    if (!p) return;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(p.msg)}`, '_blank', 'noopener');
  }

  // ── Banner premium no dashboard ────────────────────────────
  function injectBanner() {
    if (isPaid()) return;
    if (!window.location.pathname.startsWith('/app')) return;

    // Aguarda DOM estar pronto e encontra onde inserir o banner
    function tryInject() {
      // Tenta inserir após o primeiro heading ou no topo do main content
      const targets = [
        document.querySelector('.main-content'),
        document.querySelector('.dashboard'),
        document.querySelector('main'),
        document.querySelector('.content'),
        document.querySelector('#panel-overview'),
      ];
      const target = targets.find(t => t);
      if (!target) return;

      if (document.getElementById('upg-banner')) return;

      const banner = document.createElement('div');
      banner.id = 'upg-banner';
      banner.onclick = () => openModal('Activa um plano para começar a criar CVs profissionais.');
      banner.innerHTML = `
        <div id="upg-banner-icon">🚀</div>
        <div id="upg-banner-text">
          <div id="upg-banner-title">Estás no Plano Gratuito</div>
          <div id="upg-banner-sub">Cria CVs profissionais, faz download em PDF e destaca-te. Activa a partir de <strong style="color:#fff">3.000 Kz</strong>.</div>
        </div>
        <button id="upg-banner-cta">Ver Planos ↗</button>
      `;
      target.insertAdjacentElement('afterbegin', banner);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(tryInject, 600));
    } else {
      setTimeout(tryInject, 600);
    }
  }

  // ── API pública ────────────────────────────────────────────
  window.UpgradeSystem = {
    show  : openModal,
    close : closeModal,
    activar,
    isPaid,
    getPlan: getUserPlan,
    refresh: refreshPlan,
  };

  // ── Init ──────────────────────────────────────────────────
  function init() {
    buildModal();
    refreshPlan().then(() => {
      injectBanner();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
