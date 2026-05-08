# ARCHIVO: Backend/user-auth-service/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY Backend/user-auth-service/package*.json ./
RUN npm install --omit=dev

COPY Backend/user-auth-service/ .

EXPOSE 3001

CMD ["node", "src/server.js"]
