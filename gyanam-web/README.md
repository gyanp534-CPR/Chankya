This is the Chankya frontend (Next.js App Router). This repo is frontend-only.
Backend services live in the `Chankya` repo.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open `http://localhost:3000` with your browser to see the result.

## Environment

Required:

```
NEXT_PUBLIC_API_BASE_URL=https://chankya-backend.onrender.com
```

## Backend Integration

The frontend expects the backend API to be available at `NEXT_PUBLIC_API_BASE_URL`.
Key endpoints used by the UI include:

- `GET /v1/learning-path` for “Today’s Focus”.
- `POST /v1/learning-path/start` to begin a focused practice set.
- `POST /v1/tests/assemble` to start diagnostics.
- `POST /v1/tests/session/evaluate` for per-question feedback.
- `POST /v1/tests/submit` to finish a session.

## Key Routes

- `/` redirects to `/practice`.
- `/practice` starts a practice session flow.
- `/practice/session` renders the in-session questions and submit flow.
- `/practice/result` shows the mentor feedback + score summary.
- `/dashboard` is the landing dashboard for user-level views.

## Deployment

Deploy from the `gyanam-web` directory with Vercel. The production alias is currently:

```
https://chankya-rho.vercel.app
```

The repo root includes `vercel.json` with `"rootDirectory": "gyanam-web"` so Vercel
builds from the frontend workspace by default.

Ensure the backend has `CORS_ORIGIN` set to include the Vercel domain(s) used for production and previews.

## Branch Workflow (Contributors)

We do not push directly to `main`. Use a branch-only workflow:

- Create a feature branch from `main`.
- Open a PR for review.
- Merge to `main` only after validation.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

Last updated: 2026-03-29
