# Per-Project "02. Bidding" List Schema

Confirmed from live ClickUp data (May 2026, workspace 9017603275).

## Structure

Each folder under the **Active Projects** space (`90173230172`) contains a list
named `02. Bidding`. Each task in that list represents **one subcontractor
bidding on one trade** — NOT one trade row with sub columns.

```
Folder: 3930 Carpenter  (folder id: 90178081339)
└── 02. Bidding  (list id: 901712788833)
    ├── task "NY Design"          → Trade: Expediter,  status: awarded,       Bid/Contracted Amount: $47,300
    ├── task "Slate Windows"      → Trade: Windows,    status: awarded,       Bid/Contracted Amount: $94,500
    ├── task "Pinnacle Roofing"   → Trade: (unset),    status: bid recieved,  Bid/Contracted Amount: $338,776
    └── ...  (84 tasks total)
```

## Task Fields

| Field                    | Source                      | Field ID / Notes                                        |
|--------------------------|-----------------------------|---------------------------------------------------------|
| **Subcontractor name**   | `task.name`                 | The company being solicited for a bid                   |
| **Bidding status**       | `task.status.status`        | Native ClickUp task status (see Status Values below)    |
| **Trade**                | custom field `f3cef4fb-...` | `CLICKUP.FIELD.TRADE` — same global field ID in all lists. `type: drop_down`, value = orderindex (number). Resolve to option name from `type_config.options`. |
| **Bid / Contract amount**| custom field `c4d0f269-...` | `name: "Bid/Contracted Amount"`, `type: currency`. Contains the sub's proposal amount, or the contracted amount once awarded. |
| **Project ID**           | custom field `0da6c33d-...` | `CLICKUP.FIELD.PROJECT_ID` — matches the folder name verbatim |
| **Award Date**           | custom field `64e154f8-...` | Date the bid was awarded (optional)                     |
| **Date Updated**         | custom field `496dbe34-...` | Last-contact / follow-up date                           |
| **1. Subcontractors**    | custom field `f6d611a7-...` | `CLICKUP.FIELD.SUBCONTRACTORS` — labels field linking to canonical sub directory. **Not used for the sub name** — use `task.name` instead. |

## Status Values (task.status.status)

ClickUp returns these in lowercase. They map to the dashboard 8-color palette:

| ClickUp status string  | Dashboard `BidStatus` | Color bucket     |
|------------------------|-----------------------|------------------|
| `not started`          | `ntb`                 | grey — not yet bid |
| `rfp sent`             | `snt`                 | blue — sent       |
| `followed up`          | `fu1`                 | yellow — follow-up |
| `bid recieved`         | `rec`                 | orange — received (ClickUp's persistent typo) |
| `bid received`         | `rec`                 | orange — received |
| `awarded`              | `fnl`                 | green — finalized |
| `no bid / declined`    | `hld`                 | red — hold/declined |

## Dashboard Transform Logic

Because each task = one sub bid, the `transformBiddingTasksByName` function
**groups tasks by Trade** before building the matrix:

1. Extract the `Trade` dropdown's `orderindex → name` map from `CLICKUP.FIELD.TRADE`
   (`f3cef4fb-a5bc-4a61-8ddd-048df2475b20`) — same field ID across all project lists
2. For tasks where Trade dropdown is unset: fall back to extracting the trade
   name from the `🔗 Link` SharePoint URL (field `b0da1f9e`), using the path
   segment immediately after `Bids/` (e.g. `.../Bids/Foundation/Elite Concrete`
   → `"Foundation"`). Only skip with `console.warn` if both are null.
3. For each trade group: assemble up to 5 subs in insertion order
   - Sub name  = `task.name`
   - Sub amount = `"Bid/Contracted Amount"` field (by name)
   - Sub status = `mapBiddingStatusName(task.status.status)`
4. `low` = `MIN(bid amounts)` for that trade

## Contrast with Central Budget-Bidding Database (list 901713908317)

The old central list used a different shape:
- One task = one **trade row**
- Sub names in `Sub 1`–`Sub 5` short-text fields (IDs in `CLICKUP.FIELD.SUB_*`)
- Sub amounts in `Sub 1 Amount`–`Sub 5 Amount` currency fields
- Bidding status in a **custom field** `f8084252-...` (not the task status)

The route falls back to this path (with `console.warn`) when a folder has no
`02. Bidding` list — these are pre-migration projects.
