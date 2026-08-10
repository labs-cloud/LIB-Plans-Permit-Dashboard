# LIB Plans & Permits Dashboard

Read-only Next.js dashboard that mirrors Lead It Builders' Plans & Permits state
from ClickUp in real time. Designed to be embedded inside a ClickUp Dashboard
"Embed" widget. Full build brief lives in [`AGENTS.md`](./AGENTS.md); locked
visual reference in [`docs/mockups/portfolio_dashboard_v4.html`](./docs/mockups/portfolio_dashboard_v4.html).

## Quick start

```bash
pnpm install              # or `npm install`
cp .env.local.example .env.local
# Edit .env.local and paste your CLICKUP_API_TOKEN
pnpm dev                  # http://localhost:3000
```

Generate a ClickUp personal API token at **Settings → Apps → API**. The token
goes into the `Authorization` header raw (no `Bearer` prefix — ClickUp's quirk).

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Local dev server with HMR |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lint` | Next.js ESLint |

## Environment variables

```
CLICKUP_API_TOKEN=pk_xxxxxxxxxxxxxxxxxxxx    # required — raw personal token
CLICKUP_WORKSPACE_ID=9017603275              # LIB workspace
CLICKUP_ACTIVE_PROJECTS_SPACE_ID=90173230172 # Active Projects space
NEXT_PUBLIC_CLICKUP_BASE_URL=https://app.clickup.com
```

Without a token the dashboard renders empty-state with a banner; with one set
it crawls the Active Projects space, walks each project folder for the
`03. Plans` / `04. Permits` / `00. Project Overview` lists, and aggregates.

The access gate (below) adds two more, both required in production:

```
DASHBOARD_ACCESS_TOKEN=<long random string>   # the team key
DASHBOARD_SHARE_SECRET=<long random string>   # signs owner share links
```

## Access & sharing

Every page and API route is gated by `middleware.ts`. Access rides in the URL as
`?k=<token>`, because the ClickUp embed is a third-party iframe where cookies are
often refused. There are two kinds of token, and the difference matters:

| | What it opens | Where it comes from |
|---|---|---|
| **Team key** (`DASHBOARD_ACCESS_TOKEN`) | Everything — all projects, all four dashboards | The ClickUp widget URLs and the **Copy embed link** buttons |
| **Owner link** (`p_…`, HMAC of `DASHBOARD_SHARE_SECRET`) | One project's budget page and outlook report, read-only | The **Share** button on a project's budget, or `/api/share-link` |

**Sending a budget to an owner: use Share.** It mints an owner link for that one
project. Pasting the URL out of your own address bar instead would hand over the
team key, and a link with no `k` at all is what produces the gate's
"Access required" page on the far end — the thing an owner sees when the link
they were sent has no token in it.

Owner links are derived, not stored, so they can't be revoked one at a time —
rotating `DASHBOARD_SHARE_SECRET` invalidates all of them at once. Bidding,
plans and permits have no owner link by design: they show every sub's numbers
across the portfolio, so they stay team-only.

Mint one by hand with:

```
GET /api/share-link?projectId=<project name>&view=report&k=<team key>
```

## Architecture in one paragraph

`app/page.tsx` server-renders the first paint by calling `getDashboardPayload`
(`lib/cache.ts`), which wraps `loadAllProjects` in `unstable_cache` with a
60-second TTL and a `projects` revalidation tag. `app/api/projects/route.ts`
exposes the same payload over HTTP; the client `Dashboard.tsx` uses SWR with
`refreshInterval: 60_000` and `revalidateOnFocus: true` against that endpoint.
Filters (`search`, `coord`, `phase`, `view`, `sort`) live in URL search params
so filtered views are bookmarkable. All filtering is client-side over the
cached payload — request count to ClickUp stays flat regardless of filter
combinations.

## Deploy

1. Push the repo to GitHub (already configured).
2. Import into Vercel; add the env vars above to the Vercel project.
3. After the first deploy, open a ClickUp Dashboard → add an **Embed** widget
   → paste the Vercel URL → resize. The `next.config.js` already sets
   `Content-Security-Policy: frame-ancestors` to allow ClickUp iframes.

## Maintenance notes

- **Coordinator roster** is hard-coded in `lib/constants.ts`. To add a third
  coordinator, extend `COORDINATORS` and the avatar styles in `app/globals.css`
  (`.avatar-<id>`).
- **Status vocabulary** is locked to ClickUp's canonical names; the legacy
  Excel vocabulary must not surface in the UI. Mapping happens in
  `lib/status-map.ts`.
- **Plan-type → matrix column** mapping lives in `lib/plan-type-map.ts`. Plan
  types not in the table still render in the Detailed capsule view but get no
  matrix dot — extend the keyword table to add new columns.
- `// TODO(v2):` markers flag the four open questions from `AGENTS.md` §12.
