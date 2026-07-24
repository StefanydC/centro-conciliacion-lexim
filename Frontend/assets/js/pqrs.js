document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('archivos');
    const fileListContainer = document.getElementById('fileList');
    const pqrsForm = document.getElementById('pqrsForm');

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

            // Empacamos el formulario con sus inputs y archivos
            const formData = new FormData(this);

            try {
                // Petición a la API del servidor Backend
                const response = await fetch('/api/pqrs/radicar', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    // Ocultar formulario y mostrar mensaje de éxito con el radicado generado
                    pqrsForm.style.display = 'none';
                    document.getElementById('numeroRadicado').textContent = data.radicado;
                    document.getElementById('pqrsSuccessMessage').style.display = 'block';
                } else {
                    alert('Ocurrió un error al radicar: ' + (data.mensaje || 'Intente nuevamente'));
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Radicar PQRS';
                }
            } catch (error) {
                console.error('Error:', error);
                alert('No se pudo conectar con el servidor de radicación. Intente más tarde.');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Radicar PQRS';
            }
        });
    }
});