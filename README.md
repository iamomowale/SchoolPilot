# SchoolPilot

SchoolPilot is a pnpm workspace monorepo for a multi-tenant school-management SaaS.

## Local development setup

1. Install prerequisites:
   - Node.js 20+ and npm
   - Docker Desktop or Docker Engine

2. Install pnpm globally if it is not already available:
   - `npm install -g pnpm@9.15.0`

3. Copy the environment template:
   - `cp .env.example .env`

4. Install workspace dependencies:
   - `pnpm install`

5. Start local services:
   - `pnpm run docker:up`

6. Start the web and API apps:
   - `pnpm dev`

The web app will be available at http://localhost:3000 and the API at http://localhost:4000/api. Swagger documentation is available at http://localhost:4000/docs.

### Local web context

The web app deliberately does not use a fallback tenant or user. After applying migrations, seed the local database and copy the displayed values into `apps/web/.env.local`:

```bash
pnpm --filter @schoolpilot/api prisma:seed
cp apps/web/.env.local.example apps/web/.env.local
```

Replace the two `replace-with-...` values in `apps/web/.env.local` with the `NEXT_PUBLIC_TENANT_ID` and `NEXT_PUBLIC_USER_ID` printed by the seed command, then restart `pnpm dev`. The seeded account is the local school administrator.

## Payment gateway sandbox and webhooks

Payment providers are accessed through a provider abstraction. The local `mock` provider is enabled by environment configuration; invoice and payment services do not contain provider-specific logic.

Add the following values to `apps/api/.env` for local development. Generate a unique webhook secret; it must not be committed.

```env
PAYMENT_GATEWAY_PROVIDER=mock
PAYMENT_GATEWAY_SANDBOX_BASE_URL=http://localhost:4000/mock-gateway
PAYMENT_GATEWAY_CURRENCY=NGN
PAYMENT_GATEWAY_WEBHOOK_SECRET=replace-with-a-long-random-secret
# Optional: HTTPS endpoint that receives JSON alerts when webhook processing fails.
PAYMENT_WEBHOOK_ALERT_URL=
```

Restart the API after changing its environment. A finance-authorized user initiates checkout with `POST /finance/invoices/:invoiceId/gateway-payment`. The response contains `checkoutUrl`, but opening or returning from that URL never records a payment.

The provider must send the final status to `POST /payment-webhooks/mock` with an `x-payment-signature` header. For the mock gateway, sign the exact raw JSON request body with HMAC SHA-256 using `PAYMENT_GATEWAY_WEBHOOK_SECRET`; the hex digest is the header value. The JSON payload is:

```json
{
  "eventId": "provider-event-id-unique-per-delivery",
  "providerPaymentId": "value-returned-when-payment-was-initiated",
  "status": "succeeded",
  "amount": 2500,
  "currency": "NGN"
}
```

Use a unique `eventId` per provider event. Retrying the same signed event is safe: the API stores an idempotency record and does not create another payment. Invalid signatures, unknown payment references, amount/currency mismatches, and processing errors are logged, audited where a tenant can be identified, and sent to `PAYMENT_WEBHOOK_ALERT_URL` when configured. Configure a production provider by implementing `PaymentGateway`, registering it in `PaymentGatewayRegistry`, and setting its credentials only through environment variables.

## Useful commands

- `pnpm dev` — start Docker services, the web app, and the API together
- `pnpm run docker:down` — stop the local services
- `pnpm lint` — run linting for the workspace
- `pnpm test` — run tests in the workspace
- `pnpm run typecheck` — run TypeScript type-checking
- `pnpm run format` — format repository files with Prettier
