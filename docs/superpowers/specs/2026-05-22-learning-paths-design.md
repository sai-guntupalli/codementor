# Learning Paths — Design Spec
**Date:** 2026-05-22  
**Status:** Approved

## Overview

Extend CodeMentor's `/learn` page into a unified hub for all learning paths. Two categories exist under a single term — "Learning Path":

- **Curated** — admin-seeded, read-only to users. Examples: "Python Fundamentals", "Interview Prep 101".
- **Personalized** — one per user, algorithm-generated from their profile (experience, goal, topics), persisted in the DB and refreshed when the profile changes. This replaces the current ephemeral `GET /users/me/learning-path` computation.
- **Custom** — user-created, unordered problem sets. Examples: "DP problems I keep failing", "Weekend warmups".

All three types surface on the `/learn` page under two sections: "Curated Paths" (curated + personalized) and "My Paths" (custom). Progress is tracked for all types.

From the `/problems` page, users can add problems to their custom paths via a per-problem button or a multi-select bulk mode.

---

## Data Model

### `learning_paths` (new table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `title` | string | Required |
| `description` | string, nullable | |
| `type` | enum: `curated \| personalized \| custom` | |
| `created_by` | UUID → users, nullable | NULL for curated; user_id for personalized and custom |
| `is_public` | bool, default false | Reserved for future sharing |
| `sort_order` | int, nullable | Controls display order of curated paths |
| `created_at` | timestamptz | |

**Constraints:**
- Unique on `(type='personalized', created_by)` — one personalized path per user.
- `created_by` is NOT NULL when `type` is `personalized` or `custom`.

### `learning_path_problems` (new table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `learning_path_id` | UUID → learning_paths | |
| `problem_id` | UUID → problems | |
| `added_at` | timestamptz | |

**Constraints:**
- Unique on `(learning_path_id, problem_id)` — no duplicates.
- No `position` column — custom paths are unordered.

### Progress (derived)

Progress is computed at query time: cross-reference `learning_path_problems` with the user's `submissions`. No separate progress table.

Response shape per path:
```json
{
  "solved_count": 5,
  "total_count": 15,
  "progress_pct": 33
}
```

---

## API

### Learning Paths

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/learning-paths` | required | List all paths visible to user: curated + personalized + their custom paths. Includes progress per path. |
| `POST` | `/learning-paths` | required | Create a custom path. Body: `{title, description?}`. Returns created path. |
| `PATCH` | `/learning-paths/{id}` | required | Rename/update a custom path (owner only). |
| `DELETE` | `/learning-paths/{id}` | required | Delete a custom path (owner only). |

### Problems Within a Path

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/learning-paths/{id}/problems` | required | List problems in path with `solved: bool` per problem. |
| `POST` | `/learning-paths/{id}/problems` | required | Add problem. Body: `{problem_id}`. Owner only (custom paths). |
| `DELETE` | `/learning-paths/{id}/problems/{problem_id}` | required | Remove problem. Owner only (custom paths). |

### Backwards Compatibility

`GET /users/me/learning-path` is kept alive but internally delegates to the persisted personalized path row. Deprecated for new frontend code.

### Personalized Path Lifecycle

- Created when user completes profile setup (`/profile/setup` final step).
- Regenerated (problems list replaced) when `PATCH /users/me` changes `coding_experience`, `learning_goal`, or `interested_topics`.
- If no personalized path exists yet (legacy users), it is created lazily on first `GET /learning-paths`.

---

## UI

### `/learn` — Unified Hub

**Curated Paths section** (top):
- Shows curated paths (sorted by `sort_order`) and the user's personalized path.
- Each card: title, badge (`PERSONALIZED` or `CURATED`), progress bar, solved/total count, action button ("Start" if 0% or "Continue" otherwise).

**My Paths section** (bottom):
- Shows custom paths created by the user.
- `+ New path` button in the section header opens an inline modal: text field for path name, optional description, create button.
- Empty state: "You haven't created any paths yet. Add problems from the library to get started."
- Each card: title, badge (`CUSTOM`), progress bar, solved/total count, `⋮` menu (rename, delete).

Clicking any path card navigates to `/learn/[id]` — a dedicated detail page for that path.

**Detail view** (per path):
- Problem list showing each problem's title, difficulty badge, topics, solved state (green checkmark / unsolved dot).
- For custom paths: remove button per row, and an "Add more problems" link that navigates to `/problems`.

### `/problems` — Adding to a Path

**Per-problem button:**
- Each problem row/card gets a `BookmarkPlus` icon button.
- On click: popover with user's custom path list + "Create new path…" at the bottom.
- Selecting a path adds the problem (optimistic UI, error toast on failure).
- If already in the path: shows a filled icon; clicking removes it.

**Multi-select mode:**
- "Select" button in the problems page header activates checkboxes on each row.
- A sticky bottom action bar appears: "{N} selected → Add to path ▾" + "Cancel".
- Dropdown lists custom paths + "Create new path…".
- On confirm: bulk POST, success toast, selection mode exits.

---

## Error Handling

- Attempting to add a problem already in the path: 409 response, frontend shows "Already in this path" toast (non-error, informational).
- Attempting to modify a curated or personalized path: 403 response, frontend shows "This path can't be edited" toast.
- Deleting a custom path that has problems: cascade delete `learning_path_problems` rows. No orphan problems.

---

## Out of Scope

- Sharing/public paths (is_public column is a stub for later).
- Reordering problems within a custom path (paths are unordered).
- Admin UI for creating curated paths — curated paths are seeded via migration/seed scripts.
- Stripe or billing gating on this feature.
