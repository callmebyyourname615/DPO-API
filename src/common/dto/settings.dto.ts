import { IsEmail, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
const safeUrl = /^(?:https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i;
const maybeUrl = (_object: unknown, value: unknown) => value !== undefined && value !== null && value !== '';
export class HomeIntroDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(30000) content?: string;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) imageUrl?: string | null;
}

export class SettingsDto {
  @ValidateIf(maybeUrl) @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(100) phone?: string;
  @IsOptional() @IsString() @MaxLength(1000) address?: string;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) facebookUrl?: string;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) youtubeUrl?: string;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) mapEmbedUrl?: string;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) footerAudioUrl?: string | null;
  @ValidateIf(maybeUrl) @IsString() @MaxLength(2048) @Matches(safeUrl) footerAudioUrl2?: string | null;
}
