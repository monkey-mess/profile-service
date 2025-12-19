#!/bin/sh

set -e

echo "Waiting for PostgreSQL to be ready..."

until pg_isready -h postgres -U ${DB_USER} -d ${DB_NAME}; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is ready!"

echo "Running database migrations..."
npx prisma migrate dev --name init

echo "Starting the application..."
exec npm start