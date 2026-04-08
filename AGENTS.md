# AGENTS.md — Guidelines for AI Coding Agents

## Project Overview

CSSApply is a Next.js 15 recruitment portal for the Computer Science Society at UST. It uses TypeScript, Tailwind CSS v4, Prisma ORM (PostgreSQL), NextAuth.js, Supabase for storage, SWR for client caching, and sonner for toast notifications.

## Build / Lint / Test Commands

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint (flat config)
npm run lint:fix     # ESLint with auto-fix
npx tsc --noEmit     # TypeScript type check (no dedicated script)
```

```bash
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma db push   # Push schema to database
npx prisma studio    # Open Prisma Studio GUI
```

**Testing**: No test framework configured. `src/test/ApplicationGuard.test.tsx` is a demo file. Recommend Vitest or Jest if adding tests.

**Prisma note**: `@prisma/client` (^6) and `prisma` CLI (^6) versions must match. If `prisma generate` fails with EPERM, stop the dev server first.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # Route handlers (route.ts)
│   ├── admin/              # Admin dashboard (schedule, applications, members, EAs, staffs, super-admin)
│   ├── user/               # User-facing pages (apply, member/committee-staff/executive-assistant flows)
│   └── auth/               # Auth error pages
├── components/             # Shared React components (PascalCase)
├── contexts/               # React context providers
├── data/                   # Static data (committeeRoles, ebRoles, adminSchedule)
├── lib/                    # Utilities (auth, prisma, supabase, email, SWR helpers)
├── styles/                 # Animation utilities
├── types/                  # TypeScript augmentations
└── middleware.ts            # Auth/role routing
prisma/schema.prisma        # Database schema
eslint.config.mjs           # ESLint flat config
```

## Code Style

### TypeScript

- `strict: true`. No `any` unless unavoidable.
- Use `interface` for props and object shapes. PascalCase names (`UserSession`, `ApplicationGuardProps`).
- Import types with `import type { ... }`.
- Path alias: `@/*` → `./src/*`. Never use relative `../../`.

### React Components

- Client components: `"use client"` at top. Server components have no directive.
- Default exports for pages and shared components.
- Props inline or separate `interface` above the function.

```tsx
"use client";
import { useState } from "react";

interface Props {
  title: string;
  optional?: boolean;
}

export default function MyComponent({ title, optional = false }: Props) {
  // ...
}
```

### Naming

- **Files**: `kebab-case` for utils (`name-parsing.ts`), `PascalCase` for components (`ApplicationGuard.tsx`).
- **Components/functions**: PascalCase / camelCase.
- **Constants**: UPPER_SNAKE_CASE.
- **Routes**: Next.js conventions (`page.tsx`, `route.ts`, `[param]/`).

### API Routes

- Export named `GET`, `POST`, etc. handlers.
- Always check `getServerSession(authOptions)` first.
- Return `NextResponse.json(data, { status })`.
- Wrap in try/catch. Use `console.error('Context:', err)`.

### Error Handling

- Server: try/catch → `{ error: 'message' }` with 400/401/404/500.
- Client: try/catch around fetches, use `toast` from `sonner` for user feedback.
- Never use `alert()` — use `toast.success()` / `toast.error()`.

### Imports

- Order: (1) React/Next, (2) third-party, (3) internal `@/`.
- Named imports preferred: `import { createClient } from '@supabase/supabase-js'`.

### Styling

- Tailwind CSS v4 via `@tailwindcss/postcss`. Utility classes only.
- Theme palette: `#044FAF` (primary blue), `#134687` (dark blue), `#005FD9` (accent), `#F3F3FD` (bg), `#E8F2FF` (light blue).
- Fonts: `font-poppins` (headings), `font-inter` (body), `font-mono` (labels/code).
- Card style: `bg-white rounded-xl border border-[#005FD9]/10 p-5`.
- Buttons: flat outline `text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD]`.
- Status badges: `bg-[#044FAF]/10 text-[#044FAF]` (positive), `bg-[#FFE7B4]/40 text-[#5B4515]` (pending).
- Toast: sonner with custom CSS in `globals.css` (blue success, soft red error).

### Data Fetching

- Client: use SWR (`import useSWR from 'swr'`) with the fetcher in `src/lib/swr-fetcher.ts`.
- Session: wrap app in `SessionWrapper` which provides `SessionProvider` + `SWRConfig`.
- Avoid redundant fetches — SWR deduplicates automatically.

### Database (Prisma)

- Schema: `prisma/schema.prisma`. PostgreSQL.
- Singleton client: `src/lib/prisma.ts`.
- After schema changes: `npx prisma generate && npx prisma db push`.
- Use `select`/`include` to control returned fields.
- DB indexes on frequently filtered columns.

## Environment Variables

```
DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
BREVO_API_KEY
```

Never commit `.env`. Never log secrets.

## Middleware

`src/middleware.ts`: redirects authenticated users to role dashboards, protects `/user/*` and `/admin/*`, enforces super-admin access.

## Deployment

Vercel. Build command: `next build`. `vercel.json` present for config.
