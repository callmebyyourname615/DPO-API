import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

export class ChatMessageDto {
  @IsIn(['user', 'assistant']) role: 'user' | 'assistant';
  @IsString() @Matches(/\S/u) @MaxLength(2000) text: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) @MaxLength(500, { each: true }) choices?: string[];
}
export class ChatLocaleDto {
  @IsOptional() @IsIn(['lo', 'en']) locale?: 'lo' | 'en';
}
export class ChatDto extends ChatLocaleDto {
  @IsString() @Matches(/\S/u) @MaxLength(500) message: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => ChatMessageDto) history?: ChatMessageDto[];
}
