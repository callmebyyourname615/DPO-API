import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf, IsDateString } from 'class-validator';
const status = ['draft', 'published'];
const safeUrl = /^(?:https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i;
const maybeUrl = (_object: unknown, value: unknown) => value !== undefined && value !== null && value !== '';
export class DocumentDto {
  @IsOptional() @IsString() @MaxLength(250) @Matches(/\S/u) title?: string;
  @IsOptional() @IsIn(['decree','agreement','notice','form','guideline','fsnp','general']) category?: string;
  @ValidateIf(maybeUrl) @IsDateString() documentDate?: string | null;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) fileUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string | null;
  @IsOptional() @IsIn(['pdf','xlsx']) fileType?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(104857600) fileSize?: number | null;
  @IsOptional() @IsIn(['available','missing','processing']) fileStatus?: string;
  @IsOptional() @IsIn(status) status?: string;
}
