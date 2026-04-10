#imagen base (investigar que es daniel)
FROM node:20
#crear carpeta de la aplicacion
WORKDIR /app
#copiar dependencias
COPY package*.json ./
#instalar dependencias  
RUN npm install
#copiar el resto de la aplicacion
COPY . .
#exponer el puerto
EXPOSE 3001
#comando para iniciar la aplicacion
CMD [ "node", "server.js" ]
