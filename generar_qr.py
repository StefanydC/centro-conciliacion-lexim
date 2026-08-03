import qrcode

# Enlace que quieres convertir en QR
url = "https://centro-conciliacion-lexim.up.railway.app/api/PQRS.html"

# Crear QR
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=10,
    border=4,
)

qr.add_data(url)
qr.make(fit=True)

# Generar imagen
img = qr.make_image(fill_color="black", back_color="white")

# Guardar
img.save("QR_PQRS.png")

print("¡QR generado correctamente!")