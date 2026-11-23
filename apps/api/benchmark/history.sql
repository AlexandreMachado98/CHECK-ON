-- 90 dias de histórico: 1 inspeção por veículo por dia, ~2% de itens não conformes, NCs abertas/resolvidas.
\timing on
CREATE TEMP TABLE tv AS
SELECT v.id, v."tenantId", f."unitId", row_number() OVER (ORDER BY v.plate) AS n,
       CASE WHEN f.name LIKE 'Máquinas%' THEN 'Diário máquina' ELSE 'Diário caminhão' END AS tname
FROM "Vehicle" v JOIN "Fleet" f ON f.id = v."fleetId" JOIN "Tenant" t ON t.id = v."tenantId" WHERE t.code = 'FROTA250';

CREATE TEMP TABLE te AS
SELECT e.id, eu."unitId", row_number() OVER (PARTITION BY eu."unitId" ORDER BY e.matricula) - 1 AS k,
       count(*) OVER (PARTITION BY eu."unitId") AS total
FROM "Employee" e JOIN "EmployeeUnit" eu ON eu."employeeId" = e.id JOIN "Tenant" t ON t.id = e."tenantId" WHERE t.code = 'FROTA250';

INSERT INTO "Checklist" (id, "tenantId", "templateId", "vehicleId", "driverId", "clientId", "templateVersion", "templateName",
  status, "startedAt", "completedAt", "syncedAt", "signedName", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, tv."tenantId", tp.id, tv.id, te.id, gen_random_uuid()::text, tp.version, tp.name, 'SYNCED',
       ts, ts + interval '12 minutes', ts + interval '13 minutes', 'Motorista', ts, ts
FROM tv
JOIN "Template" tp ON tp."tenantId" = tv."tenantId" AND tp.name = tv.tname
CROSS JOIN generate_series(1, 90) AS d(day)
CROSS JOIN LATERAL (SELECT date_trunc('day', now()) - (d.day || ' days')::interval + interval '9 hours' + ((tv.n % 120) || ' minutes')::interval AS ts) x
JOIN te ON te."unitId" = tv."unitId" AND te.k = (tv.n + d.day) % te.total;

INSERT INTO "ChecklistAnswer" (id, "tenantId", "checklistId", "itemId", "isCompliant", "numberValue", "itemText", "itemType", "itemIsCritical", "categoryName", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."tenantId", c.id, i.id,
       CASE WHEN i.type = 'PASS_FAIL' THEN random() > 0.02 ELSE true END,
       CASE WHEN i.type = 'NUMBER' THEN round((random() * 300000)::numeric) ELSE NULL END,
       i.text, i.type, i."isCritical", cat.name, c."completedAt", c."completedAt"
FROM "Checklist" c
JOIN "TemplateCategory" cat ON cat."templateId" = c."templateId"
JOIN "TemplateItem" i ON i."categoryId" = cat.id
WHERE c."tenantId" = (SELECT id FROM "Tenant" WHERE code = 'FROTA250');

-- Uma NC por resposta não conforme; as dos últimos 3 dias ficam abertas, o resto resolvido.
INSERT INTO "NonConformity" (id, "tenantId", "answerId", "vehicleId", "itemId", status, severity, occurrences, "lastOccurrenceAt", "resolvedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, a."tenantId", a.id, c."vehicleId", a."itemId",
       CASE WHEN c."completedAt" > now() - interval '3 days' THEN 'OPEN' ELSE 'RESOLVED' END,
       CASE WHEN a."itemIsCritical" THEN 'CRITICAL' ELSE 'MEDIUM' END,
       1, c."completedAt",
       CASE WHEN c."completedAt" > now() - interval '3 days' THEN NULL ELSE c."completedAt" + interval '2 days' END,
       c."completedAt", c."completedAt"
FROM "ChecklistAnswer" a JOIN "Checklist" c ON c.id = a."checklistId"
WHERE a."isCompliant" = false AND a."tenantId" = (SELECT id FROM "Tenant" WHERE code = 'FROTA250');

UPDATE "Vehicle" v SET status = CASE WHEN EXISTS (SELECT 1 FROM "NonConformity" n WHERE n."vehicleId" = v.id AND n.status = 'OPEN' AND n.severity = 'CRITICAL') THEN 'BLOQUEADO'
  WHEN EXISTS (SELECT 1 FROM "NonConformity" n WHERE n."vehicleId" = v.id AND n.status = 'OPEN') THEN 'ATENCAO' ELSE 'LIBERADO' END
WHERE v."tenantId" = (SELECT id FROM "Tenant" WHERE code = 'FROTA250');

ANALYZE;
SELECT (SELECT count(*) FROM "Checklist") AS checklists, (SELECT count(*) FROM "ChecklistAnswer") AS respostas,
       (SELECT count(*) FROM "NonConformity") AS ncs, (SELECT count(*) FROM "NonConformity" WHERE status = 'OPEN') AS ncs_abertas,
       (SELECT status || '=' || count(*) FROM "Vehicle" GROUP BY status ORDER BY 1 LIMIT 1) AS ex_status,
       pg_size_pretty(pg_database_size('checkon_bench')) AS tamanho;
