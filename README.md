# Raj & Prachi — AI Hiring Platform

Two AI agents. One for job seekers (Raj), one for employers (Prachi).
When both sides say yes, Prachi makes the introduction.

## Stack

- **Next.js 15** (App Router, TypeScript)
- **Claude claude-sonnet-4-6** via Anthropic SDK — tool-use agent architecture
- **Drizzle ORM** + **Neon PostgreSQL**
- **Auth.js v5** — email/password credentials
- **Tailwind CSS v4**

## Setup (5 minutes)

### 1. Get a free database

Go to [neon.tech](https://neon.tech), create a free project, copy the connection string.

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
DATABASE_URL="postgresql://..."   # from Neon dashboard
AUTH_SECRET="..."                  # run: openssl rand -base64 32
ANTHROPIC_API_KEY="sk-ant-..."    # from console.anthropic.com
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Run migrations + seed

```bash
bun run db:migrate   # creates all 14 tables
bun run db:seed      # adds 25 job listings + 60 salary benchmarks
```

### 4. Start the app

```bash
bun run dev
```

Open http://localhost:3000

---

## Architecture

```
User message
    |
    v
/api/agents/raj (or /prachi)
    |
    |-- Load conversation history from messages table
    |
    v
Claude claude-sonnet-4-6 (with tool definitions)
    |
    |-- stop_reason: "tool_use" --> execute tool server-side
    |       |
    |       |  Raj tools:                    Prachi tools:
    |       |  update_candidate_profile      create_role
    |       |  search_jobs                   update_role
    |       |  record_swipe --------+        get_employer_roles
    |       |  run_mock_interview   |        find_candidates
    |       |  give_interview_feedback       record_employer_interest --+
    |       |  salary_benchmark              |                          |
    |       |                               Both call:                  |
    |       +-----------------------------------------------+          |
    |                                       check_mutual_match() <------+
    |                                           |
    |                                           +-- match found?
    |                                                   |
    |                                                   v
    |                                           DB transaction:
    |                                           INSERT matches
    |                                           INSERT notifications (x2)
    |
    |-- stop_reason: "end_turn" --> save to messages table
    |
    v
JSON response --> ChatThread --> user sees Raj/Prachi reply
```

### Key design decisions

- **Tools are internal server functions** — not HTTP endpoints. Zero attack surface.
- **Symmetric match detection** — both `record_swipe` and `record_employer_interest` call `check_mutual_match`.
- **Normalized messages table** — one row per message, not a JSON blob.
- **DB transaction on match** — prevents ghost matches (match row without notifications).
- **Idempotency everywhere** — duplicate swipes, interests, notifications are all no-ops.
- **MAX_TOOL_CALLS = 10** — runaway agent loop guard.

## Routes

```
/                        landing page (redirects if logged in)
/login                   signup + signin (combined)

/(seeker)
  /chat                  Raj conversation — amber theme
  /jobs                  Swipe stack
  /interview/[id]        Mock interview with progress bar
  /matches               Mutual match notifications

/(employer)
  /employer/chat         Prachi conversation — navy theme
  /employer/candidates   Candidate cards
  /employer/matches      Match notifications
```
