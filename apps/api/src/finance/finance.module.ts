import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaService } from '../common/prisma.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { GatewayPaymentsService } from './gateway/gateway-payments.service';
import { MockPaymentGateway } from './gateway/mock-payment.gateway';
import { PaymentGatewayRegistry } from './gateway/payment-gateway.registry';
import { PaymentWebhooksController } from './gateway/payment-webhooks.controller';
import { WebhookFailureAlertService } from './gateway/webhook-failure-alert.service';

@Module({ imports: [AuthorizationModule], controllers: [FinanceController, PaymentWebhooksController], providers: [FinanceService, GatewayPaymentsService, PaymentGatewayRegistry, MockPaymentGateway, WebhookFailureAlertService, PrismaService] })
export class FinanceModule {}
