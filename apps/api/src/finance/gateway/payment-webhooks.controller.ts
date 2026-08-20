import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { GatewayWebhookDto } from '../dto';
import { GatewayPaymentsService } from './gateway-payments.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('payment-webhooks')
@Controller('payment-webhooks')
export class PaymentWebhooksController {
  constructor(private readonly gatewayPayments: GatewayPaymentsService) {}

  @Post(':provider')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify and process a provider payment webhook. Browser redirects never create payments.' })
  @ApiHeader({ name: 'x-payment-signature', required: true, description: 'Provider webhook signature.' })
  @ApiBody({ type: GatewayWebhookDto })
  @ApiResponse({ status: 200, description: 'Webhook accepted; duplicate events are safely ignored.' })
  async receive(@Req() req: RawBodyRequest, @Headers('x-payment-signature') signature: string | undefined, @Body() payload: GatewayWebhookDto) {
    const provider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
    return { success: true, data: await this.gatewayPayments.handleWebhook(provider, payload, signature, req.rawBody) };
  }
}
