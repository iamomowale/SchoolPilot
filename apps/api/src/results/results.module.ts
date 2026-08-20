import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaService } from '../common/prisma.service';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({ imports: [AuthorizationModule], controllers: [ResultsController], providers: [ResultsService, PrismaService] })
export class ResultsModule {}
