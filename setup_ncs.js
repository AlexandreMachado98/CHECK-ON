const fs = require('fs');
const path = require('path');

const apiSrc = path.join(__dirname, 'apps/api/src');
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 1. Non Conformity (NC) Module
const ncPath = path.join(apiSrc, 'nc');
ensureDir(ncPath);
ensureDir(path.join(ncPath, 'dto'));

fs.writeFileSync(path.join(ncPath, 'dto/update-nc.dto.ts'), `import { IsOptional, IsString } from 'class-validator';

export class UpdateNcDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
`);

fs.writeFileSync(path.join(ncPath, 'nc.service.ts'), `import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNcDto } from './dto/update-nc.dto';

@Injectable()
export class NcService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.nonConformity.findMany({
      include: {
        answer: {
          include: {
            item: true,
            checklist: {
              include: { vehicle: true, driver: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: string, updateNcDto: UpdateNcDto) {
    const record = await this.prisma.nonConformity.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('NC não encontrada');

    const data: any = { ...updateNcDto };
    if (updateNcDto.status === 'RESOLVED') {
      data.resolvedAt = new Date();
    }

    return this.prisma.nonConformity.update({
      where: { id },
      data,
    });
  }
}
`);

fs.writeFileSync(path.join(ncPath, 'nc.controller.ts'), `import { Controller, Get, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { NcService } from './nc.service';
import { UpdateNcDto } from './dto/update-nc.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_EMPRESA', 'GESTOR')
@Controller('ncs')
export class NcController {
  constructor(private readonly ncService: NcService) {}

  @Get()
  findAll() {
    return this.ncService.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNcDto: UpdateNcDto) {
    return this.ncService.update(id, updateNcDto);
  }
}
`);

fs.writeFileSync(path.join(ncPath, 'nc.module.ts'), `import { Module } from '@nestjs/common';
import { NcService } from './nc.service';
import { NcController } from './nc.controller';

@Module({
  controllers: [NcController],
  providers: [NcService],
})
export class NcModule {}
`);

// 2. Storage Module
const storagePath = path.join(apiSrc, 'storage');
ensureDir(storagePath);

fs.writeFileSync(path.join(storagePath, 'storage.service.ts'), `import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  async uploadFile(fileBuffer: Buffer, fileName: string, mimetype: string): Promise<string> {
    this.logger.log(\`Mocking upload for file: \${fileName}\`);
    // Simulação do retorno de uma URL pública (S3/Cloudinary/Firebase)
    return \`https://storage.checkon.com/uploads/\${Date.now()}-\${fileName}\`;
  }
}
`);

fs.writeFileSync(path.join(storagePath, 'storage.module.ts'), `import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
`);

// Update AppModule
const appModulePath = path.join(apiSrc, 'app.module.ts');
let appModuleCode = fs.readFileSync(appModulePath, 'utf8');

if (!appModuleCode.includes('NcModule')) {
  appModuleCode = appModuleCode.replace("import { ChecklistModule } from './checklist/checklist.module';", "import { ChecklistModule } from './checklist/checklist.module';\nimport { NcModule } from './nc/nc.module';\nimport { StorageModule } from './storage/storage.module';");
  appModuleCode = appModuleCode.replace('ChecklistModule,', 'ChecklistModule,\n    NcModule,\n    StorageModule,');
  fs.writeFileSync(appModulePath, appModuleCode);
}
console.log('NC and Storage scaffolded.');
