import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
const status = ['draft', 'published'];
const safeUrl = /^(?:https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i;
const maybeUrl = (_object: unknown, value: unknown) => value !== undefined && value !== null && value !== '';
export class PartnerDto {
  @IsOptional() @IsString() @MaxLength(200) @Matches(/\S/u) name?: string;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) logoUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) address?: string;
  @IsOptional() @IsString() @MaxLength(100) phone?: string;
  @ValidateIf(maybeUrl) @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(2048) @Matches(/^https?:\/\/[^\s]+$/i) url?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) order?: number;
  @IsOptional() @IsIn(status) status?: string;
}
