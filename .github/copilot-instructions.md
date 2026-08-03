# Copilot Instructions for SchoolPilot

## Project Overview
- SchoolPilot is a multi-tenant school-management SaaS platform.
- Build the product as a modular monolith in a pnpm workspace.
- Use TypeScript everywhere.
- Keep the implementation aligned with the planned structure:
  - Frontend: apps/web with Next.js
  - API: apps/api with NestJS
  - Data layer: PostgreSQL with Prisma ORM
  - Caching/background jobs: Redis
  - Local development: Docker Compose

## Architecture and Design Rules
- Prefer a modular monolith over microservices.
- Treat every school-owned record as tenant-isolated. Never allow cross-tenant data access.
- Enforce authorization in the API layer; do not rely on frontend-only checks.
- Use roles and granular permissions for access control.
- Validate all API input and return typed error responses.
- Maintain audit logs for security-sensitive and financial actions.
- Never commit secrets or environment values to source control.
- Prefer accessible, responsive UI components with Tailwind CSS.
- Expose REST APIs with OpenAPI/Swagger documentation.

## Coding Standards
- Use TypeScript for all application code, including shared utilities and tests.
- Keep changes small and focused. Do not rewrite unrelated files.
- Follow existing project conventions unless the repository is still empty or scaffolded.
- Favor clear, explicit, maintainable code over clever shortcuts.
- Use strong typing and avoid any/unknown where avoidable.
- Keep business logic in the API layer and keep UI components thin.

## API and Data Guidelines
- Validate request payloads at the API boundary.
- Use typed DTOs and validation pipes where appropriate.
- Return consistent structured error responses.
- Ensure tenant context is applied consistently to every query and mutation.
- Use Prisma for database access and schema changes.
- Keep database access patterns safe, explicit, and tenant-aware.

## Security and Compliance
- Enforce authorization checks server-side for every protected route or action.
- Apply least-privilege access patterns for roles and permissions.
- Protect sensitive and financial operations with audit logging.
- Do not hardcode credentials, tokens, or secrets.
- Treat all user input as untrusted.

## Testing Expectations
- Write tests for critical workflows, especially authentication, authorization, tenant isolation, and financial actions.
- Favor unit and integration tests for business-critical logic.
- Keep tests deterministic and avoid brittle assertions.
- When changing behavior, update or add tests alongside the implementation.

## Workflow Expectations
- Before modifying code, inspect the existing repository and briefly state the plan.
- After each task, run relevant linting, tests, and type checking, then report results and any unresolved issues.
- Prefer incremental changes over large rewrites.
- If a change is ambiguous, prefer the smallest safe implementation that matches the architecture rules.

## Repository-Specific Notes
- The repository currently contains only a minimal scaffold, so new work should be introduced deliberately and consistently.
- When creating new modules, keep them aligned with the monorepo structure and the stack requirements above.
- Preserve a clean separation between frontend, API, shared libraries, and infrastructure concerns.
