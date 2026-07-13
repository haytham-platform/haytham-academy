# Haytham Academy Platform

Production academy management platform built with Next.js, MongoDB, Mongoose, and pnpm.

## Requirements

- Node.js 20+
- pnpm 9+
- MongoDB connection string

## Setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Useful Scripts

```bash
pnpm seed
pnpm acceptance
pnpm acceptance:academic
pnpm acceptance:finance
pnpm acceptance:transport
pnpm verify-auth
```

The seed script requires `MONGODB_URI`, `JWT_SECRET`, and `STAFF_PASSWORD` in `.env`.
