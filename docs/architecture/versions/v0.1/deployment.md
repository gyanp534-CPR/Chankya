# Deployment Blueprint - v0.1

## Initial Hosting
- Backend: Railway or Render
- Database: Neon or Supabase Postgres free tier
- Web: Vercel (or compatible Next.js host)
- Mobile: Expo EAS

## Deployment Principles
- Keep backend portable and cloud-neutral.
- Maintain separate environments: `dev`, `staging`, `prod`.
- Use environment-based secrets management.

## Operational Baseline
- Daily database backups (managed provider policy).
- Migration-driven schema evolution with Prisma.
- Basic health check endpoint for uptime probes.

## Planned v0.2 Hardening
- Centralized logs and tracing.
- Rate limiting and abuse controls.
- Background job runner for analytics/revision recalculation.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

