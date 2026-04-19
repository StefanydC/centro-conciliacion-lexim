# Documentación Técnica del Sistema
# Centro de Conciliación Lexim

**Versión:** 1.0  
**Fecha:** Abril 2026  
**Tecnologías:** Node.js · Express · MongoDB Atlas · Docker · Nginx · JWT

---

## Tabla de Contenidos

1. [Análisis de Requerimientos](#1-análisis-de-requerimientos)
2. [Arquitectura de Red Propuesta](#2-arquitectura-de-red-propuesta)
3. [Servicios de Red Necesarios](#3-servicios-de-red-necesarios)
4. [Aplicación del Modelo OSI](#4-aplicación-del-modelo-osi)
5. [Protocolos Involucrados](#5-protocolos-involucrados)
6. [Seguridad](#6-seguridad)
7. [Escalabilidad](#7-escalabilidad)

---

## 1. Análisis de Requerimientos

### 1.1 Descripción del sistema

El sistema es una aplicación web de gestión interna para el Centro de Conciliación Lexim. Permite a los usuarios autenticados administrar casos de conciliación, tareas y usuarios del sistema. El público general puede consultar información institucional sin autenticación.

### 1.2 Tipos de usuario

| Tipo | Descripción | Acceso |
|------|-------------|--------|
| **Público** | Visitantes del sitio web | Solo páginas informativas (HTML estático) |
| **Judicante** | Funcionarios del centro | Login, tareas propias, casos de conciliación |
| **Administrador** | Director / coordinador | Acceso total: usuarios, conciliaciones, tareas, panel admin |

### 1.3 Estimación de usuarios concurrentes

El Centro de Conciliación Lexim es una entidad de tamaño mediano. Se estiman:

- **Usuarios activos registrados:** 50–150 personas (judicantes y administradores)
- **Usuarios concurrentes en horas pico:** 20–50 sesiones simultáneas
- **Visitantes públicos concurrentes:** 30–80 (consulta de información)
- **Total concurrente estimado:** ~100–130 conexiones simultáneas

Esta carga es manejable por un solo servidor con la arquitectura actual. La horizontalidad de los microservicios permite escalar selectivamente si algún servicio se convierte en cuello de botella.

### 1.4 Tipo de aplicación

- **Categoría:** Aplicación web institucional con módulo de gestión interna
- **Patrón:** Multi-página (MPA) para el frontend público + SPA implícita para el módulo de gestión
- **Comunicación:** REST API sobre HTTP/HTTPS con autenticación JWT
- **Arquitectura backend:** Microservicios orquestados con Docker Compose

### 1.5 Nivel de seguridad requerido

**Alto**, por las siguientes razones:
- El sistema gestiona expedientes y casos con valor jurídico
- Los datos personales de los usuarios están almacenados (nombre, correo, rol)
- El acceso no autorizado podría comprometer la confidencialidad de los procesos de conciliación

Medidas implementadas: autenticación JWT, control de acceso basado en roles (RBAC), rate limiting en el login, aislamiento de red interna Docker, validación de tokens centralizada en el gateway.

### 1.6 Disponibilidad esperada

- **Horario de operación:** Lunes a viernes, 7:00 a.m. – 7:00 p.m.
- **Disponibilidad objetivo:** 99.5% en horario laboral
- **Tolerancia a fallos:** El sistema usa `restart: unless-stopped` en todos los contenedores, lo que garantiza reinicio automático ante caídas
- **Base de datos:** MongoDB Atlas ofrece disponibilidad del 99.95% con replicación automática en tres nodos

---

## 2. Arquitectura de Red Propuesta

### 2.1 Modelo cliente-servidor con microservicios

El sistema implementa un modelo cliente-servidor de tres capas con arquitectura de microservicios:

```
┌─────────────┐       Internet        ┌──────────────────────────────────────┐
│   Navegador │ ──── HTTP :80 ──────► │              Servidor                │
│  (Cliente)  │                       │                                      │
└─────────────┘                       │  ┌─────────┐    Red Docker: lexim-net │
                                      │  │  Nginx  │                          │
                                      │  │  :80    │◄── Único puerto externo  │
                                      │  └────┬────┘                          │
                                      │       │ proxy_pass                    │
                                      │  ┌────▼──────────┐                   │
                                      │  │  API Gateway  │                   │
                                      │  │    :5000      │                   │
                                      │  └──┬─────┬────┬─┘                   │
                                      │     │     │    │                      │
                                      │  ┌──▼─┐ ┌─▼─┐ ┌▼──────────┐         │
                                      │  │auth│ │con│ │ usuarios  │         │
                                      │  │3001│ │3002│ │   3003    │         │
                                      │  └──┬─┘ └─┬─┘ └─────┬─────┘         │
                                      │     └──────┴─────────┘               │
                                      │              │ MongoDB Driver         │
                                      └──────────────┼───────────────────────┘
                                                     │ Internet (TLS)
                                          ┌──────────▼──────────┐
                                          │   MongoDB Atlas      │
                                          │  (Cloud - 3 nodos)   │
                                          └─────────────────────┘
```

### 2.2 Segmentación lógica de la red

La red `lexim-net` es una red Docker de tipo bridge. Dentro de ella existe una segmentación lógica implícita por responsabilidad:

| Segmento | Contenedores | Puerto externo |
|----------|-------------|----------------|
| **Frontera** | nginx | 80 (único expuesto) |
| **Lógica de negocio** | api-gateway, auth-service, conciliacion-service, usuarios-service | Ninguno |
| **Datos** | MongoDB Atlas (cloud) | Ninguno (acceso solo desde microservicios) |

Los microservicios y el gateway **no tienen puertos expuestos al host**. Solo se comunican entre sí dentro de `lexim-net`. Esto significa que un atacante externo no puede acceder directamente a `auth-service:3001` aunque conozca la IP del servidor.

### 2.3 Ubicación de los servidores

| Componente | Ubicación | Justificación |
|------------|-----------|---------------|
| nginx, gateway, microservicios | Un servidor físico o VPS (Docker Compose) | Costo reducido para el tamaño del sistema |
| MongoDB Atlas | Nube (MongoDB Inc.) | Alta disponibilidad, backups automáticos, sin administración de infraestructura |

### 2.4 Flujo de acceso interno y externo

**Externo (usuario):**
```
Browser → :80 (nginx) → api-gateway:5000 → microservicio:puerto
```

**Interno (entre contenedores):**
```
api-gateway → http://auth-service:3001        (resuelto por DNS Docker)
api-gateway → http://conciliacion-service:3002
api-gateway → http://usuarios-service:3003
microservicio → mongodb+srv://...atlas.mongodb.net  (Internet, TLS)
```

El DNS interno de Docker resuelve automáticamente los nombres de servicio a sus IPs virtuales dentro de `lexim-net`. No se usa `localhost` entre contenedores.

---

## 3. Servicios de Red Necesarios

### 3.1 DNS (Domain Name System)

**Uso en el proyecto:**
- **DNS externo:** Cuando el sistema esté en producción con un dominio (ej. `lexim.com.co`), un registro A en el DNS público apunta el dominio a la IP del servidor donde corre Nginx.
- **DNS interno Docker:** Docker Engine incluye un servidor DNS embebido que resuelve automáticamente los nombres de servicio definidos en `docker-compose.yml`. Por ejemplo, cuando el gateway hace una petición a `http://auth-service:3001`, Docker resuelve `auth-service` a la IP interna del contenedor correspondiente dentro de `lexim-net`. No se requiere configuración adicional.

### 3.2 DHCP (Dynamic Host Configuration Protocol)

**Uso en el proyecto:**  
En la arquitectura actual sobre Docker Compose, el DHCP no se gestiona manualmente. Docker asigna automáticamente direcciones IP privadas a cada contenedor dentro de la red `lexim-net` (rango típico: `172.18.0.0/16`). Estas IPs son dinámicas por diseño, pero los contenedores se comunican por nombre de servicio (no por IP), lo que elimina la dependencia de una IP fija.

En un despliegue en la nube (AWS, GCP), el DHCP del proveedor asigna la IP pública del servidor.

### 3.3 Servidor Web — Nginx

**Rol en el proyecto:**  
Nginx cumple dos funciones simultáneas:

1. **Servidor de archivos estáticos:** Sirve los archivos HTML, CSS, JS e imágenes del frontend desde `/usr/share/nginx/html/`.
2. **Reverse proxy:** Redirige las peticiones de API al contenedor `api-gateway:5000` según el prefijo de la URL.

**Ventaja de este diseño:** El cliente nunca se comunica directamente con los microservicios. Nginx actúa como punto único de entrada y puede agregar TLS (HTTPS) en el futuro sin modificar ningún microservicio.

**Rate limiting configurado:**
```nginx
limit_req_zone $binary_remote_addr zone=login_zone:10m rate=5r/m;
```
El endpoint de login acepta máximo 5 peticiones por minuto por dirección IP. Si se supera, Nginx devuelve `429 Too Many Requests`.

### 3.4 Base de Datos — MongoDB Atlas

**Rol en el proyecto:**  
MongoDB Atlas es el servicio de base de datos en la nube. Cada microservicio se conecta directamente a Atlas usando la cadena de conexión configurada como variable de entorno.

Características relevantes para el sistema:
- **Replicación automática:** 3 nodos (primario + 2 secundarios), garantiza disponibilidad ante fallo de un nodo
- **Backups automáticos:** Copias de seguridad diarias con restauración a cualquier punto en el tiempo
- **TLS obligatorio:** La conexión entre microservicios y Atlas usa cifrado SSL/TLS
- **Autenticación:** Usuario y contraseña + lista blanca de IPs permitidas (configurar en Atlas)

Las colecciones usadas son: `usuarios`, `tareas`, `conciliaciones`.

### 3.5 Firewall

**Rol en el proyecto:**  
La seguridad perimetral tiene dos niveles:

1. **Firewall del host (sistema operativo):** Solo el puerto 80 debe estar abierto al exterior. El resto de puertos (3001, 3002, 3003, 5000) no deben ser accesibles desde Internet. En un VPS esto se configura con `ufw` (Ubuntu) o las reglas de seguridad del proveedor cloud.
   ```bash
   ufw allow 22    # SSH
   ufw allow 80    # HTTP
   ufw allow 443   # HTTPS (cuando se implemente)
   ufw deny all
   ```
2. **Aislamiento Docker:** La red `lexim-net` aísla los contenedores internos. Docker no expone puertos sin una directiva `ports:` explícita en el `docker-compose.yml`. Los microservicios no tienen `ports:` definido, por lo que son inaccesibles desde el exterior.

### 3.6 Proxy — API Gateway

**Rol en el proyecto:**  
El API Gateway es un servidor Node.js + Express que actúa como intermediario inteligente entre Nginx y los microservicios. Sus responsabilidades son:

1. **Enrutamiento:** Determina a qué microservicio enviar cada petición según el prefijo de la URL
2. **Autenticación centralizada:** Verifica el JWT antes de reenviar la petición. Si el token es inválido, devuelve 401 sin llegar al microservicio
3. **Control de acceso por rol:** Verifica que el usuario tenga el rol requerido (judicante o administrador) antes de permitir el acceso
4. **Inyección de headers:** Añade `X-User-ID`, `X-User-Role`, `X-User-Email` a las peticiones reenviadas, para que los microservicios no necesiten re-validar el JWT
5. **Manejo de errores de red:** Si un microservicio no responde, devuelve 503 con un mensaje descriptivo en lugar de dejar al cliente colgado

**Tabla de enrutamiento del Gateway:**

| Ruta | Microservicio destino | Protección |
|------|-----------------------|------------|
| `POST /auth/login` | auth-service:3001 | Pública |
| `GET /auth/health` | auth-service:3001 | Pública |
| `GET /tasks` | auth-service:3001 | JWT (judicante/admin) |
| `POST /tasks` | auth-service:3001 | JWT (judicante/admin) |
| `PATCH /tasks/:id/estado` | auth-service:3001 | JWT (judicante/admin) |
| `GET /conciliacion` | conciliacion-service:3002 | JWT (judicante/admin) |
| `POST /conciliacion` | conciliacion-service:3002 | JWT (judicante/admin) |
| `GET /usuarios` | usuarios-service:3003 | JWT (solo admin) |
| `POST /usuarios` | usuarios-service:3003 | JWT (solo admin) |
| `* /admin/*` | usuarios-service:3003 | JWT (solo admin) |

---

## 4. Aplicación del Modelo OSI

A continuación se traza lo que ocurre capa por capa cuando un administrador hace `GET /usuarios/` para listar todos los usuarios del sistema.

### Capa 7 — Aplicación (HTTP)

El navegador construye una petición HTTP:
```
GET /usuarios/ HTTP/1.1
Host: lexim.com.co
Authorization: Bearer eyJhbGci...
Content-Type: application/json
```
Nginx recibe esta petición en el bloque `location /usuarios/` y la reenvía al gateway como:
```
GET /usuarios/ HTTP/1.1
Host: lexim.com.co
X-Real-IP: 181.x.x.x
Authorization: Bearer eyJhbGci...
```
El gateway verifica el JWT (`requireAdmin`), inyecta los headers `X-User-ID` y `X-User-Role`, y hace proxy a `usuarios-service:3003/usuarios/`.

### Capa 6 — Presentación (Encoding / TLS)

- Los datos JSON son codificados en UTF-8.
- En producción con HTTPS, aquí actúa TLS: Nginx cifra/descifra la comunicación con el cliente. Internamente (entre contenedores) la comunicación es HTTP plano ya que la red Docker es de confianza y no sale a Internet.
- MongoDB Atlas usa TLS en su capa de presentación para cifrar los datos en tránsito entre los microservicios y el servidor de base de datos.

### Capa 5 — Sesión (Session Management)

- HTTP/1.1 con `Connection: keep-alive` mantiene la conexión TCP abierta para múltiples peticiones, mejorando el rendimiento.
- El gateway usa `proxy_http_version 1.1` para beneficiarse de esto.
- La "sesión de usuario" en la aplicación no está en el servidor sino en el JWT que el cliente guarda (localStorage o cookie). Cada petición es independiente — el servidor es stateless.

### Capa 4 — Transporte (TCP)

- Toda la comunicación usa TCP para garantizar entrega ordenada y sin pérdidas.
- **Puertos involucrados:**
  - Cliente → Nginx: TCP destino 80 (o 443 con HTTPS)
  - Nginx → Gateway: TCP destino 5000 (interno Docker)
  - Gateway → auth-service: TCP destino 3001
  - Gateway → conciliacion-service: TCP destino 3002
  - Gateway → usuarios-service: TCP destino 3003
  - Microservicios → MongoDB Atlas: TCP destino 27017
- Docker mapea internamente los puertos entre contenedores. El cliente nunca ve los puertos internos.

### Capa 3 — Red (IP)

- El cliente tiene una dirección IP pública (ej. `181.x.x.x`).
- El servidor tiene su propia IP pública (asignada por el VPS o proveedor).
- Dentro de la red Docker `lexim-net`, cada contenedor tiene una IP privada en el rango `172.18.0.0/16` asignada automáticamente.
- El router / NAT del host traduce la IP pública del servidor a la IP interna de Nginx.
- Los microservicios se comunican usando IPs privadas Docker, resueltas por DNS interno a partir del nombre de servicio.

### Capa 2 — Enlace de Datos (Ethernet / Bridge)

- En la red física: la comunicación entre el cliente y el servidor viaja en tramas Ethernet con las MACs del gateway de red local de cada extremo.
- Dentro del servidor: Docker crea una interfaz bridge virtual (`docker0` o `br-lexim-net`). La comunicación entre contenedores viaja a través de esta interfaz virtual sin salir al hardware físico, usando direcciones MAC virtuales asignadas por Docker a cada interfaz de contenedor.

### Capa 1 — Física

- La petición del cliente viaja por el medio físico: cable de red, fibra óptica, o señal WiFi.
- Dentro del servidor, la comunicación entre contenedores no usa hardware físico: usa memoria del sistema operativo a través del bridge virtual Docker. Esto la hace extremadamente rápida (latencia < 1 ms entre contenedores).

---

## 5. Protocolos Involucrados

### 5.1 HTTP / HTTPS

**HTTP (HyperText Transfer Protocol)** es el protocolo principal de comunicación en todos los niveles del sistema:

- **Cliente → Nginx:** HTTP en desarrollo. En producción debe ser HTTPS (HTTP sobre TLS). Nginx termina la conexión TLS y habla HTTP plano hacia el interior.
- **Nginx → API Gateway:** HTTP/1.1 interno. Seguro porque está dentro de la red Docker.
- **Gateway → Microservicios:** HTTP/1.1 interno. Mismo razonamiento.
- **Microservicios → MongoDB Atlas:** No usa HTTP; usa el protocolo binario de MongoDB (`mongodb+srv://`) sobre TCP con TLS.

El sistema implementa la arquitectura REST: los recursos se identifican por URL (`/conciliacion/`, `/usuarios/:id`), las operaciones por método HTTP (GET, POST, PATCH, DELETE), y las respuestas usan códigos de estado estándar (200, 201, 401, 403, 503).

### 5.2 TCP (Transmission Control Protocol)

TCP garantiza que los paquetes lleguen completos, en orden y sin duplicados. Es el transporte de todo el sistema:

- Cada petición HTTP abre una conexión TCP (o reutiliza una existente con keep-alive).
- Si un paquete se pierde, TCP lo retransmite automáticamente.
- En el sistema Lexim, el `proxyTimeout: 10000` del gateway cierra la conexión TCP si un microservicio no responde en 10 segundos, evitando que el cliente quede esperando indefinidamente.

### 5.3 IP (Internet Protocol)

IP se encarga del enrutamiento de paquetes entre redes. En el sistema:

- **IPv4** es el protocolo usado tanto externamente (IP pública del servidor) como internamente (IPs privadas Docker `172.18.x.x`).
- Cada paquete lleva la IP de origen y destino. El router del proveedor de Internet enruta los paquetes hacia la IP del servidor. Dentro de Docker, el kernel Linux hace el enrutamiento entre la red `lexim-net` y el host.
- IP no garantiza entrega; eso lo hace TCP en la capa superior.

### 5.4 ARP (Address Resolution Protocol)

ARP traduce direcciones IP a direcciones MAC en una red local. Es usado:

- **En la red física:** Cuando el paquete llega al segmento de red del servidor, el switch usa ARP para determinar a qué puerto físico enviar el paquete según la MAC del servidor.
- **En la red Docker bridge:** El kernel Linux usa ARP para resolver las MACs virtuales de los contenedores dentro del bridge `lexim-net`. Cuando el gateway intenta comunicarse con `auth-service:3001`, el sistema resuelve la IP vía DNS, y luego ARP resuelve esa IP a la MAC virtual del contenedor `auth_service`.

### 5.5 DNS (Domain Name System)

DNS traduce nombres de dominio a direcciones IP. Hay dos contextos en el sistema:

1. **DNS público:** Cuando el usuario escribe `lexim.com.co` en el navegador, su sistema operativo consulta al servidor DNS del proveedor de Internet (o de Google/Cloudflare), que devuelve la IP pública del servidor donde corre Nginx.

2. **DNS interno Docker:** Cuando `api-gateway` hace `http://auth-service:3001`, el proceso Node.js llama al sistema operativo para resolver `auth-service`. El sistema operativo del contenedor está configurado para consultar el DNS embebido de Docker (`127.0.0.11`), que devuelve la IP privada del contenedor `auth_service` dentro de `lexim-net`. Este proceso es transparente y automático para la aplicación.

---

## 6. Seguridad

### 6.1 HTTPS (TLS en producción)

Actualmente el sistema corre en HTTP. Para producción se debe agregar HTTPS con un certificado SSL/TLS. La forma recomendada es usar **Let's Encrypt** con **Certbot** para obtener un certificado gratuito y configurarlo en Nginx:

```nginx
server {
    listen 443 ssl;
    ssl_certificate     /etc/letsencrypt/live/lexim.com.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lexim.com.co/privkey.pem;
    # ... resto de la configuración
}
server {
    listen 80;
    return 301 https://$host$request_uri;  # redirigir HTTP → HTTPS
}
```

Con HTTPS, todos los tokens JWT y datos viajan cifrados entre el cliente y el servidor. Los microservicios internos no necesitan TLS porque la red Docker es de confianza.

### 6.2 Segmentación de red

- Los microservicios están en una red Docker privada (`lexim-net`) sin acceso directo desde Internet.
- Solo Nginx expone el puerto 80. Ningún otro contenedor tiene puertos mapeados al host.
- MongoDB Atlas está en la nube y acepta conexiones solo desde las IPs del servidor (configurar lista blanca en Atlas Dashboard → Network Access).

### 6.3 Control de acceso: JWT y roles

El sistema implementa **RBAC (Role-Based Access Control)** a nivel del API Gateway:

```
POST /auth/login     → Público (sin token)
GET  /tasks          → requireJudicante  (tipo_usuario: administrador | judicante)
GET  /conciliacion   → requireJudicante  (tipo_usuario: administrador | judicante)
GET  /usuarios       → requireAdmin      (tipo_usuario: administrador)
*    /admin/*        → requireAdmin      (tipo_usuario: administrador)
```

El JWT contiene el payload `{ sub, email, tipo_usuario }` firmado con HS256 y expira en 8 horas. Si un judicante intenta acceder a `/usuarios/`, el gateway devuelve:
```json
{
  "error": "Acceso denegado",
  "detalle": "Tu rol (judicante) no tiene permiso para este recurso. Roles permitidos: administrador"
}
```

### 6.4 Protección contra ataques básicos

**Fuerza bruta en login:**
```nginx
limit_req_zone $binary_remote_addr zone=login_zone:10m rate=5r/m;
location /auth/ {
    limit_req zone=login_zone burst=5 nodelay;
    ...
}
```
Máximo 5 intentos de login por minuto por IP. Si se excede → `429 Too Many Requests`.

**Inyección NoSQL:**
Mongoose valida los tipos de datos en los esquemas. Un campo `email: { type: String }` no aceptará un objeto `{ $gt: "" }` como valor; Mongoose lo convierte a string `"[object Object]"`, que no coincidirá con ningún registro.

**Inyección de headers:**
El gateway usa `proxy_set_header` selectivo en Nginx (solo reenvía los headers necesarios). Los headers `X-User-*` son inyectados por el gateway después de verificar el JWT, por lo que un cliente no puede falsificar su propio rol enviando `X-User-Role: administrador`.

**CORS:**
El gateway acepta cualquier origen en desarrollo. En producción, configurar `ALLOWED_ORIGINS=https://lexim.com.co` en el `docker-compose.yml` para rechazar peticiones desde dominios no autorizados.

**Variables de entorno:**
Los secretos (`JWT_SECRET`, `MONGO_URI`) están en variables de entorno, nunca en el código. El `.gitignore` excluye los archivos `.env` del repositorio.

---

## 7. Escalabilidad

### 7.1 Situación actual (hasta ~200 usuarios)

La arquitectura actual de un solo servidor con Docker Compose soporta cómodamente 100–200 usuarios concurrentes porque:
- Los microservicios son **stateless**: no guardan estado en memoria entre peticiones; todo el estado está en MongoDB Atlas.
- JWT elimina la necesidad de sesiones compartidas entre instancias.
- MongoDB Atlas ya está en la nube con réplica automática.

### 7.2 Escalado de 200 a 1000 usuarios — pasos concretos

**Paso 1: Escalar instancias de microservicios (Docker Compose)**

Si un servicio específico se convierte en cuello de botella (por ejemplo, muchas peticiones a `/conciliacion`), se puede escalar solo ese servicio:

```bash
docker compose up --scale conciliacion-service=3 -d
```

Esto crea 3 contenedores del mismo servicio. Docker balancea automáticamente las peticiones entre ellos a través de su DNS interno (round-robin DNS).

**Paso 2: Balanceo de carga en Nginx**

Para balancear tráfico entre múltiples instancias del gateway:
```nginx
upstream api_gateway_cluster {
    server api-gateway-1:5000;
    server api-gateway-2:5000;
    server api-gateway-3:5000;
}

location /auth/ {
    proxy_pass http://api_gateway_cluster;
}
```

**Paso 3: Migrar a Docker Swarm o Kubernetes**

Para escenarios de 1000+ usuarios con alta disponibilidad real:
- **Docker Swarm:** Extiende Docker Compose a múltiples servidores físicos. Permite réplicas de cada servicio distribuidas en varios nodos.
- **Kubernetes:** Solución más completa con autoescalado automático basado en CPU/memoria, health checks avanzados, y despliegues sin downtime (rolling updates).

**Paso 4: Escalar MongoDB Atlas**

MongoDB Atlas permite escalar horizontalmente (sharding) para distribuir los datos entre múltiples servidores de base de datos. Para el volumen actual del Centro Lexim, el tier gratuito o M10 es suficiente. Con 1000 usuarios activos se recomendaría M20 o superior con auto-scaling habilitado.

### 7.3 Por qué la arquitectura actual facilita el escalado

La arquitectura de microservicios del sistema Lexim es escalable por diseño:

| Propiedad | Cómo ayuda al escalado |
|-----------|----------------------|
| **Servicios independientes** | Cada microservicio se puede escalar por separado; no es necesario replicar todo el sistema |
| **Sin estado en memoria** | Múltiples instancias del mismo servicio pueden atender peticiones sin sincronizarse entre sí |
| **JWT sin sesiones de servidor** | El token viaja con el cliente; no hay un session store compartido que se convierta en cuello de botella |
| **Base de datos cloud (Atlas)** | No se administra infraestructura de BD; Atlas escala independientemente de la aplicación |
| **Contenedores Docker** | Despliegue reproducible en cualquier servidor; migrar o replicar un servicio es un comando |

---

## Apéndice: Estructura del Proyecto

```
centro-conciliacion-lexim/
├── Dockerfile                    ← Imagen nginx (frontend + config)
├── docker-compose.yml            ← Orquestación de todos los servicios
├── nginx/nginx.conf              ← Configuración nginx (rate limiting, proxy)
│
├── Backend/Gateway/
│   ├── index.js                  ← API Gateway principal
│   ├── middleware/auth.js        ← Middleware JWT centralizado
│   └── package.json
│
├── auth-service/                 ← Microservicio: login + tareas
│   └── src/
│       ├── controllers/          ← auth.controller, task.controller
│       ├── models/               ← user.model, task.model
│       ├── routes/               ← auth.routes, task.routes
│       ├── services/auth.service.js
│       └── middlewares/auth.middleware.js
│
├── conciliacion-service/         ← Microservicio: casos de conciliación
│   └── src/server.js
│
├── usuarios-service/             ← Microservicio: gestión de usuarios (admin)
│   └── src/server.js
│
└── Frontend/
    ├── View/                     ← HTML (login, tareas, conciliación, etc.)
    └── Controller/               ← JS, CSS, imágenes
```

## Apéndice: Variables de Entorno

| Variable | Servicio | Descripción |
|----------|----------|-------------|
| `JWT_SECRET` | gateway, auth, conciliacion, usuarios | Clave para firmar/verificar tokens JWT. Debe ser idéntica en todos los servicios |
| `MONGO_URI` | auth, conciliacion, usuarios | Cadena de conexión a MongoDB Atlas |
| `MONGO_DB_NAME` | auth, conciliacion, usuarios | Nombre de la base de datos en Atlas |
| `AUTH_SERVICE_URL` | gateway | URL interna Docker del auth-service |
| `CONCILIACION_SERVICE_URL` | gateway | URL interna Docker del conciliacion-service |
| `USUARIOS_SERVICE_URL` | gateway | URL interna Docker del usuarios-service |
| `ALLOWED_ORIGINS` | gateway | Lista de dominios CORS permitidos (producción) |
| `PORT` | todos | Puerto de escucha del servicio |
