# Schema Understanding

4 tables: Project, Message, Fragment, Usage

## Project
- `id` — primary key, UUID auto-generated
- `name` — project name
- `userId` — who owns it
- `sandboxId` — id of the sandbox where code is shown (optional)
- `messages Message[]` — not a foreign key, just Prisma saying "this side has many messages"

## Message
- `id` — primary key
- `content` — the message text
- `role` — USER or ASSISTANT (who wrote the message)
- `type` — RESULT or ERROR
- `projectId` — foreign key to Project's id
- `onDelete: Cascade` — if the project is deleted, its children (messages, fragments) still reference it, so they must be deleted too — no null references allowed
- `fragment Fragment?` — optional, not every message generates code

## Fragment
- `id` — primary key
- `messageId` — foreign key to Message's id (unique, so 1:1 relationship)
- Same cascade logic — if message is deleted, fragment dies too
- `sandboxUrl` — where the generated code runs
- `title` — fragment title
- `files Json` — stored as JSON because files are a blob that get read/written together as a unit. No need for a separate File table since we never query individual files

## Usage
- `key` — primary key
- `points` — usage points
- `expire` — optional expiry datetime
