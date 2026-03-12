# Vibe - AI-Powered Development Platform

> An AI-powered development platform that enables users to create web applications through conversational interactions with AI agents. The platform generates Next.js applications in real-time sandboxes, providing live preview and code inspection capabilities.

**Creator**: CodeWithAntonio
**Version**: 0.1.0
**Repository**: https://github.com/AntonioErdeljac/nextjs-vibe

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [AI Agent Workflow](#ai-agent-workflow)
- [API Layer (tRPC)](#api-layer-trpc)
- [UI & Styling](#ui--styling)
- [State Management](#state-management)
- [Rate Limiting & Credits](#rate-limiting--credits)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Key Files Reference](#key-files-reference)

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript 5 |
| **UI** | React 19, Shadcn/UI, Radix UI |
| **Styling** | Tailwind CSS v4 (OKLCH color space) |
| **API** | tRPC 11 (type-safe) |
| **Database** | PostgreSQL + Prisma 6 |
| **Auth** | Clerk (auth + subscriptions) |
| **AI** | OpenAI GPT-4 / GPT-4o |
| **Sandbox** | E2B Code Interpreter |
| **Background Jobs** | Inngest 3 + Agent Kit |
| **Data Fetching** | TanStack React Query |
| **Forms** | React Hook Form + Zod |
| **Icons** | Lucide React |
| **Syntax Highlighting** | Prism.js |
| **Notifications** | Sonner (toast) |
| **Theme** | next-themes (light/dark) |

---

## Project Structure

```
src/
├── app/                              # Next.js App Router
│   ├── (home)/                       # Public routes (landing, pricing, auth)
│   │   ├── page.tsx                  # Home/dashboard page
│   │   ├── pricing/page.tsx          # Pricing page
│   │   ├── sign-in/[[...sign-in]]/   # Clerk sign-in
│   │   ├── sign-up/[[...sign-up]]/   # Clerk sign-up
│   │   └── layout.tsx                # Navbar layout
│   ├── projects/[projectId]/         # Project workspace (protected)
│   │   └── page.tsx
│   ├── api/
│   │   ├── trpc/[trpc]/route.ts      # tRPC API endpoint
│   │   └── inngest/route.ts          # Background job processor
│   ├── layout.tsx                    # Root layout (providers)
│   ├── error.tsx                     # Error boundary
│   └── globals.css                   # CSS variables & theme
├── components/
│   ├── ui/                           # Shadcn/UI components (30+)
│   ├── code-view/index.tsx           # Syntax highlighting
│   ├── file-explorer.tsx             # File tree + code viewer
│   ├── tree-view.tsx                 # File tree component
│   ├── user-control.tsx              # Clerk UserButton wrapper
│   └── hint.tsx                      # Tooltip component
├── modules/                          # Feature modules
│   ├── home/
│   │   ├── constants.ts              # Project templates
│   │   └── ui/components/            # Navbar, ProjectForm, ProjectsList
│   ├── projects/
│   │   ├── server/procedures.ts      # tRPC project procedures
│   │   └── ui/components/            # ProjectHeader, Messages, FragmentWeb
│   ├── messages/
│   │   └── server/procedures.ts      # tRPC message procedures
│   └── usage/
│       └── server/procedures.ts      # tRPC usage procedures
├── lib/
│   ├── db.ts                         # Prisma client (singleton)
│   ├── usage.ts                      # Rate limiting & credit tracking
│   └── utils.ts                      # Utility functions (cn, tree helpers)
├── trpc/
│   ├── init.ts                       # tRPC setup + Clerk middleware
│   ├── client.tsx                    # tRPC React provider
│   ├── server.tsx                    # Server-side utilities
│   ├── query-client.ts              # TanStack Query config
│   └── routers/_app.ts              # Main router
├── inngest/
│   ├── client.ts                     # Inngest client
│   ├── functions.ts                  # AI code generation logic
│   ├── utils.ts                      # Sandbox & agent utilities
│   └── types.ts                      # Constants
├── hooks/                            # Custom React hooks
│   ├── use-current-theme.ts
│   ├── use-scroll.ts
│   └── use-mobile.ts
├── middleware.ts                      # Clerk route protection
├── prompt.ts                         # AI system prompts
└── types.ts                          # Global types

prisma/
└── schema.prisma                     # Database schema

sandbox-templates/nextjs/
├── e2b.Dockerfile                    # E2B sandbox image
└── compile_page.sh                   # Sandbox startup script
```

---

## Features

### Home Page
- Project creation via conversational input (textarea with auto-expand)
- 8 quick-start templates: Netflix clone, Admin dashboard, Kanban board, File manager, YouTube clone, Store, Airbnb clone, Spotify clone
- Grid view of user's existing projects with timestamps
- Auto-generated project names (random word slugs)

### Project Workspace
- **Split-pane interface** (resizable): Chat (35%) | Preview/Code (65%)
- **Chat panel**: Message history, auto-scroll, loading animations, credit display
- **Preview tab**: Live iframe of generated app, refresh, copy URL, open in new tab
- **Code tab**: File tree explorer + syntax-highlighted code viewer with breadcrumbs
- **Message cards**: Distinct user/AI styling, timestamps on hover, error highlighting

### Authentication & Billing
- Clerk-powered sign-in/sign-up (email, Google, GitHub, etc.)
- Subscription tiers: Free (2 credits/month) and Pro (100 credits/month)
- Pricing page with Clerk PricingTable component
- Credit display in project workspace with upgrade prompts

---

## Architecture

### Data Flow

```
User Input → tRPC Mutation → Database → Inngest Background Job
                                              ↓
                                    AI Agent Network (GPT-4)
                                    ├─ Terminal Tool (bash commands)
                                    ├─ File Creation Tool
                                    └─ File Read Tool
                                              ↓
                                    E2B Sandbox (live Next.js app)
                                              ↓
                              Save Fragment (files, sandbox URL) to DB
                                              ↓
                              Client polls every 2s → UI updates
```

### App Router Pattern
- Route groups: `(home)` for public routes
- Dynamic routes: `/projects/[projectId]`
- API routes: `/api/trpc/[trpc]`, `/api/inngest`
- Server-side prefetching with `HydrationBoundary`

### tRPC Setup
- Clerk auth context injected via middleware
- SuperJSON transformer for serialization
- Protected procedure middleware enforces authentication
- Three routers: `projects`, `messages`, `usage`

### Background Jobs (Inngest)
- `codeAgentFunction` triggered by `code-agent/run` event
- Multi-agent network using Inngest Agent Kit:
  1. **Code Agent** (GPT-4.1, temp 0.1) — generates code, runs terminal commands, manages files
  2. **Title Generator** (GPT-4o) — creates fragment titles
  3. **Response Generator** (GPT-4o) — creates user-facing summaries

### E2B Sandbox
- Pre-built Docker image with Node 21, Next.js 15.3.3, all Shadcn/UI components
- 30-minute timeout per sandbox
- Runs `npx next dev --turbopack` on port 3000
- AI agents interact via terminal, file creation, and file reading tools

---

## Database Schema

```prisma
model Project {
  id        String    @id @default(uuid())
  name      String
  userId    String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  messages  Message[]
}

enum MessageRole {
  USER
  ASSISTANT
}

enum MessageType {
  RESULT
  ERROR
}

model Message {
  id        String      @id @default(uuid())
  content   String
  role      MessageRole
  type      MessageType
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  projectId String
  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  fragment  Fragment?
}

model Fragment {
  id         String   @id @default(uuid())
  messageId  String   @unique
  message    Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  sandboxUrl String
  title      String
  files      Json     // { [path: string]: string }
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Usage {
  key    String    @id
  points Int
  expire DateTime?
}
```

**Relationships**: Project → many Messages → optional Fragment. Usage is a key-value store for rate limiting.

---

## Authentication

**Provider**: Clerk

**Protected Routes** (via `src/middleware.ts`):
- All routes except: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api(.*)`, `/pricing(.*)`

**Server-side**: `auth()` from `@clerk/nextjs/server` provides `userId`
**Client-side**: `useAuth()`, `useUser()` hooks
**Subscriptions**: Managed by Clerk — plan metadata determines credit limits

---

## AI Agent Workflow

The AI code generation uses three specialized agents orchestrated by Inngest Agent Kit:

### 1. Code Agent (GPT-4.1, temperature 0.1)
- **System prompt** defined in `src/prompt.ts` with strict rules:
  - Tailwind-only styling (no CSS files)
  - No `npm build/dev/start` commands
  - Relative paths for file creation, absolute for reading
  - `"use client"` directive for client components
  - All Shadcn/UI components are pre-installed
- **Tools**: Terminal execution, file creation/update, file reading

### 2. Title Generator (GPT-4o)
- Generates a short title for the created fragment

### 3. Response Generator (GPT-4o)
- Creates a user-facing summary of what was built/changed

---

## API Layer (tRPC)

### Projects Router (`src/modules/projects/server/procedures.ts`)
| Procedure | Type | Description |
|-----------|------|-------------|
| `getMany` | Query | List user's projects |
| `getOne` | Query | Get single project by ID |
| `create` | Mutation | Create project + initial message, trigger AI |

### Messages Router (`src/modules/messages/server/procedures.ts`)
| Procedure | Type | Description |
|-----------|------|-------------|
| `getMany` | Query | Get messages for a project (with ownership check) |
| `create` | Mutation | Add message to project, trigger AI |

### Usage Router (`src/modules/usage/server/procedures.ts`)
| Procedure | Type | Description |
|-----------|------|-------------|
| `status` | Query | Get remaining credits and reset timer |

---

## UI & Styling

- **Component Library**: Shadcn/UI (30+ components) built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with OKLCH color space
- **Primary Color**: Orange/coral (`oklch(0.6171 0.1375 39.0427)`)
- **Theme**: Light/dark mode via `next-themes` with CSS variable overrides
- **Layout**: `react-resizable-panels` for split-pane workspace
- **Fonts**: Geist (Google Fonts)
- **Responsive**: Mobile-first, breakpoints at sm/md/2xl

---

## State Management

| Layer | Technology | Usage |
|-------|-----------|-------|
| **Server data** | TanStack React Query + tRPC | Data fetching, caching (30s stale time) |
| **Real-time updates** | React Query polling | Messages refetch every 2 seconds |
| **Form state** | React Hook Form + Zod | Validation, submission handling |
| **UI state** | React hooks (useState) | Tabs, modals, selections |
| **Theme** | next-themes | Persisted to localStorage |
| **SSR hydration** | HydrationBoundary + SuperJSON | Server-side prefetching |

---

## Rate Limiting & Credits

- **Library**: `rate-limiter-flexible` with Prisma storage backend
- **Storage**: `Usage` model (key = userId, points = consumed credits)
- **Tiers**:
  - Free: 2 credits/month
  - Pro: 100 credits/month
- **Cost**: 1 credit per generation (project creation or follow-up message)
- **Reset**: 30-day rolling window
- **Enforcement**: Returns `TOO_MANY_REQUESTS` error, UI shows upgrade prompt

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/vibe"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# OpenAI
OPENAI_API_KEY="sk-..."

# E2B Sandbox
E2B_API_KEY="..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/"

# Inngest (optional, auto-discovered in dev)
INNGEST_EVENT_KEY="..."
INNGEST_SIGNING_KEY="..."
```

---

## Deployment

### Scripts
```bash
npm run dev        # Development with Turbopack
npm run build      # Production build
npm start          # Start production server
npm run lint       # ESLint
npx prisma generate  # Generate Prisma client (runs on postinstall)
npx prisma db push   # Push schema to database
```

### Requirements
- Node.js 18+
- PostgreSQL database
- E2B account (sandbox execution)
- Clerk account (authentication & subscriptions)
- OpenAI API key (AI code generation)
- Inngest account (background job processing)

### Recommended Platform
- **Vercel** (optimized for Next.js)
- Any Node.js-compatible host with PostgreSQL access

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/inngest/functions.ts` | Core AI code generation logic |
| `src/prompt.ts` | System prompts for all 3 AI agents |
| `src/lib/usage.ts` | Rate limiting and credit tracking |
| `src/lib/db.ts` | Prisma client singleton |
| `src/trpc/init.ts` | tRPC setup with Clerk auth middleware |
| `src/trpc/routers/_app.ts` | Main tRPC router (merges all routers) |
| `src/modules/projects/server/procedures.ts` | Project CRUD API |
| `src/modules/messages/server/procedures.ts` | Message API |
| `src/modules/usage/server/procedures.ts` | Usage/credits API |
| `src/app/layout.tsx` | Root layout with all providers |
| `src/middleware.ts` | Clerk route protection |
| `src/components/file-explorer.tsx` | File tree + code viewer |
| `src/modules/projects/ui/components/fragment-web.tsx` | Live preview iframe |
| `prisma/schema.prisma` | Database schema |
| `sandbox-templates/nextjs/e2b.Dockerfile` | E2B sandbox Docker image |
