// track.js — regista visita no servidor (fire-and-forget)
(function () {
  try {
    // session_id: único por sessão do browser (tab)
    var sid = sessionStorage.getItem('_sid');
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('_sid', sid);
    }
    // userId do JWT (se logado)
    var uid = null;
    try {
      var tok = localStorage.getItem('cv_token');
      if (tok) {
        var payload = JSON.parse(atob(tok.split('.')[1]));
        uid = payload.id || payload.userId || null;
      }
    } catch (_) {}

    var page = location.pathname || '/';
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: page, sessionId: sid, userId: uid }),
      keepalive: true
    }).catch(function () {});
  } catch (_) {}
})();
