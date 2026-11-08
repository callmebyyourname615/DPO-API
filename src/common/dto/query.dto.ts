import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
export class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 10;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsString() @MaxLength(50) category?: string;
  @IsOptional() @IsString() @MaxLength(50) status?: string;
}

export class SlugQueryDto {
  @IsString() @MaxLength(200) @Matches(/^[^\s/?#]+$/u) slug: string;
  @IsOptional() @IsString() @MaxLength(64) excludeId?: string;
}
