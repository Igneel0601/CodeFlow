# CodeFlow

AI-powered development platform that lets you build web applications by chatting with AI agents running in real-time E2B sandboxes.

<!-- Demo GIF: record the full loop — type a prompt → agent runs → live preview updates -->
![Demo](public/demo.gif)

## Features

- 🤖 AI agents for code generation (OpenAI & Gemini supported)
- 💻 Real-time Next.js application development in E2B sandboxes
- 🔄 Live preview & code view with split-pane interface
- 📁 File explorer with syntax highlighting
- 💬 Conversational project development with full message history
- 🎯 Usage tracking and rate limiting
- 💳 Pro subscription support
- 🔐 Authentication with Clerk
- ⚙️ Background job processing with Inngest

## Tech Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS v4 + Shadcn/ui + Radix UI
- tRPC + TanStack Query
- Prisma ORM + PostgreSQL
- Inngest + @inngest/agent-kit
- OpenAI (default) or Gemini (OpenAI-compatible)
- E2B Code Interpreter
- Clerk Authentication

## Getting Started

### 1. Build the E2B Sandbox Template (required)

The AI agents run inside E2B sandboxes. You must build the template once before starting.

**Prerequisites:** Docker must be installed and running.

```bash
# Install E2B CLI
npm i -g @e2b/cli

# Login
e2b auth login

# Build the template
cd sandbox-templates/nextjs
e2b template build --name your-template-name --cmd "/compile_page.sh"
```

Then update the template name in `src/inngest/functions.ts`:

```typescript
const sandbox = await Sandbox.create("your-template-name");
```

### 2. Configure Environment

```bash
cp env.example .env
```

Fill in your `.env`:

```bash
DATABASE_URL=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# AI Provider: "openai" (default) or "gemini"
AI_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=""

# Gemini (OpenAI-compatible, only needed if AI_PROVIDER=gemini)
GEMINI_BASE_URL=""
GEMINI_API_KEY=""

# Optional AI tuning
# AI_CODE_MODEL=gpt-5-nano
# AI_TITLE_MODEL=gpt-5-nano
# AI_RESPONSE_MODEL=gpt-5-nano
# AI_TEMPERATURE=0.1
# AI_REASONING_EFFORT=medium   # low | medium | high — for o-series and gpt-5+ reasoning models

# E2B
E2B_API_KEY=""

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/"
```

### 3. Run

```bash
npm install
npx prisma migrate dev
npm run dev
```

## Additional Commands

```bash
# Database
npm run postinstall        # Generate Prisma client
npx prisma studio          # Open database GUI
npx prisma migrate dev     # Apply schema changes
npx prisma migrate reset   # Reset database (dev only)

# Build & Lint
npm run build
npm run start
npm run lint
```

## Project Structure

- `src/app/` — Next.js app router pages and layouts
- `src/components/` — Reusable UI components
- `src/modules/` — Feature modules (projects, messages, usage)
- `src/inngest/` — Background jobs and AI agent logic
- `src/lib/` — Utilities and database client
- `src/trpc/` — tRPC router and client setup
- `prisma/` — Database schema and migrations
- `sandbox-templates/` — E2B sandbox configuration

## How It Works

<!-- Screenshot: split-pane interface showing chat, live preview, and file explorer -->
![Split-pane UI](public/screenshot-ui.png)

1. **Project Creation** — Users describe what they want to build
2. **AI Processing** — Messages are picked up by Inngest background jobs
3. **Code Generation** — AI agents use E2B sandboxes to generate and run Next.js code
4. **Live Preview** — Generated app and files are shown in a split-pane interface
5. **Iteration** — Conversational flow allows continuous refinements

---
