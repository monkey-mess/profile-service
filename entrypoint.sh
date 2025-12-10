#!/bin/sh

set -e

echo "Waiting for PostgreSQL to be ready..."

echo "${DB_HOST} ${DB_USER} ${DB_NAME}"

until pg_isready -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME}; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is ready!"

echo "Running database migrations..."
npx prisma migrate dev --name init

echo "Starting the application..."
exec npm start
