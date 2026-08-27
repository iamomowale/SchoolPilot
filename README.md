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

## Announcements and notifications

Announcements support tenant-wide, branch, class, role, and individual-user targeting. Publishing an announcement creates in-app notifications immediately and queues any configured email or SMS deliveries through Redis.

Add the following values to `apps/api/.env` for local development. Use sandbox webhooks for email and SMS if you want to observe delivery attempts.

```env
NOTIFICATION_EMAIL_PROVIDER=mock
NOTIFICATION_EMAIL_FROM=no-reply@schoolpilot.local
NOTIFICATION_EMAIL_WEBHOOK_URL=
NOTIFICATION_SMS_PROVIDER=mock
NOTIFICATION_SMS_SENDER=SchoolPilot
NOTIFICATION_SMS_WEBHOOK_URL=
NOTIFICATION_QUEUE_ATTEMPTS=3
NOTIFICATION_QUEUE_BACKOFF_MS=1000
REDIS_URL=redis://localhost:6379
```

Local setup:

1. Make sure Redis is running and `REDIS_URL` points to it.
1. Configure the sandbox email and SMS endpoints if you want to observe queued deliveries, or leave the webhook URLs empty to log locally.
1. Restart the API after changing the environment.
1. Publish announcements with `POST /announcements`.
1. Read the signed-in user’s inbox with `GET /announcements/notifications/me`.
1. Mark a notification read with `PATCH /announcements/notifications/:id/read`.

The implementation keeps in-app notifications inside the database and sends email/SMS through pluggable adapters. There is no internal chat feature in this pilot.

## Reporting and CSV exports

Tenant-scoped reports are available under `GET /reports/:type`, where `type` is one of `enrollment`, `attendance`, `outstanding_fees`, `payments`, or `student_performance`. Each supports the relevant `branchId`, `sessionId`, `termId`, `classId`, `startDate`, and `endDate` query filters. All supplied scope identifiers are checked against the active tenant before querying.

`report.view` is required for every report. The `outstanding_fees` and `payments` reports additionally require `finance.manage`; this prevents non-finance roles from accessing financial aggregates or CSVs. School users can only query their selected tenant, and export jobs/downloads are only visible to their requesting user inside that tenant.

Create a CSV export with `POST /reports/:type/exports` using the same query filters. Exports up to `REPORT_EXPORT_ASYNC_THRESHOLD` rows return CSV content immediately. Larger exports are stored as jobs and generated by Redis; poll `GET /reports/exports/:id`, then call `GET /reports/exports/:id/download` once its status is `completed`.

```env
REDIS_URL=redis://localhost:6379
REPORT_EXPORT_ASYNC_THRESHOLD=1000
REPORT_EXPORT_QUEUE_CONCURRENCY=2
REPORT_EXPORT_QUEUE_ATTEMPTS=3
REPORT_EXPORT_QUEUE_BACKOFF_MS=1000
# Optional local directory. Defaults to storage/report-exports under the API working directory.
REPORT_EXPORT_STORAGE_DIR=storage/report-exports
```

Ensure Redis is running and apply the Prisma migration before starting the API. Generated CSV files are tenant-scoped and written with owner-only file permissions.

## Private uploads

Student photos and permitted school documents are private by default. `POST /uploads/students/:studentId/photo` accepts only JPEG or PNG images up to 5MB. `POST /uploads/documents` accepts PDF, JPEG, and PNG files up to 10MB, using `kind=student_document` with a `studentId`, or `kind=school_document` without one. The API validates the declared MIME type, size, and file signature before storage.

Uploads require `academic.manage`; school documents additionally require a school administrator. A signed download URL can be requested with `POST /uploads/:id/signed-download-url` by an administrator, the uploader, or the attached student/guardian. URLs expire after five minutes by default and the API intentionally provides no public file-listing route. Upload and deletion events are audited.

```env
# Private local adapter for development. Do not commit a real signing secret.
UPLOAD_STORAGE_DIR=storage/uploads
UPLOAD_SIGNING_SECRET=replace-with-a-long-random-secret
UPLOAD_SIGNED_URL_TTL_SECONDS=300
# Set in deployed environments so generated URLs point at the public API origin.
UPLOAD_SIGNED_URL_BASE=https://api.example.com/uploads/signed
```

The storage adapter is registered in `UploadsModule`. Replace `PrivateLocalStorageAdapter` with an S3-compatible implementation in deployment; it must keep the bucket private and implement the same put/get/delete/signed-URL contract.

## Useful commands

- `pnpm dev` — start Docker services, the web app, and the API together
- `pnpm run docker:down` — stop the local services
- `pnpm lint` — run linting for the workspace
- `pnpm test` — run tests in the workspace
- `pnpm run typecheck` — run TypeScript type-checking
- `pnpm run format` — format repository files with Prettier
