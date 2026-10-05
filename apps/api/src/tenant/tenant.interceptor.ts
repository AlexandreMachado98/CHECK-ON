import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // O JwtAuthGuard coloca o payload decodificado em req.user
    if (request.user && request.user.tenantId) {
      this.cls.set('tenantId', request.user.tenantId);
    }
    
    return next.handle();
  }
}
