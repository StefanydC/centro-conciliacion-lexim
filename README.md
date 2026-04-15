# centro-conciliacion-lexim
Proyecto pagina web centro de conciliacion lexim

## Ejecutar con Docker

1. Construir y levantar servicios:

```bash
docker compose up --build
```

2. Abrir frontend:

```text
http://localhost
```

## Ejecutar en CMD (manual)

1. Preparar variables de auth-service:

```bash
cd auth-service
copy .env.example .env
```

Edita `.env` para entorno local (por ejemplo `MONGO_URI=mongodb://127.0.0.1:27017/auth_service` y un `JWT_SECRET` propio).

2. Levantar MongoDB local en 27017.

3. Levantar auth-service:

```bash
start-auth-service.cmd
```

4. Levantar nginx local (sin Docker):

Requisito: tener `nginx.exe` instalado y disponible en `PATH`.

```bash
start-nginx.cmd
```

Para detener nginx:

```bash
stop-nginx.cmd
```

5. Abrir frontend:

```text
http://localhost
```

## Compatibilidad del login

El login ahora prueba automaticamente estos endpoints hasta conectar:

- /auth/login (cuando hay proxy de nginx o mismo host)
- http://localhost:3001/auth/login
- http://127.0.0.1:3001/auth/login

Con esto funciona tanto en Docker como en ejecucion manual por CMD.

## Comandos rapidos

Docker (todo junto):

```bash
docker compose up --build
```

Detener y limpiar contenedores:

```bash
docker compose down
```

Manual (por servicios):

```bash
start-auth-service.cmd
start-nginx.cmd
```

Tambien puedes usar scripts npm desde la raiz:

```bash
npm run start:auth
npm run start:nginx
```
