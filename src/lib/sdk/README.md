# SDK mirror (in-app copy)

Mirror of `app/packages/sentry-safety-sdk/`. Imported as `@/lib/sdk` by the dashboard UI (see `src/components/prototype/useScan.ts`).

Edit the workspace package at `app/packages/sentry-safety-sdk/`, then sync any changes here. Do not edit this copy directly.

The only intentional divergence is that this in-app copy re-uses the shared DTO from `@/types/scan` instead of inlining types — keeping the dashboard, API, and SDK on a single source of truth for `SanitizeRequest` / `SanitizeSuccess`.
