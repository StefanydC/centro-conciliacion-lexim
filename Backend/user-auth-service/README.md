# User Auth Service

Microservicio consolidado de **autenticación y gestión de usuarios** para Centro de Conciliación Léxim.

Combina la funcionalidad de `auth-service` (login con JWT) y `usuarios-service` (CRUD de usuarios) en un único servicio bien estructurado.

## 🚀 Características

- ✅ Autenticación con JWT
- ✅ CRUD completo de usuarios
- ✅ Gestión de roles y permisos
- ✅ Validación de datos con express-validator
- ✅ Manejo centralizado de errores
- ✅ Dockerizado y listo para producción
- ✅ Logging con Morgan
- ✅ CORS habilitado

## 📂 Estructura

```
src/
├── app.js                    # Configuración de Express
├── server.js                 # Punto de entrada
├── config/
│   ├── db.js                # Conexión a MongoDB
│   └── env.js               # Variables de entorno
├── controllers/
│   ├── auth.controller.js   # Lógica de autenticación
│   └── user.controller.js   # Lógica de usuarios
├── models/
│   └── user.model.js        # Schema de Usuario
├── services/
│   ├── auth.service.js      # Servicios de auth
│   └── user.service.js      # Servicios de usuarios
├── routes/
│   ├── auth.routes.js       # Rutas de autenticación
│   └── user.routes.js       # Rutas de usuarios
├── middlewares/
│   ├── auth.middleware.js   # Verificación JWT
│   ├── error.middleware.js  # Manejo de errores
│   ├── role.middleware.js   # Validación de roles
│   └── validate.middleware.js # Validación de datos
├── validators/
│   └── user.validator.js    # Reglas de validación
└── utils/
    └── apiError.js          # Clase de errores
```

## 🔌 Variables de Entorno

```env
NODE_ENV=development
PORT=3001
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=Lexim_db
JWT_SECRET=tu_secreto_super_seguro
JWT_EXPIRES_IN=1h
```

## 📡 Endpoints

### Autenticación

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "contraseña123"
}
```

**Respuesta exitosa (200):**
```json
{
  "mensaje": "Inicio de sesión exitoso",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "usuario": {
      "id": "507f1f77bcf86cd799439011",
      "nombre": "Juan",
      "email": "juan@example.com",
      "rol": "admin"
    }
  }
}
```

### Usuarios

```bash
# Obtener todos los usuarios
GET /usuarios
Authorization: Bearer <token>

# Obtener usuario por ID
GET /usuarios/:id
Authorization: Bearer <token>

# Crear nuevo usuario (requiere admin)
POST /usuarios
Authorization: Bearer <token>
Content-Type: application/json

{
  "nombre": "Carlos",
  "email": "carlos@example.com",
  "password": "contraseña123",
  "rol": "usuario"
}

# Actualizar usuario
PATCH /usuarios/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "nombre": "Carlos Actualizado",
  "rol": "conciliador"
}

# Cambiar contraseña
POST /usuarios/:id/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "contraseña123",
  "newPassword": "nueva_contraseña456"
}

# Desactivar usuario
DELETE /usuarios/:id
Authorization: Bearer <token>

# Activar usuario
POST /usuarios/:id/activate
Authorization: Bearer <token>

# Eliminar usuario permanentemente (requiere admin)
DELETE /usuarios/:id/permanent
Authorization: Bearer <token>
```

## 🐳 Docker

### Build
```bash
docker build -t user-auth-service:latest .
```

### Run
```bash
docker run -p 3001:3001 \
  -e MONGO_URI=mongodb://mongo:27017 \
  -e JWT_SECRET=tu_secreto \
  user-auth-service:latest
```

## 🤝 Integración con Docker Compose

```yaml
user-auth-service:
  build:
    context: ./backend/user-auth-service
    dockerfile: Dockerfile
  ports:
    - "3001:3001"
  environment:
    NODE_ENV: development
    PORT: 3001
    MONGO_URI: mongodb://mongo:27017
    MONGO_DB_NAME: Lexim_db
    JWT_SECRET: ${JWT_SECRET}
    JWT_EXPIRES_IN: 1h
  depends_on:
    - mongo
  networks:
    - centro-conciliacion-network
```

## 📦 Instalación y ejecución

### Local (desarrollo)
```bash
npm install
npm run dev
```

### Producción
```bash
npm install --omit=dev
npm start
```

## ✅ Validaciones

- **Email**: Debe ser único y válido
- **Contraseña**: Mínimo 6 caracteres, hasheada con bcryptjs
- **Roles**: admin, conciliador, usuario, administrador, judicante
- **Campos requeridos**: nombre, email, contraseña (en creación)

## 🔒 Seguridad

- ✅ Contraseñas hasheadas con bcryptjs (10 rondas)
- ✅ JWT con expiración (1 hora por defecto)
- ✅ CORS habilitado
- ✅ Validación de permisos por rol
- ✅ Manejo de errores sin exponer detalles sensibles

## 📝 Logs

El servicio usa Morgan para logging HTTP:
```
GET /usuarios 200 45.230 ms
POST /auth/login 200 123.456 ms
```

## 🔄 Migración desde servicios antiguos

Este servicio **reemplaza**:
- ❌ `auth-service` (eliminable)
- ❌ `usuarios-service` (eliminable)

**Cambios en endpoints del gateway:**
```javascript
// ANTES
/auth/login → auth-service:3001
/usuarios → usuarios-service:3003

// AHORA
/auth/login → user-auth-service:3001
/usuarios → user-auth-service:3001
```

## 🛠️ Tecnologías

- **Runtime**: Node.js 20 (Alpine)
- **Framework**: Express.js
- **BD**: MongoDB
- **Autenticación**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Validación**: express-validator
- **Logging**: Morgan
- **CORS**: cors

## 📄 Licencia

MIT
