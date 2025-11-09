# Используем образ линукс альпайн с версией node 19.5.0
FROM node:19.5.0-alpine

# Указываем нашу рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Копируем Prisma схему ДО установки зависимостей
COPY prisma ./prisma/

# Устанавливаем зависимости
RUN npm install

# Генерируем Prisma client (после копирования schema.prisma)
RUN npx prisma generate

# Копируем оставшееся приложение
COPY . .

# Открыть порт в контейнере
EXPOSE 3000

# Запускаем сервер
CMD ["npm", "start"]