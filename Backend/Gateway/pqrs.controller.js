const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Resend } = require('resend');

// 1. Inicializar Resend con tu API KEY de Railway
const resend = new Resend(process.env.RESEND_API_KEY);

// 2. Configuración de Multer para recibir archivos en memoria
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Formato no permitido. Solo PDF, Word e imágenes (JPG/PNG).'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB por archivo
    fileFilter: fileFilter
});

// 3. Ruta POST para recibir y enviar la PQRS
router.post('/enviar', upload.array('archivos'), async (req, res) => {
    try {
        const { 
            tipo_solicitud, 
            nombre, 
            documento, 
            email, 
            telefono, 
            asunto, 
            descripcion 
        } = req.body;

        const archivos = req.files || [];

        // --- GENERACIÓN DE RADICADO FORMATO: PQRS-YYMMDD-RANDOM
        const ahora = new Date();
        const yy = ahora.getFullYear().toString().slice(-2);
        const mm = String(ahora.getMonth() + 1).padStart(2, '0');
        const dd = String(ahora.getDate()).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);

        const radicado = `PQRS-${yy}${mm}${dd}-${random}`;

        // Mapear archivos para Resend
        const attachments = archivos.map(file => ({
            filename: file.originalname,
            content: file.buffer
        }));

        // Correo interno para LEXIM (Admin)
        const mailToAdmin = {
            from: 'Sistema PQRS LEXIM <onboarding@resend.dev>',
            to: [process.env.EMAIL_DESTINO || 'notificacionespqrslexim@gmail.com'],
            subject: `[Nueva ${tipo_solicitud}] Radicado: ${radicado} - ${asunto}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px;">
                        Nueva Solicitud Radicada en LEXIM
                    </h2>
                    <p><strong>N° de Radicado:</strong> <span style="background-color: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${radicado}</span></p>
                    <p><strong>Tipo de Solicitud:</strong> ${tipo_solicitud}</p>
                    
                    <h3 style="color: #2563eb; margin-top: 20px;">Datos del Solicitante:</h3>
                    <ul>
                        <li><strong>Nombre:</strong> ${nombre}</li>
                        <li><strong>Documento/NIT:</strong> ${documento}</li>
                        <li><strong>Correo de contacto:</strong> ${email}</li>
                        <li><strong>Teléfono / WhatsApp:</strong> ${telefono}</li>
                    </ul>

                    <h3 style="color: #2563eb; margin-top: 20px;">Detalle de la PQRS:</h3>
                    <p><strong>Asunto:</strong> ${asunto}</p>
                    <p><strong>Descripción:</strong></p>
                    <blockquote style="background: #f8fafc; border-left: 4px solid #2563eb; margin: 0; padding: 10px 15px; white-space: pre-line;">
                        ${descripcion}
                    </blockquote>

                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="font-size: 0.85rem; color: #64748b;">
                        <em>Archivos adjuntos: ${archivos.length} archivo(s) procesado(s).</em>
                    </p>
                </div>
            `,
            attachments: attachments
        };

        // Enviamos ÚNICAMENTE el correo al destino oficial de LEXIM
        await resend.emails.send(mailToAdmin);

        return res.status(200).json({ 
            exito: true, 
            radicado: radicado,
            mensaje: 'PQRS radicado y enviado correctamente' 
        });

    } catch (error) {
        console.error("Error al procesar/enviar el PQRS con Resend:", error);
        return res.status(500).json({ 
            exito: false, 
            error: 'Ocurrió un error al enviar la PQRS. Por favor intente más tarde.' 
        });
    }
});

module.exports = router;