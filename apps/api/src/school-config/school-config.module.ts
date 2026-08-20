import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { SchoolConfigService } from './school-config.service';
import { SchoolConfigController } from './school-config.controller';

@Module({
  imports: [AuthorizationModule],
  controllers: [SchoolConfigController],
  providers: [SchoolConfigService, PrismaService],
  exports: [SchoolConfigService],
})
export class SchoolConfigModule {}
