# Per-Project "02. Bidding" List Schema

Confirmed from live ClickUp data (May 2026, workspace 9017603275, space 90173230172).

## Structure — Parent / Subtask Hierarchy

Each folder under the **Active Projects** space contains a list named `02. Bidding`.
The list uses a **parent/subtask hierarchy**:

```
Folder: 1931-1935 Bedford Ave  (folder id: 90177597601)
└── 02. Bidding  (list id: 901712166316)
    ├── TRADE parent task: "Plumbing & Sprinkler"  (task_type="Trade", parent=null)
    │   ├── SUB subtask: "Swift Machanical"         (task_type="Contact", parent="86e0gc94w")
    │   ├── SUB subtask: "Target Piping"            (task_type="Contact", parent="86e0gc94w")
    │   ├── SUB subtask: "Quality Piping"           (task_type="Contact", parent="86e0gc94w")
    │   └── SUB subtask: "Tri State Plumbing"       (task_type="Contact", parent="86e0gc94w")
    ├── TRADE parent task: "Site Safety Plans"      (task_type="Trade", parent=null)
    │   └── SUB subtask: "Sierra Construction"      (task_type="Contact", parent="86e0gc9kz")
    └── ...
```

**Root tasks** (`task.parent = null`, `task_type = "Trade"`) → one row per **trade**  
**Subtasks** (`task.parent = <trade task ID>`, `task_type = "Contact"`) → one row per **subcontractor bid**

> **Critical note**: Before this was confirmed, the dashboard was incorrectly using the
> "Trade" dropdown field (F.TRADE / `f3cef4fb`) to resolve trade names. That field is
> **NOT set on subtask rows** — all subtasks have it unset. Trade name must be derived
> from the parent task's `name` property.

## Task Fields — Subcontractor (Subtask) Rows

| Field                    | Source                           | Field ID / Notes                                     |
|--------------------------|----------------------------------|------------------------------------------------------|
| **Subcontractor name**   | `task.name`                      | The company being solicited for a bid                |
| **Trade**                | `parentTask.name`                | Derive from `parentIdToName[task.parent]`            |
| **Bidding status**       | `task.status.status`             | Native ClickUp task status (lowercase; see below)    |
| **Bid / Contract amount**| custom field `c4d0f269-5875-4b47-bc29-85b52d8931b9` | `name: "Bid/Contracted Amount"`, `type: currency`. Look up by name via `getCurrencyByName(task, 'Bid/Contracted Amount')` |
| **Date Sent RFP**        | custom field `5e4f2e82-5433-446a-8d23-b79bf87233fa` | `name: "Date Sent RFP"`, `type: date` (Unix ms as string) |
| **Followed-Up**          | custom field `91a0fbac-ba88-40db-941c-f4547bd783c3` | `name: "Followed-Up"`, `type: date` (Unix ms as string) |
| **Subcontractor link**   | custom field `d0dd40bb-1ec1-40d5-96ab-c42366b19412` | `name: "Subcontractor"`, `type: list_relationship` — points to sub record in another list; `task.name` is still the canonical sub name |

## Task Fields — Trade (Parent/Root) Rows

| Field           | Source          | Notes                                                  |
|-----------------|-----------------|--------------------------------------------------------|
| **Trade name**  | `task.name`     | e.g. "Plumbing & Sprinkler", "Site Safety Plans"       |
| **task_type**   | `task.task_type`| Always `"Trade"` for root rows                         |
| **parent**      | `task.parent`   | Always `null` for root rows                            |

## Status Values (`task.status.status` on subtask rows)

ClickUp returns these in lowercase. They map to the dashboard 8-color palette:

| ClickUp status string  | Dashboard `BidStatus` | Color bucket          |
|------------------------|-----------------------|-----------------------|
| `not started`          | `ntb`                 | grey — not yet bid    |
| `rfp sent`             | `snt`                 | blue — sent           |
| `followed up`          | `fu1`                 | yellow — follow-up W1 |
| `bid recieved`         | `rec`                 | orange — received (ClickUp's persistent typo) |
| `bid received`         | `rec`                 | orange — received     |
| `awarded`              | `fnl`                 | green — finalized     |
| `no bid / declined`    | `hld`                 | red — hold/declined   |
| `no bid`               | `hld`                 | red — hold/declined   |

## API Fetch Requirements

`getTasksInList` **must** be called with `includeSubtasks = true` for per-project
bidding lists. Without it, only the root Trade tasks are returned and all sub bid
data is invisible.

```typescript
const tasks = await getTasksInList(biddingList.id, /* includeClosed */ true, /* includeSubtasks */ true);
```

## Dashboard Transform Logic (`transformBiddingTasksByName`)

1. **First pass**: collect root tasks (`task.parent` is null/undefined) → `parentIdToName[task.id] = task.name`
2. **Pre-populate** trade buckets in parent-task insertion order (preserves ClickUp ordering)
3. **Second pass**: for each subtask, `tradeName = parentIdToName[task.parent]`; warn and skip if parent not found
4. **Per trade**: assemble up to 5 subs in insertion order
   - `sub.name`   = `task.name`
   - `sub.amount` = `"Bid/Contracted Amount"` field (by name)
   - `sub.status` = `mapBiddingStatusName(task.status.status)`
5. **`low`** = `MIN(bid amounts)` for that trade
6. Trades with zero subs are omitted from output

## Contrast with Central Budget-Bidding Database (list 901713908317)

The fallback central list uses a different schema (pre-migration projects only):

- One task = one **trade row**
- Sub names in `Sub 1`–`Sub 5` short-text fields (IDs in `CLICKUP.FIELD.SUB_*`)
- Sub amounts in `Sub 1 Amount`–`Sub 5 Amount` currency fields
- Bidding status in **custom field** `f8084252-...` (not the task's native status)

The route falls back to this path with `console.warn` when a folder has no `02. Bidding` list.
