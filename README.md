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

1. Levantar MongoDB local en 27017.

2. Levantar backend auth:

```bash
cd Backend
npm install
npm start
```

3. Levantar gateway:

```bash
cd Backend/Gateway
npm install
npm start
```

4. Levantar frontend con Live Server o servidor estatico y abrir login.

## Compatibilidad del login

El login ahora prueba automaticamente estos endpoints hasta conectar:

- /auth/login (cuando hay proxy de nginx o mismo host)
- http://localhost:5000/auth/login
- http://127.0.0.1:5000/auth/login
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
cd Backend
npm install
npm start
```

```bash
cd Backend/Gateway
npm install
npm start
```
