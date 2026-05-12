# LIB Plans & Permits Dashboard — Build Brief

**For Claude Code.** Drop this file into the repo root as `AGENTS.md` (or feed it as your initial prompt). It's the canonical handoff from the design phase. The design spec is in Notion at https://www.notion.so/35e31e50091a8194b007fb68dbf66024 — this brief mirrors the build-relevant parts.

**Repo:** https://github.com/labs-cloud/LIB-Plans-Permit-Dashboard
**Deploy target:** Vercel (auto-deploy on `main`)
**Embedded into:** ClickUp Dashboard widget (iframe)

---

## 1. What you're building

A read-only metrics dashboard that mirrors Lead It Builders' Plans & Permits state from ClickUp in real time. It's embedded inside ClickUp itself via an iframe widget — and every interactive element deep-links back to the relevant ClickUp task/list/folder so people can act on what they see.

Two view modes via a top-right toggle:
- **Overview** — at-a-glance: KPI strip, Coordinator roster, "What's sticking" feed, Active-by-phase summary, full Portfolio dot-matrix of all 43 projects.
- **Detailed** — sortable scrollable per-project capsule pipelines + dedicated Permits dashboard section (KPI cards, 90-day expiration timeline, agency breakdown, attention feed).

Filters (shared across both views): **Search · Coordinator · Phase**.

**Visual reference:** `docs/mockups/portfolio_dashboard_v4.html` — match this exactly for v1. The HTML is fully styled and behavior-complete with sample data; your job is to replace the sample data with live ClickUp data and wire the click-throughs.

---

## 2. Tech stack (locked)

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — no shadcn/ui for v1, keep dependency tree minimal
- **ClickUp REST API** direct (no MCP, no CLI shell-out)
- **Auth:** Personal API token in env var (single-team app — OAuth deferred to v2)
- **Caching:** Next.js `unstable_cache` / Vercel Edge cache, **60-second TTL**
- **Updates:** Polling (client refreshes on tab focus + every 60s) — webhooks deferred to v2
- **Writes:** **None for v1.** Read-only. All state lives in ClickUp.
- **Project list source:** Crawl folders in the Active Projects space (Master Projects Board cross-reference deferred to v2)

---

## 3. ClickUp data contract

### Workspace landmarks (constants)

```ts
export const CLICKUP = {
  WORKSPACE_ID: '9017603275',
  ACTIVE_PROJECTS_SPACE_ID: '90173230172',
  // Per-project folders have these standard lists by name:
  PLANS_LIST_NAME: '03. Plans',
  PERMITS_LIST_NAME: '04. Permits',
  PROJECT_OVERVIEW_LIST_NAME: '00. Project Overview',
};
```

### Plans (`03. Plans` list) — fields to read

| Field | Type | Notes |
| --- | --- | --- |
| Task name | string | Display label (e.g. "Architectural", "Foundation") |
| Status | workspace status | One of: `to submit`, `to file`, `filed`, `waiting on`, `approved` — display as: To submit, To file, Filed, Waiting on, Approved |
| Plan Type | dropdown | 25 options: Structural, Architectural, Foundation, SOE, Plumbing, Mechanical, Electrical, Fire Alarm, Sprinkler System, Standpipe, Site Safety Plan, etc. |
| Set Type | dropdown | Field Set / Filing Set |
| Filing Phase | dropdown | Pre-Filing Requirements / Core DOB Filings / MEP Filings / Fire Protection Systems / Site Infrastructure / Temp Construction Plans / Compliance & Safety / Special Coordination |
| Filing Date | date | When filed at DOB |
| Expiration Date | date | If applicable |
| Agencies | labels (multi) | DOB / DOT / FDNY / PARKS / FEMA / NYS Land Surveyor / MTA / DEP |
| 🔗 Filing Plan Link | URL | SharePoint to filing set |
| 🔗 Field Plan Link | URL | SharePoint to field set |
| Archive Drive | URL | SharePoint to archive folder |
| Assignees | users | Used as coordinator fallback if no custom field |

### Permits (`04. Permits` list) — fields to read

| Field | Type | Notes |
| --- | --- | --- |
| Task name | string | Display label |
| Permit Type | dropdown | Building / Electrical / Plumbing / Mechanical / Special Event / DOT |
| Permit Status | dropdown | **Active / Expiring Soon / Expired** — this drives the permits dashboard |
| Filing Phase | dropdown | (same as Plans) |
| Agencies | labels | (same as Plans) |
| Filing Date | date | |
| Expiration Date | date | Drives Expiring Soon / Expired logic |
| Amount | currency | Permit fee |
| Permits Drive | URL | SharePoint to permit PDFs |

