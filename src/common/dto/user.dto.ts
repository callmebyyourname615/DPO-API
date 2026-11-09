import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
export class CreateUserDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MaxLength(120) @Matches(/\S/u) name: string;
  @IsString() @MaxLength(128) @Matches(/^.{6,}$/s) password: string;
  @IsIn(['admin','editor','viewer']) role: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(120) @Matches(/\S/u) name?: string;
  @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(128) @Matches(/^.{6,}$/s) password?: string;
  @IsOptional() @IsIn(['admin','editor','viewer']) role?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
