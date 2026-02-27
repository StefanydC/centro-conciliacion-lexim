// ===== REEMPLAZA TODO EL CONTENIDO DE main.js CON ESTE CÓDIGO =====

document.addEventListener("DOMContentLoaded", function() {

    // --- Lógica para la animación de revelado por palabras del título ---
    const headline = document.getElementById("typing-headline");
    if (headline) {
        const text = headline.textContent;
        const words = text.split(' '); // Divide la frase en un array de palabras
        
        headline.innerHTML = ''; // Limpiamos el H1

        words.forEach((word, index) => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'word'; // Le damos la clase para el CSS
            wordSpan.innerHTML = `${word}&nbsp;`; // Añadimos la palabra y un espacio
            
            // Asignamos un retraso a la animación para cada palabra
            wordSpan.style.animationDelay = `${index * 0.08}s`; 
            
            headline.appendChild(wordSpan);
        });
    }

    // --- Lógica para animar CUALQUIER ELEMENTO que aparezca al hacer scroll ---
    // Seleccionamos TODOS los elementos que queremos que tengan este efecto
    const animatedItems = document.querySelectorAll('.feature-item, .team-card, .section-title, .section-subtitle, .value-card, .animated-reveal');

    if (animatedItems.length > 0) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                // Si el elemento está visible en la pantalla...
                if (entry.isIntersecting) {
                    // ...le añadimos la clase 'is-visible' para que se active la animación CSS
                    entry.target.classList.add('is-visible');
                    // Dejamos de observar este elemento para que la animación no se repita
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1 // La animación se dispara cuando al menos el 10% del elemento es visible
        });

        // Le decimos al observador que vigile cada uno de nuestros elementos
        animatedItems.forEach(item => {
            observer.observe(item);
        });
    }
});