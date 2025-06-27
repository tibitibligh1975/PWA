FROM node:18-alpine

WORKDIR /app

# Copiar arquivos de dependência primeiro
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar o resto dos arquivos
COPY . .

# Expor a porta que o app usa
EXPOSE 3000

# Comando para iniciar o app
CMD ["npm", "start"] 