import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
export class CreateUserDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MaxLength(120) @Matches(/\S/u) name: string;
  @IsString() @MaxLength(128) @Matches(/^.{12,}$/s) password: string;
  @IsIn(['admin','editor','viewer']) role: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(120) @Matches(/\S/u) name?: string;
  @IsOptional() @IsString() @MaxLength(128) @Matches(/^.{12,}$/s) password?: string;
  @IsOptional() @IsIn(['admin','editor','viewer']) role?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
