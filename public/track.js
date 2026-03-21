// track.js — regista visita + eventos no servidor (fire-and-forget)
(function () {
  function _sid() {
    var s = sessionStorage.getItem('_sid');
    if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('_sid', s); }
    return s;
  }
  function _uid() {
    try { var tok = localStorage.getItem('cv_token'); if (tok) { var p = JSON.parse(atob(tok.split('.')[1])); return p.id || p.userId || null; } } catch (_) {}
    return null;
  }

  // Page view
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: location.pathname || '/', sessionId: _sid(), userId: _uid() }),
      keepalive: true
    }).catch(function () {});
  } catch (_) {}

  // trackEvent global — disponível em qualquer página que carregue este ficheiro
  window.trackEvent = function (eventType, data) {
    try {
      fetch('/api/track/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: eventType, page: location.pathname || '/', data: data || null,
          sessionId: _sid(), userId: _uid() }),
        keepalive: true
      }).catch(function () {});
    } catch (_) {}
  };
})();
