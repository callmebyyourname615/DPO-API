import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
const status = ['draft', 'published'];
export class FaqDto {
  @IsOptional() @IsString() @MaxLength(300) @Matches(/\S/u) question?: string;
  @IsOptional() @IsString() @MaxLength(30000) @Matches(/\S/u) answer?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) order?: number;
  @IsOptional() @IsIn(status) status?: string;
}
