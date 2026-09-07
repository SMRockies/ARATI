# Web Application

The `@arati/web` package is the Next.js ERP shell. It provides the initial navigation, dashboard placeholder, responsive styling baseline, and runtime API configuration for later feature modules.

## Commands

```powershell
corepack pnpm --filter @arati/web dev
corepack pnpm --filter @arati/web build
corepack pnpm --filter @arati/web typecheck
corepack pnpm --filter @arati/web test
```

Set `NEXT_PUBLIC_API_BASE_URL` in `.env.local` when the API is not running at `http://localhost:3001`.
