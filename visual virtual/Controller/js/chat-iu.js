function setupChat(prefix) {
  const body = document.getElementById(`chatBody${prefix}`);
  const input = document.getElementById(`chatInput${prefix}`);
  const send = document.getElementById(`chatSend${prefix}`);
  if (!body || !input || !send) return;

  const addMsg = (text, cls) => {
    const div = document.createElement('div');
    div.className = `msg ${cls}`;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  };

  const sendUser = () => {
    const q = input.value.trim();
    if (!q) return;
    addMsg(q, 'user');
    input.value = '';

    // Placeholder (luego lo cambias por tu IA)
    setTimeout(
      () => addMsg('Gracias. Esta es una respuesta de ejemplo. (Aquí irá la IA).', 'bot'),
      350
    );
  };

  send.addEventListener('click', sendUser);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendUser(); });

  // sugerencias
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