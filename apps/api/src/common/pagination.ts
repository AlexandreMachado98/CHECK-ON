import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Parâmetros de lista paginada. Sem "page", a rota mantém o formato antigo (lista completa). */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export function pageArgs(query: PageQueryDto) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export class ChecklistPageQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['ALL', 'IN_PROGRESS', 'COMPLETED', 'SYNCED'])
  status?: string;
}

export class NcPageQueryDto extends PageQueryDto {
  /** ACTIVE = abertas + em tratativa. */
  @IsOptional()
  @IsIn(['ALL', 'ACTIVE', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsIn(['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: string;
}
