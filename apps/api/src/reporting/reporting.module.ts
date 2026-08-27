import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaService } from '../common/prisma.service';
import { ReportExportProcessor } from './report-export.processor';
import { ReportExportQueue } from './report-export.queue';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [ReportingController],
  providers: [ReportingService, ReportExportProcessor, ReportExportQueue, PrismaService],
})
export class ReportingModule {}
