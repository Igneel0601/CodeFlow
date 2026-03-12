# Debugging Session Summary

## Issue 1: `localStorage.getItem is not a function` (FIXED)

**Error:** Repeated `TypeError: localStorage.getItem is not a function` crashing the app with 500 on every page load.

**Root Cause:** Node.js v25.6.1 introduces a built-in `localStorage` global (Web Storage API). Without `--localstorage-file` configured, the `localStorage` object exists but its methods (`getItem`, `setItem`) are `undefined`. The `next-themes` library checks `typeof window === "undefined"` to skip server-side localStorage access, but Node.js 25's broken localStorage object still causes errors in certain code paths.

**Fix:** Added `--no-experimental-webstorage` to `NODE_OPTIONS` in package.json scripts:
```json
"dev": "NODE_OPTIONS='--no-experimental-webstorage' next dev --turbopack",
"build": "NODE_OPTIONS='--no-experimental-webstorage' next build",
"start": "NODE_OPTIONS='--no-experimental-webstorage' next start",
```

**Alternative:** Downgrade to Node.js 22 LTS.

---

## Issue 2: `TRPCClientError: Inngest API Error: 401 Event key not found` (FIXED)

**Error:** Inngest rejecting events with 401 because no event key was configured.

**Root Cause:** App was trying to connect to Inngest Cloud instead of the local dev server.

**Fix:** Added `INNGEST_DEV=1` to `.env` to point the SDK at the local Inngest dev server (`http://127.0.0.1:8288`).

---

## Issue 3: Inngest `error handling queue item error="invalid status code: 500"` (IN PROGRESS)

**Error:** Inngest dev server logs show 500 errors when processing queue items.

**Root Cause (likely):** Missing API keys in `.env`. The code agent function requires:
- `OPENAI_API_KEY` or (`GEMINI_API_KEY` + `GEMINI_BASE_URL`) — for LLM calls
- `E2B_API_KEY` — for sandbox creation via `@e2b/code-interpreter`

**Next Step:** Check the Next.js terminal for the actual stack trace, and verify all required env vars are set in `.env`.

---

## Environment Details
- **Node.js:** v25.6.1
- **Next.js:** 15.3.4 (Turbopack)
- **Package Manager:** pnpm
- **Key Dependencies:** next-themes 0.4.6, @clerk/nextjs 6.38.2, inngest 3.39.2, @e2b/code-interpreter 1.5.1, @inngest/agent-kit 0.8.3
