import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create a Primary Tenant (System Owner)
  const masterTenant = await prisma.tenant.upsert({
    where: { cnpj: '00000000000000' },
    update: {},
    create: {
      name: 'CHECK-ON PLATAFORMA',
      cnpj: '00000000000000',
      plan: 'ENTERPRISE',
    },
  });

  // 2. Create Roles for the Master Tenant
  const superAdminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: masterTenant.id,
        name: 'SUPER_ADMIN',
      },
    },
    update: {},
    create: {
      tenantId: masterTenant.id,
      name: 'SUPER_ADMIN',
      permissions: ['*'],
      isSystem: true,
    },
  });

  // 3. Create Super Admin User
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@checkon.com' },
    update: {
      passwordHash: hash,
    },
    create: {
      tenantId: masterTenant.id,
      email: 'admin@checkon.com',
      name: 'Administrador do Sistema',
      passwordHash: hash,
      roleId: superAdminRole.id,
    },
  });

  // 4. Create an Example Customer Tenant (Empresa A)
  const empA = await prisma.tenant.upsert({
    where: { cnpj: '11111111111111' },
    update: {},
    create: {
      name: 'Transportes Alpha',
      cnpj: '11111111111111',
      plan: 'PRO',
    },
  });

  // 5. Create Role for Empresa A
  const gestorRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: empA.id,
        name: 'GESTOR',
      },
    },
    update: {},
    create: {
      tenantId: empA.id,
      name: 'GESTOR',
      permissions: ['users:read', 'users:write', 'vehicles:read', 'vehicles:write'],
      isSystem: true,
    },
  });

  // 6. Create Gestor User
  await prisma.user.upsert({
    where: { email: 'gestor@alpha.com' },
    update: {
      passwordHash: hash,
    },
    create: {
      tenantId: empA.id,
      email: 'gestor@alpha.com',
      name: 'Gestor Alpha',
      passwordHash: hash,
      roleId: gestorRole.id,
    },
  });

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
