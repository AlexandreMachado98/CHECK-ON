#!/bin/bash
# Benchmark completo, do zero: banco novo, empresa com 250 veículos e 90 dias de histórico,
# testes de velocidade/carga, conferência das contagens e testes de segurança.
# Requer PostgreSQL local (o papel "bench" é criado aqui) e a API compilada (npm run build).
set -e
cd "$(dirname "$0")"
su postgres -c "psql -q -c \"do \\\$\\\$ begin if not exists (select from pg_roles where rolname='bench') then create role bench login password 'bench' createdb; end if; end \\\$\\\$;\""
./reset.sh
./start-api.sh
node setup.mjs
node access.mjs
PGPASSWORD=bench psql -h localhost -U bench -d checkon_bench -q -f history.sql 2>&1 | grep -v WARNING
node verify.mjs
node bench.mjs
./unlock.sh
node security.mjs
