import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateIf, IsDateString } from 'class-validator';
const status = ['draft', 'published'];
const safeUrl = /^(?:https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i;
const maybeUrl = (_object: unknown, value: unknown) => value !== undefined && value !== null && value !== '';
export class NewsDto {
  @IsOptional() @IsString() @MaxLength(200) @Matches(/\S/u) title?: string;
  @IsOptional() @IsString() @MaxLength(200) @Matches(/^[^\s/?#]+$/u) slug?: string;
  @IsOptional() @IsIn(['news','activity','announcement','international']) category?: string;
  @IsOptional() @IsString() @MaxLength(500) excerpt?: string;
  @IsOptional() @IsString() @MaxLength(100000) @Matches(/\S/u) content?: string;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) coverImageUrl?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({each:true}) @Matches(safeUrl, {each:true}) gallery?: string[];
  @ValidateIf(maybeUrl) @IsDateString() publishedAt?: string | null;
  @IsOptional() @IsIn(status) status?: string;
}
