const fs = require('fs');
const path = require('path');

const apiSrc = path.join(__dirname, 'apps/api/src');
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const resources = [
  { name: 'template', className: 'Template', fields: [{n: 'name', t: 'string', opt: false}, {n: 'description', t: 'string', opt: true}] },
  { name: 'checklist', className: 'Checklist', fields: [{n: 'templateId', t: 'string', opt: false}, {n: 'vehicleId', t: 'string', opt: false}, {n: 'driverId', t: 'string', opt: false}] }
];

function genDto(fields, isUpdate) {
  let imports = new Set(['IsNotEmpty', 'IsOptional', 'IsBoolean']);
  let fieldsStr = '';
  fields.forEach(f => {
    if (f.t === 'string') imports.add('IsString');
    if (f.t === 'number') imports.add('IsNumber');
    let decs = [];
    if (isUpdate || f.opt) decs.push('@IsOptional()');
    else decs.push('@IsNotEmpty()');
    if (f.t === 'string') decs.push('@IsString()');
    if (f.t === 'number') decs.push('@IsNumber()');
    fieldsStr += '  ' + decs.join('\n  ') + '\n  ' + f.n + (isUpdate || f.opt ? '?' : '') + ': ' + f.t + ';\n\n';
  });
  if (isUpdate) fieldsStr += '  @IsOptional()\n  @IsBoolean()\n  isActive?: boolean;\n';
  return "import { " + Array.from(imports).join(', ') + " } from 'class-validator';\n\nexport class " + (isUpdate ? 'Update' : 'Create') + "Dto {\n" + fieldsStr + "}\n";
}

resources.forEach(r => {
  const mPath = path.join(apiSrc, r.name);
  ensureDir(mPath);
  ensureDir(path.join(mPath, 'dto'));

  fs.writeFileSync(path.join(mPath, 'dto/create-' + r.name + '.dto.ts'), genDto(r.fields, false).replace(/CreateDto/g, 'Create' + r.className + 'Dto').replace(/\\\n/g, '\n'));
  fs.writeFileSync(path.join(mPath, 'dto/update-' + r.name + '.dto.ts'), genDto(r.fields, true).replace(/UpdateDto/g, 'Update' + r.className + 'Dto').replace(/\\\n/g, '\n'));

  const srv = 
"import { Injectable, NotFoundException } from '@nestjs/common';\n" +
"import { PrismaService } from '../prisma/prisma.service';\n" +
"import { Create" + r.className + "Dto } from './dto/create-" + r.name + ".dto';\n" +
"import { Update" + r.className + "Dto } from './dto/update-" + r.name + ".dto';\n\n" +
"@Injectable()\n" +
"export class " + r.className + "Service {\n" +
"  constructor(private readonly prisma: PrismaService) {}\n\n" +
"  async create(createDto: Create" + r.className + "Dto) {\n" +
"    return this.prisma." + r.name + ".create({ data: createDto as any });\n" +
"  }\n\n" +
"  async findAll() {\n" +
"    return this.prisma." + r.name + ".findMany({ orderBy: { createdAt: 'desc' } });\n" +
"  }\n\n" +
"  async findOne(id: string) {\n" +
"    const record = await this.prisma." + r.name + ".findUnique({ where: { id } });\n" +
"    if (!record) throw new NotFoundException('Registro não encontrado');\n" +
"    return record;\n" +
"  }\n\n" +
"  async update(id: string, updateDto: Update" + r.className + "Dto) {\n" +
"    await this.findOne(id);\n" +
"    return this.prisma." + r.name + ".update({ where: { id }, data: updateDto as any });\n" +
"  }\n\n" +
"  async remove(id: string) {\n" +
"    await this.findOne(id);\n" +
"    return this.prisma." + r.name + ".delete({ where: { id } });\n" +
"  }\n" +
"}\n";
  fs.writeFileSync(path.join(mPath, r.name + '.service.ts'), srv);

  const ctrl = 
"import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';\n" +
"import { " + r.className + "Service } from './" + r.name + ".service';\n" +
"import { Create" + r.className + "Dto } from './dto/create-" + r.name + ".dto';\n" +
"import { Update" + r.className + "Dto } from './dto/update-" + r.name + ".dto';\n" +
"import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';\n" +
"import { RolesGuard } from '../auth/guards/roles.guard';\n" +
"import { Roles } from '../auth/decorators/roles.decorator';\n\n" +
"@UseGuards(JwtAuthGuard, RolesGuard)\n" +
"@Roles('ADMIN_EMPRESA', 'GESTOR')\n" +
"@Controller('" + r.name + "s')\n" +
"export class " + r.className + "Controller {\n" +
"  constructor(private readonly service: " + r.className + "Service) {}\n\n" +
"  @Post()\n" +
"  create(@Body() createDto: Create" + r.className + "Dto) { return this.service.create(createDto); }\n\n" +
"  @Get()\n" +
"  findAll() { return this.service.findAll(); }\n\n" +
"  @Get(':id')\n" +
"  findOne(@Param('id') id: string) { return this.service.findOne(id); }\n\n" +
"  @Patch(':id')\n" +
"  update(@Param('id') id: string, @Body() updateDto: Update" + r.className + "Dto) { return this.service.update(id, updateDto); }\n\n" +
"  @Delete(':id')\n" +
"  remove(@Param('id') id: string) { return this.service.remove(id); }\n" +
"}\n";
  fs.writeFileSync(path.join(mPath, r.name + '.controller.ts'), ctrl);

  const mod = 
"import { Module } from '@nestjs/common';\n" +
"import { " + r.className + "Service } from './" + r.name + ".service';\n" +
"import { " + r.className + "Controller } from './" + r.name + ".controller';\n\n" +
"@Module({\n" +
"  controllers: [" + r.className + "Controller],\n" +
"  providers: [" + r.className + "Service],\n" +
"})\n" +
"export class " + r.className + "Module {}\n";
  fs.writeFileSync(path.join(mPath, r.name + '.module.ts'), mod);
});

// Update AppModule
const appModulePath = path.join(apiSrc, 'app.module.ts');
let appModuleCode = fs.readFileSync(appModulePath, 'utf8');

const importsToAdd = resources.map(r => "import { " + r.className + "Module } from './" + r.name + "/" + r.name + ".module';").join('\n');
if (!appModuleCode.includes('TemplateModule')) {
  appModuleCode = appModuleCode.replace("import { VehicleModule } from './vehicle/vehicle.module';", "import { VehicleModule } from './vehicle/vehicle.module';\n" + importsToAdd);
  const moduleList = resources.map(r => r.className + "Module").join(',\n    ');
  appModuleCode = appModuleCode.replace('VehicleModule,', 'VehicleModule,\n    ' + moduleList + ',');
  fs.writeFileSync(appModulePath, appModuleCode);
}
console.log('Checklists scaffolded.');
