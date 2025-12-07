# Используем образ линукс альпайн с версией node 19.5.0
FROM node:19.5.0-alpine

# Устанавливаем postgresql-client для проверки доступности БД
RUN apk add --no-cache postgresql-client

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

# УБИРАЕМ миграции из сборки - они будут выполняться при запуске
# RUN npx prisma migrate dev --name init

# Копируем оставшееся приложение
COPY . .

# Копируем entrypoint скрипт
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Компилируем TypeScript
RUN npm run build

# Открыть порт в контейнере
EXPOSE 3000

# Используем entrypoint вместо CMD
ENTRYPOINT ["/app/entrypoint.sh"]