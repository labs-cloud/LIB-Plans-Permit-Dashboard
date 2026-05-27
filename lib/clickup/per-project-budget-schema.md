# Per-Project "01. Budget" List — ClickUp Schema

Each project folder in the **Active Projects** space (`90173230172`) contains a
list named **"01. Budget"**. All of these lists share the same workspace-level
custom field IDs — identical to those on the now-deprecated central
Budget-Bidding Database list (`901713908317`).

## Discovery

Three representative projects were inspected (2026-05):

| Project folder | "01. Budget" list ID |
|---|---|
| 3069 Barker Ave | `901712917827` |
| 800 Brady Ave | *(verified present)* |
| 1931-1935 Bedford Ave | *(verified present)* |

All 50 active-project folders have an "01. Budget" list (confirmed via workspace
hierarchy). The field IDs below are workspace-level and apply to every one of them.

## Task structure

Each task in the "01. Budget" list represents **one trade** for that project.

- `task.name` — trade name (verbatim, e.g. "Special Inspector", "Plumbing & Sprinkler")
- `task.status.status` — workflow status (see below); this is the canonical source of
  truth, **not** a custom field
- `task.date_updated` — used as tie-breaker during deduplication

## Workflow statuses (`task.status.status`)

| Value | Meaning |
|---|---|
| `"to budget"` | Not yet priced |
| `"open for bidding"` | Live in bidding process |
| `"budget set"` | Budget locked in |
| `"bid received"` | Bid has been received |

## Custom field IDs

| Field label | ID | Type | Notes |
|---|---|---|---|
| `💲 Budget Allocated` | `932ad261-d33f-4e50-83d0-cb5be27f3be9` | currency | Estimated budget — maps to `est` |
| `Updated Budget` | `fababed6-f5d6-41e5-a078-24234ce9df56` | currency | Manual override — maps to `fin` |
| `Cost Type` | `d31ad583-bfa3-4b02-98df-fb65f1ccbb7f` | drop_down | `orderindex 0` = Soft Costs, `orderindex 1` = Hard Costs |
| `Trade` | `f3cef4fb-a5bc-4a61-8ddd-048df2475b20` | drop_down | 58-option canonical taxonomy (not used — task.name preferred) |
| `Trade List` | `a42e5dd9-18f6-4f27-b8ca-e3f64d59fa45` | short_text | Canonical trade name as plain text |
| `Project ID` | `0da6c33d-9953-4990-89b2-608b34ba0053` | short_text | Equals the folder name verbatim |
| `Bidding Status` | `f8084252-c3cc-4dc9-a21f-b9ddd6a4cf39` | drop_down | Same options as Bidding dashboard |
| `1. Subcontractors` | `f6d611a7-71e9-49d6-a95e-3301de536333` | labels | Array of label option IDs |
| `2. Trade Type` | `e86b14c6-5c9f-4391-ab51-846acfe366a8` | drop_down | `0` = Biddable, `1` = Set |
| `Start Bidding Date` | `79dd4c4b-1d61-49ea-b470-ee893e79ef63` | date | |
| `Bid/Contracted Amount` | `c4d0f269-5875-4b47-bc29-85b52d8931b9` | currency | |
| `🔗 Link` | `b0da1f9e-840e-4932-935b-f3fc2453f0df` | url | SharePoint folder for this trade |

## Effective budget derivation (`newv`)

```
newv = Updated Budget ?? 💲 Budget Allocated
```

If `Updated Budget` is set, it overrides the estimate. Otherwise the estimate
(`💲 Budget Allocated`) is used verbatim. This rule applies to **all** trades
without exception.

## Deduplication

Occasionally a project has two tasks with the same (Cost Type, trade name) pair
due to data-entry errors. The transform deduplicates per project:

1. Group by `(costType, task.name)`
2. Keep the row with a non-zero `💲 Budget Allocated`; tie-break by most-recent
   `task.date_updated`
3. The kept row gets `hasDuplicate: true` and the ClickUp URLs of the dropped
   rows in `duplicateTaskUrls[]`

## Sample tasks (3069 Barker Ave, list `901712917827`)

| task.name | task.status.status | Budget Allocated | Updated Budget | Cost Type |
|---|---|---|---|---|
| Special Inspector | open for bidding | $80,000 | — | Soft Costs |
| Superintendent | open for bidding | $250,000 | — | Soft Costs |
| Plumbing & Sprinkler | to budget | $1,000,000 | — | Hard Costs |
