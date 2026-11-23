#!/bin/bash
# Recria o banco do benchmark do zero (migrações + seed do super admin).
set -e
su postgres -c "psql -q -c 'drop database if exists checkon_bench with (force)' -c 'create database checkon_bench owner bench'"
cd "$(dirname "$0")/.."
export DATABASE_URL="postgresql://bench:bench@localhost:5432/checkon_bench" DIRECT_URL="postgresql://bench:bench@localhost:5432/checkon_bench"
npx prisma migrate deploy >/dev/null 2>&1
npx prisma db seed >/dev/null 2>&1
echo "banco recriado"
