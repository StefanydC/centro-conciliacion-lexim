FROM node:18-alpine

WORKDIR /app

# Instalar dependencias primero (cache layer)
COPY package*.json ./
RUN npm install --omit=dev

# Copiar código fuente
COPY src ./src

# La carpeta de credenciales se monta como volumen en docker-compose
# No se incluye en la imagen por seguridad
RUN mkdir -p /app/credentials

EXPOSE 3004

CMD ["node", "src/server.js"]
