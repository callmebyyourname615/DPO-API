import { IsIn, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
const status = ['draft', 'published'];
const safeUrl = /^(?:https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i;
const maybeUrl = (_object: unknown, value: unknown) => value !== undefined && value !== null && value !== '';
export class PageDto {
  @IsOptional() @IsString() @MaxLength(200) @Matches(/\S/u) title?: string;
  @IsOptional() @IsString() @MaxLength(200) @Matches(/^[^\s/?#]+$/u) slug?: string;
  @IsOptional() @IsString() @MaxLength(100000) @Matches(/\S/u) content?: string;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) imageUrl?: string | null;
  @IsOptional() @IsIn(status) status?: string;
}
