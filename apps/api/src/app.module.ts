import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { PrismaService } from './common/prisma.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { ExampleController } from './common/example.controller';
import { AuthModule } from './auth/auth.module';
import { RateLimitMiddleware } from './auth/rate-limit.middleware';
import { AuthorizationModule } from './authorization/authorization.module';
import { SchoolConfigModule } from './school-config/school-config.module';
import { StudentManagementModule } from './student-management/student-management.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ResultsModule } from './results/results.module';
import { ReportCardsModule } from './report-cards/report-cards.module';
import { FinanceModule } from './finance/finance.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ReportingModule } from './reporting/reporting.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [AuthModule, AuthorizationModule, SchoolConfigModule, StudentManagementModule, AttendanceModule, ResultsModule, ReportCardsModule, FinanceModule, AnnouncementsModule, ReportingModule, UploadsModule],
  controllers: [HealthController, ExampleController],
  providers: [
    PrismaService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    consumer.apply(RateLimitMiddleware).forRoutes('auth/login', 'auth/refresh', 'auth/forgot-password', 'auth/reset-password');
  }
}
