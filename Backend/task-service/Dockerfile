# ARCHIVO: Backend/task-service/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY Backend/task-service/package*.json ./
RUN npm install --omit=dev

COPY Backend/task-service/ .

EXPOSE 3006

CMD ["node", "src/server.js"]
