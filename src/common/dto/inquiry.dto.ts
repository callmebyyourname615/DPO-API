import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
export class InquiryCreateDto {
  @IsString() @MaxLength(120) @Matches(/\S/u) name: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsString() @MaxLength(5000) @Matches(/\S/u) message: string;
  @IsOptional() @IsIn(['contact', 'faq']) source?: string;
}

export class InquiryUpdateDto { @IsIn(['new', 'in_progress', 'resolved', 'archived']) status: string; }
