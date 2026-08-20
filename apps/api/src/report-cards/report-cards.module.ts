import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaService } from '../common/prisma.service';
import { ReportCardsController } from './report-cards.controller';
import { ReportCardsService } from './report-cards.service';

@Module({ imports: [AuthorizationModule], controllers: [ReportCardsController], providers: [ReportCardsService, PrismaService] })
export class ReportCardsModule {}
