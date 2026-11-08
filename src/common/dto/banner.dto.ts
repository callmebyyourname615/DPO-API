import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
const status = ['draft', 'published'];
const safeUrl = /^(?:https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i;
const maybeUrl = (_object: unknown, value: unknown) => value !== undefined && value !== null && value !== '';
export class BannerDto {
  @IsOptional() @IsString() @MaxLength(200) @Matches(/\S/u) title?: string;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) imageUrl?: string | null;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) linkUrl?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) order?: number;
  @IsOptional() @IsIn(status) status?: string;
}
