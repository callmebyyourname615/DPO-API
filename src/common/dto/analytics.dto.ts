import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class VisitorEventDto {
  @IsUUID('4') id!: string;
  @IsUUID('4') visitorId!: string;
  @IsUUID('4') sessionId!: string;
  @IsString() @MaxLength(500) @Matches(/^\/(?!\/)[^?#\s\x00-\x1f\x7f]*$/u) path!: string;
  @IsOptional() @IsString() @MaxLength(200) @Matches(/^[^\x00-\x1f\x7f]*$/u) title = '';
  @IsOptional() @IsString() @MaxLength(2048) referrer = '';
}

export class VisitorReportQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @Matches(/^[A-Z]{2}$/) country?: string;
  @IsOptional() @IsIn(['desktop', 'mobile', 'tablet', 'unknown']) device?: string;
  @IsOptional() @IsString() @MaxLength(500) @Matches(/^\/(?!\/)[^?#\s\x00-\x1f\x7f]*$/u) path?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) @Max(100) limit = 20;
}
