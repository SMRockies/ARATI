import { IsEmail, IsOptional, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class CreateOrganizationUserDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @Length(1, 200)
  displayName!: string;

  @IsString()
  @Length(1, 80)
  roleCode!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
