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

## Useful commands

- `pnpm dev` — start Docker services, the web app, and the API together
- `pnpm run docker:down` — stop the local services
- `pnpm lint` — run linting for the workspace
- `pnpm test` — run tests in the workspace
- `pnpm run typecheck` — run TypeScript type-checking
- `pnpm run format` — format repository files with Prettier
