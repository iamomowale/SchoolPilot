import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ExampleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;
}
