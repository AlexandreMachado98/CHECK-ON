import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { EmployeeService } from './employee.service';

@Controller('public/badges')
export class PublicBadgeController {
  constructor(private readonly service: EmployeeService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store, private')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @Header('Referrer-Policy', 'no-referrer')
  async findByToken(@Param('token') token: string) {
    const badge = await this.service.findPublicBadge(token);
    if (!badge) throw new NotFoundException('Este crachá não existe, foi revogado ou está inativo.');
    return badge;
  }
}
