import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

export class ChatMessageDto {
  @IsIn(['user', 'assistant']) role: 'user' | 'assistant';
  @IsString() @Matches(/\S/u) @MaxLength(2000) text: string;
}
export class ChatDto {
  @IsString() @Matches(/\S/u) @MaxLength(500) message: string;
  @IsOptional() @IsIn(['lo', 'en', 'th']) locale?: 'lo' | 'en' | 'th';
  @IsOptional() @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => ChatMessageDto) history?: ChatMessageDto[];
}
