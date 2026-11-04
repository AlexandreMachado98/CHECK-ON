import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getInfo() {
    return this.appService.getInfo();
  }

  /** Usado pelo serviço de hospedagem para saber se a API e o banco estão respondendo. */
  @Get('health')
  async health() {
    const result = await this.appService.health();
    if (result.database !== 'ok') throw new ServiceUnavailableException(result);
    return result;
  }
}
