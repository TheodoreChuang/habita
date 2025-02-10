FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
