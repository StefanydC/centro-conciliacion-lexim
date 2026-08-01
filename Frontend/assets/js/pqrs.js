document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('archivos');
    const fileListContainer = document.getElementById('fileList');
    const pqrsForm = document.getElementById('pqrsForm');
    
    // Elementos para el mensaje de éxito elegante que ya tienes en tu HTML
    const successMessageCard = document.getElementById('pqrsSuccessMessage');
    const numeroRadicadoSpan = document.getElementById('numeroRadicado');

    // Muestra los nombres de los archivos seleccionados por el usuario
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            fileListContainer.innerHTML = '';
            Array.from(fileInput.files).forEach(file => {
                const item = document.createElement('div');
                item.style.fontSize = '0.85rem';
                item.style.color = '#1e293b';
                item.style.marginTop = '4px';
                item.innerHTML = `<i class="fas fa-file"></i> ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
                fileListContainer.appendChild(item);
            });
        });
    }

    // Envío del formulario
    if (pqrsForm) {
        pqrsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const btn = document.getElementById('btnEnviarPqrs');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando Radicado...';

            // Empacamos el formulario usando la referencia correcta a pqrsForm
            const formData = new FormData(pqrsForm);

            try {
                const response = await fetch('/api/pqrs/enviar', {
                    method: 'POST',
                    body: formData // Envía los campos de texto y los archivos seleccionados
                });

                const data = await response.json();

                if (response.ok) {
                    // 1. Ocultamos el formulario
                    pqrsForm.style.display = 'none';

                    // 2. Colocamos el número de radicado devuelto por el backend
                    if (numeroRadicadoSpan && data.radicado) {
                        numeroRadicadoSpan.textContent = data.radicado;
                    }

                    // 3. Mostramos la tarjeta/ventana elegante de éxito
                    if (successMessageCard) {
                        successMessageCard.style.display = 'block';
                        // Hacemos un scroll suave hacia el mensaje de éxito
                        successMessageCard.scrollIntoView({ behavior: 'smooth' });
                    }
                } else {
                    alert(`Error: ${data.error || 'No se pudo radicar la solicitud.'}`);
                    // Restauramos el botón si hubo un error
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Radicar PQRS';
                }
            } catch (error) {
                console.error('Error enviando la PQRS:', error);
                alert('No se pudo conectar con el servidor. Intente nuevamente.');
                
                // Restauramos el botón
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Radicar PQRS';
            }
        });
    }
});