### Project Overview (`00. Project Overview` list) — read per project

| Field | Type | Notes |
| --- | --- | --- |
| Project Phases | dropdown | **Pre-Construction / Construction / Post-Construction** — drives Phase filter |
| Project Status | dropdown | Starting Soon / Active / On Hold / Stop Work Order / Completed |
| Assignees | users | Coordinator assignment source |
| Building size / unit count | text or custom field | Display metadata |

### API endpoints

- `GET /api/v2/space/{ACTIVE_PROJECTS_SPACE_ID}/folder` — list all project folders
- `GET /api/v2/folder/{folder_id}/list` — get the 8 standard lists for a project
- `GET /api/v2/list/{list_id}/task?subtasks=true&include_closed=false` — get tasks for a list
- `GET /api/v2/list/{list_id}/field` — get custom field schema (for option IDs)

**Auth header:** `Authorization: {CLICKUP_API_TOKEN}` (raw token, no `Bearer` prefix — ClickUp's API uses raw tokens).

**Rate limit:** 100 requests/minute per token. With ~43 projects × 2 lists = 86 requests for a full refresh, fit comfortably within the limit. Cache aggressively (60s) to avoid hammering it.

---

## 4. Click-through map

Every interactive element deep-links to ClickUp. Use these URL patterns:

| Element | Click destination | URL pattern |
| --- | --- | --- |
| Project name (any view) | Project folder in ClickUp | `https://app.clickup.com/{WORKSPACE_ID}/v/o/f/{folder_id}` |
| Status dot/pill in matrix (e.g. Arch · Approved) | The specific Plan task | `https://app.clickup.com/t/{task_id}` |
| Capsule pill in Detailed view | The specific Plan task | `https://app.clickup.com/t/{task_id}` |
| Permits summary cell ("● 8 active", "● 1 expired") | The project's `04. Permits` list | `https://app.clickup.com/{WORKSPACE_ID}/v/li/{list_id}` |
| Permit row in "needs attention" feed | The specific Permit task | `https://app.clickup.com/t/{task_id}` |
| "What's sticking" feed item | The underlying Plan or Permit task | `https://app.clickup.com/t/{task_id}` |
| Coordinator avatar | **Filters the dashboard** by that coordinator (no external link) | — |
| Coordinator roster card | **Filters the dashboard** by that coordinator | — |
| KPI card | v1: no-op (or tooltip). v2: opens filtered ClickUp view | — |
| Phase summary card | **Filters the dashboard** by that phase | — |
| "View all permits →" link | Workspace-level permits search view | `https://app.clickup.com/{WORKSPACE_ID}/v/s/everything?filters[][listIds][]={permits_list_ids}` |

All external links open in a **new tab** with `target="_blank" rel="noopener"` since the dashboard is iframed.

---

## 5. Coordinator assignment logic

ClickUp doesn't currently have a dedicated "Project Coordinator" custom field on `00. Project Overview` (this is flagged as an open item in the design spec). For v1, derive the coordinator using this priority:

1. **If** a custom field named `Project Coordinator` exists on the Project Overview task → use that.
2. **Else if** the Project Overview task has assignees → use the first assignee whose email matches Faigy (`faigy@leaditbuilders.com`) or Malky Kahan (`mkahan@leaditbuilders.com`).
3. **Else** → mark as **Unassigned**.

Hard-code the coordinator roster for v1:
```ts
export const COORDINATORS = [
  { id: 'faigy',  name: 'Faigy Follman', email: 'faigy@leaditbuilders.com',  initials: 'FF', color: '#534AB7', bg: '#EEEDFE' },
  { id: 'malky',  name: 'Malky Kahan',   email: 'mkahan@leaditbuilders.com', initials: 'MK', color: '#0F6E56', bg: '#E1F5EE' },
];
```

When the team adds the proper custom field, the priority-1 branch picks it up automatically.

---

## 6. "What's sticking" algorithm

Surface the top 5 items most likely to need action today, in this priority order:

1. **Expired permits** (Permit Status = Expired) — red, severity 1
2. **Permits expiring in ≤ 7 days** (Expiration Date − today ≤ 7) — orange, severity 2
3. **Plans stuck "Waiting On" for > 7 days** (status = waiting on AND `date_updated` > 7d ago) — amber, severity 3
4. **Permits expiring in ≤ 30 days** (Expiration Date − today ≤ 30) — amber, severity 4
5. **Plans stuck "Waiting On" for > 3 days** — yellow, severity 5

Sort by severity, then by days-stuck DESC. Show top 5. Each item: coordinator avatar, project name, what's stuck, days/date. Click-through to the underlying task.

---

## 6.5. Logo & brand

**Official brand assets** live in `public/lib_brand/`:
- `public/lib_brand/lead_it_builders_logo.png` — the primary logo (hex-mark + orange smokestack accent + "LEAD IT BUILDERS" wordmark, ~2550×3300 source)
- `public/lib_brand/lead_it_builders_logo.jpg` — same in JPG
- `public/lib_brand/lead_it_builders_logo.pdf` — vector source

**Brand colors** (sampled from the official logo):
- **LIB Black** — `#000000` (or `#231F20` soft-black alternate) — wordmark, headers, primary text
- **LIB Orange** — `#F47832` — accent, top border, primary call-to-action, brand stripe (use sparingly; this is the accent, not a primary fill)
- White / off-white — backgrounds

**Header bar specification:**
- Layout: `[logo (h=48px, width auto)] [Plans & Permits Dashboard / sync status] [Live indicator pill on right]`
- Top accent: `border-top: 3px solid #F47832` on the header card (the brand orange ties the dashboard to the LIB visual identity)
- Logo: load from `/lib_brand/lead_it_builders_logo.png` with an SVG fallback (hex + orange stripe) if the file is missing
- Live indicator: green dot + "Live" pill (bg `#EAF3DE`, text `#173404`) when last sync ≤ 2 min ago; amber pill ("Stale · {N}m ago") otherwise
- Header is NOT sticky — scrolls with the page (iframe-friendly)

Header copy (locked):
- Title: `Plans & Permits Dashboard`
- Subtitle: `{N} active projects · live from ClickUp · synced {n} min ago`

## 7. Environment variables

`.env.local` (and Vercel project env):

```
CLICKUP_API_TOKEN=pk_xxxxxxxxxxxxxxxxxxxx   # personal token from ClickUp Settings → Apps → API
CLICKUP_WORKSPACE_ID=9017603275
CLICKUP_ACTIVE_PROJECTS_SPACE_ID=90173230172
NEXT_PUBLIC_CLICKUP_BASE_URL=https://app.clickup.com
```

Ship `.env.local.example` with the variable names and a one-line comment each. **Don't commit a real token.**

---

## 8. Suggested file structure

```
/app
  layout.tsx
  page.tsx                 # main dashboard
  /api
    /projects/route.ts     # GET — aggregated project list with plans/permits summary
    /refresh/route.ts      # POST — invalidate cache (optional)
/components
  LogoHeader.tsx           # logo + brand + live indicator (loads /public/logo.svg)
  Dashboard.tsx            # top-level shell + state
  FilterBar.tsx            # search + coordinator + phase + view toggle
  KpiStrip.tsx
  CoordinatorRoster.tsx
  OverviewView.tsx         # composes Sticking + Phases + Matrix
  StickingList.tsx
  PhaseSummary.tsx
  PortfolioMatrix.tsx
  DetailedView.tsx         # composes sort + project list + permits panel
  ProjectCard.tsx          # capsule pipeline row
  PermitsPanel.tsx         # KPI + timeline + agency + attention
  StatusPill.tsx
  StatusDot.tsx
  CoordinatorAvatar.tsx
/lib
  clickup.ts               # API client (fetch wrapper + endpoints)
  types.ts                 # TypeScript types
  transforms.ts            # ClickUp tasks → dashboard data
  status-map.ts            # status name → color + display label
  coordinator.ts           # coordinator derivation logic
  sticking.ts              # "what's sticking" algorithm
  urls.ts                  # ClickUp deep-link URL builders
  cache.ts                 # caching wrapper
/docs
  /mockups/
    portfolio_dashboard_v4.html   # the locked design reference
  AGENTS.md               # this file
.env.local.example
README.md
```

---

## 9. Scope for v1

### In scope
- Both views (Overview / Detailed) matching `portfolio_dashboard_v4.html` exactly
- Filters: search, coordinator, phase
- Sort in Detailed view: Urgency / Coordinator / Phase / A→Z / Last activity
- Live ClickUp data via REST API with 60s cache
- All click-throughs to ClickUp (per §4)
- Coordinator avatars + roster
- "What's sticking" feed
- Active-by-phase summary
- Portfolio dot-matrix (all 43 projects scrollable)
- Permits panel: KPI cards, 90-day expiration timeline, agency breakdown, attention feed
- Empty states (no data / filter returns zero)
- Loading skeleton on first paint
- Auto-refresh on tab focus and every 60s
- Iframe-friendly (no fixed positioning, no top-level scroll trap)
- Dark mode (CSS variables already set in mockup)

### Out of scope (v2+)
- OAuth (use personal token for v1)
- Webhook-driven live updates (polling is fine)
- Write operations (no inline status edits)
- Per-project drill-down page (separate task — v2 work)
- Risk indicator filter (removed per feedback)
- Agency filter (removed per feedback — Agency breakdown widget stays, but no filter)
- Multi-address project split (Woodycrest 940/942, MT Hope 23/27, Bergen 631/633 → render as single rows for v1; revisit in v2)
- Mobile-first layout (desktop iframe only for v1)
- Analytics / error tracking (Vercel Analytics is enough for v1)

---

## 10. Acceptance criteria

A v1 build is shippable when:

1. Open the deployed Vercel URL and the dashboard renders with live data from the LIB ClickUp workspace within 3 seconds.
2. The Overview view shows: 5 KPI cards, Coordinator roster (Faigy / Malky / Unassigned with correct counts), "What's sticking" with at least 1 real item, Active-by-phase with correct counts per phase, Portfolio matrix with one row per active project showing coordinator avatar + plan-type status dots + permits summary.
3. The Detailed view shows: sort chips, scrollable project list with capsule pipelines, and the full Permits panel.
4. Clicking any project name opens that project's ClickUp folder in a new tab.
5. Clicking any status dot/pill opens the corresponding Plan task in ClickUp.
6. Clicking any permit row opens the corresponding Permit task in ClickUp.
7. Changing the Coordinator dropdown filters the entire dashboard (KPI cards, sticking list, matrix, detailed list all update).
8. Changing the Phase dropdown filters likewise.
9. The dashboard refreshes automatically on tab focus and every 60s.
10. The iframe-embed test passes: load the dashboard inside ClickUp's "Embed" widget — no scroll issues, no auth prompts, no fixed-position breakage.
11. ClickUp API rate limit not exceeded under normal use (verify via Vercel logs).

---

## 11. Getting started (suggested first commits)

1. `pnpm create next-app@latest . --typescript --tailwind --app --no-src-dir` — scaffold
2. Add `.env.local.example` and `lib/clickup.ts` (basic fetch wrapper, list folders / list tasks / get task)
3. Add `lib/types.ts` (Project, Plan, Permit, Coordinator types)
4. Add `app/api/projects/route.ts` — server route that aggregates the full project list with plans/permits summary; return it as one JSON blob
5. Copy `docs/mockups/portfolio_dashboard_v4.html` styles → Tailwind classes in `components/`
6. Build `Dashboard.tsx` shell + filter state (URL search params for deep-linkability)
7. Build `OverviewView.tsx` first (simpler), then `DetailedView.tsx`
8. Wire up click-throughs
9. Deploy to Vercel
10. Test iframe-embed inside a ClickUp Dashboard widget

---

## 12. Open questions to flag during build

- **Project Coordinator custom field** — propose adding a `Project Coordinator` dropdown custom field on the `00. Project Overview` task type. Until then, fall back to assignees (per §5).
- **Consultant chain** (architect / expediter / filing co.) — Faigy used to track these in row 2 of her Excel sheets. Where in ClickUp? Probably a new custom field on `00. Project Overview`. Flag for design discussion before v2.
- **"Last activity"** sort — what's the source? ClickUp's `date_updated` on the most recent Plan/Permit task in the project? Decide and document.
- **Empty-state copy** — propose copy for "no projects match these filters" and similar empties; loop in product before shipping.

---

## 13. Reference

- **Design spec (Notion):** https://www.notion.so/35e31e50091a8194b007fb68dbf66024
- **Plans & Permits SOP:** https://www.notion.so/35e31e50091a8131b7c7c8a566642392 (statuses, fields — canonical)
- **LIB Project Wikipedia (internal):** https://www.notion.so/31b31e50091a817d8d62f33933294c43
- **ClickUp workspace:** https://app.clickup.com/9017603275
- **ClickUp API docs:** https://developer.clickup.com/reference

If anything in this brief contradicts the design spec or the Plans & Permits SOP, **the SOP wins**. Flag it, don't guess.
