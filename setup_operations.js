const fs = require('fs');
const path = require('path');

const apiSrc = path.join(__dirname, 'apps/api/src');
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const resources = [
  {
    name: 'unit',
    className: 'Unit',
    dtoFields: [
      { name: 'name', type: 'string', isOptional: false },
    ],
  },
  {
    name: 'department',
    className: 'Department',
    dtoFields: [
      { name: 'name', type: 'string', isOptional: false },
    ],
  },
  {
    name: 'employee',
    className: 'Employee',
    dtoFields: [
      { name: 'name', type: 'string', isOptional: false },
      { name: 'matricula', type: 'string', isOptional: true },
      { name: 'jobTitle', type: 'string', isOptional: true },
    ],
  },
  {
    name: 'fleet',
    className: 'Fleet',
    dtoFields: [
      { name: 'name', type: 'string', isOptional: false },
      { name: 'unitId', type: 'string', isOptional: false },
    ],
  },
  {
    name: 'vehicle',
    className: 'Vehicle',
    dtoFields: [
      { name: 'plate', type: 'string', isOptional: false },
      { name: 'fleetId', type: 'string', isOptional: false },
      { name: 'prefix', type: 'string', isOptional: true },
      { name: 'brand', type: 'string', isOptional: true },
      { name: 'model', type: 'string', isOptional: true },
      { name: 'year', type: 'number', isOptional: true },
    ],
  }
];

function generateDtoContent(fields, isUpdate) {
  let imports = new Set(['IsNotEmpty', 'IsOptional', 'IsBoolean']);
  let fieldsStr = '';

  fields.forEach(f => {
    if (f.type === 'string') imports.add('IsString');
    if (f.type === 'number') imports.add('IsNumber');
    
    let decorators = [];
    if (isUpdate || f.isOptional) {
      decorators.push('@IsOptional()');
    } else {
      decorators.push('@IsNotEmpty()');
    }

    if (f.type === 'string') decorators.push('@IsString()');
    if (f.type === 'number') decorators.push('@IsNumber()');

    fieldsStr += `  ${decorators.join('\\n  ')}\n  ${f.name}${isUpdate || f.isOptional ? '?' : ''}: ${f.type};\n\n`;
  });

  if (isUpdate) {
    fieldsStr += `  @IsOptional()\n  @IsBoolean()\n  isActive?: boolean;\n`;
  }

  return `import { ${Array.from(imports).join(', ')} } from 'class-validator';\n\nexport class ${isUpdate ? 'Update' : 'Create'}Dto {\n${fieldsStr}}\n`;
}

resources.forEach(res => {
  const modPath = path.join(apiSrc, res.name);
  ensureDir(modPath);
  ensureDir(path.join(modPath, 'dto'));

  // Create DTO
  fs.writeFileSync(path.join(modPath, \`dto/create-\${res.name}.dto.ts\`), generateDtoContent(res.dtoFields, false).replace(/CreateDto/g, \`Create\${res.className}Dto\`));
  fs.writeFileSync(path.join(modPath, \`dto/update-\${res.name}.dto.ts\`), generateDtoContent(res.dtoFields, true).replace(/UpdateDto/g, \`Update\${res.className}Dto\`));

  // Create Service
  fs.writeFileSync(path.join(modPath, \`\${res.name}.service.ts\`), \`import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Create\${res.className}Dto } from './dto/create-\${res.name}.dto';
import { Update\${res.className}Dto } from './dto/update-\${res.name}.dto';

@Injectable()
export class \${res.className}Service {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: Create\${res.className}Dto) {
    return this.prisma.\${res.name}.create({
      data: createDto as any,
    });
  }

  async findAll() {
    return this.prisma.\${res.name}.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.\${res.name}.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Registro não encontrado');
    return record;
  }

  async update(id: string, updateDto: Update\${res.className}Dto) {
    await this.findOne(id);
    return this.prisma.\${res.name}.update({
      where: { id },
      data: updateDto as any,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.\${res.name}.delete({
      where: { id },
    });
  }
}
\`);

  // Create Controller
  fs.writeFileSync(path.join(modPath, \`\${res.name}.controller.ts\`), \`import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { \${res.className}Service } from './\${res.name}.service';
import { Create\${res.className}Dto } from './dto/create-\${res.name}.dto';
import { Update\${res.className}Dto } from './dto/update-\${res.name}.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_EMPRESA', 'GESTOR') // Rotas base acessíveis à gestão
@Controller('\${res.name}s')
export class \${res.className}Controller {
  constructor(private readonly \${res.name}Service: \${res.className}Service) {}

  @Post()
  create(@Body() createDto: Create\${res.className}Dto) {
    return this.\${res.name}Service.create(createDto);
  }

  @Get()
  findAll() {
    return this.\${res.name}Service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.\${res.name}Service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: Update\${res.className}Dto) {
    return this.\${res.name}Service.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.\${res.name}Service.remove(id);
  }
}
\`);

  // Create Module
  fs.writeFileSync(path.join(modPath, \`\${res.name}.module.ts\`), \`import { Module } from '@nestjs/common';
import { \${res.className}Service } from './\${res.name}.service';
import { \${res.className}Controller } from './\${res.name}.controller';

@Module({
  controllers: [\${res.className}Controller],
  providers: [\${res.className}Service],
})
export class \${res.className}Module {}
\`);

});

// Update AppModule
const appModulePath = path.join(apiSrc, 'app.module.ts');
let appModuleCode = fs.readFileSync(appModulePath, 'utf8');

const importsToAdd = resources.map(r => \`import { \${r.className}Module } from './\${r.name}/\${r.name}.module';\`).join('\\n');
appModuleCode = appModuleCode.replace("import { UserModule } from './user/user.module';", \`import { UserModule } from './user/user.module';\\n\${importsToAdd}\`);

const moduleList = resources.map(r => \`\${r.className}Module\`).join(',\\n    ');
appModuleCode = appModuleCode.replace('UserModule,', \`UserModule,\\n    \${moduleList},\`);

fs.writeFileSync(appModulePath, appModuleCode);

console.log('Operational CRUDs scaffolded.');
