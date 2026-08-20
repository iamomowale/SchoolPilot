import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { StudentManagementController } from './student-management.controller';
import { StudentManagementService } from './student-management.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [StudentManagementController],
  providers: [StudentManagementService, PrismaService],
  exports: [StudentManagementService],
})
export class StudentManagementModule {}
