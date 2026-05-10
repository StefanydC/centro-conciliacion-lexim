function setupChat(prefix) {
  const body  = document.getElementById(`chatBody${prefix}`);
  const input = document.getElementById(`chatInput${prefix}`);
  const send  = document.getElementById(`chatSend${prefix}`);
  if (!body || !input || !send) return;

  const addMsg = (text, cls) => {
    const div = document.createElement('div');
    div.className = `msg ${cls}`;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  };

  const sendUser = async () => {
    const q = input.value.trim();
    if (!q || send.disabled) return;
    addMsg(q, 'user');
    input.value = '';
    send.disabled = true;

    const thinking = addMsg('Analizando tu consulta…', 'bot');

    try {
      const res  = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mensaje: q })
      });
      const data = await res.json();
      thinking.textContent = data.respuesta || 'No se pudo obtener respuesta.';
    } catch (_) {
      thinking.textContent = 'Error de conexión. Por favor intenta de nuevo.';
    } finally {
      send.disabled = false;
      body.scrollTop = body.scrollHeight;
    }
  };

  send.addEventListener('click', sendUser);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendUser(); });

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('.suggest');
    if (!btn) return;
    input.value = btn.textContent.trim();
    sendUser();
  });
}

setupChat('A');
setupChat('B');
setupChat('C');
