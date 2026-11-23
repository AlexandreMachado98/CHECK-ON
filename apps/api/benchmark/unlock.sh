#!/bin/bash
# Limpa os bloqueios de login do banco do benchmark (entre execuções do teste de segurança).
PGPASSWORD=bench psql -h localhost -U bench -d checkon_bench -qtAc 'delete from "RateLimit"; update "User" set "failedLoginCount" = 0, "lockedUntil" = null'
