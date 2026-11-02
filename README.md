# Birthude

Digital event invitations that people actually interact with. Design an invitation, share one link, and track who is coming. Guests get a personal page where they can RSVP, see the venue on a map, and join live games hosted from the same page.

Birthude is for anyone organizing a birthday or small event who wants something livelier than a group-chat message. The interface is available in English, Spanish, French and Portuguese.

## Features

- **Invitation builder**: create and personalize an invitation at `/create`, with AI-assisted copy and generated assets (OpenRouter through the Vercel AI SDK)
- **Per-guest links**: every invitee gets a personal viewer page (`/i/<slug>/viewer/<identifier>`) with RSVP/confirmation, seen-tracking and slot or item assignment
- **Map and address autocomplete**: venue lookup through Geoapify, rendered with Leaflet
- **Live games**: a raffle with a draw and winner reveal, and a trivia game (start, question, answer, pick winner, end)
- **Credits and payments**: buy invitation packages (`/buy`), paid through dLocal Go or PayPal; payment history under `/account/payments`
- **Accounts**: email sign-up and sign-in with NextAuth
- **File storage**: uploads go to a self-hosted Contento file-management instance (a sibling project), with Bytescale as the alternative

## Built with

Next.js 16 (App Router, React Compiler) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL with Drizzle ORM · NextAuth v5 · next-intl · TanStack Query · GSAP · Leaflet · Vercel AI SDK with OpenRouter · pnpm

## Running it locally

You need Node.js 20+ (the Dockerfile uses Node 20), pnpm and a PostgreSQL database.

```bash
pnpm install
cp .env.example .env     # then fill in the values (see below)
pnpm drizzle:migrate     # apply the schema to POSTGRES_URL
pnpm dev                 # http://localhost:3000
```

Then seed the purchasable invitation packages (Starter, Party, ...) with `pnpm tsx seed-packages.ts`.

### Environment variables

`.env.example` lists everything. The important ones:

| Variable | Purpose |
|---|---|
| `POSTGRES_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AUTH_TRUSTED_HOSTS` | NextAuth configuration; set the URL to your deployed domain in production |
| `OPENROUTER_API_KEY` | AI features |
| `GEOAPIFY_API_KEY` | Address autocomplete and reverse geocoding |
| `CONTENTO_*` or `BYTESCALE_*` | File uploads |
| `DLOCAL_GO_API_KEY`, `DLOCAL_GO_SECRET_KEY`, `DLOCAL_GO_ENV` | Payments (`sandbox` or live) |

Never commit a filled-in `.env`; it is git-ignored.

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint |
| `pnpm drizzle:generate` | Generate a migration after editing the schema in `src/db` |
| `pnpm drizzle:migrate` | Apply migrations |
| `pnpm drizzle:push` | Push the schema straight to the database (development only) |

## Docker

`docker-compose.yml` builds the app, runs the Drizzle migrations first, and then starts Next.js on port 3000 inside a shared Docker network (it is set up for Dokploy, which handles routing, so no port is published). Supply the variables above through the environment.

## Project layout

```
src/app/          pages and API routes (invitations, payments, geo, auth, health)
src/components/   UI components
src/db/           Drizzle schema
src/i18n/         next-intl setup
messages/         en, es, fr, pt translations
drizzle/          generated SQL migrations
```

## Status and ideas

The invitation, RSVP, raffle, trivia and payment flows are in place. There are no automated tests yet, which is the first gap to close.

## License

[MIT](LICENSE)
