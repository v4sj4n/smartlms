# School years

The academic calendar is a first-class record: one row per school year, at most
one of them current. Subjects, grades and study records are filed under the year
they belong to, which is what makes "show me this year" and "what did I take
last year" answerable.

## The shape of a year

| Field | Meaning |
|---|---|
| `name` | Two calendar years, `2026/2027`. `2026-2027` is accepted and stored with a slash. |
| `starts_on` | First teaching day (ISO date, optional). |
| `ends_on` | Last exam day (ISO date, optional). |
| `is_active` | The current year. Exactly zero or one row holds it. |
| `subjects` | Read-only count of subjects filed under the year. |

"Archived" is not a separate flag: a year that is not current is a past year,
and the screen shows it that way.

The single active row is enforced by the database, not by convention:

```sql
CREATE UNIQUE INDEX school_years_one_active ON school_years (is_active) WHERE is_active = 1;
```

Every write that promotes a year clears the previous one in the same
transaction, so two current years can never exist even for a moment.

## How subjects attach to a year

`subjects.school_year` holds the year's **name**, and the API keeps it honest:

- Creating a subject without a year files it under the current year.
- Naming a year the catalog does not hold is refused with `400`, so a typo
  cannot mint a year nobody can list.
- `GET /api/subjects?school_year=2026/2027` narrows the list to one year.
- Renaming a year follows through to `subjects.school_year` and
  `grade_scales.school_year` in the same transaction. Nothing is left pointing
  at a year that no longer exists.

Grade scales are keyed by the same year name (`loadScale` in
`backend/internal/handler/grades.go` picks the scale for the subject's year), so
each year can grade differently without touching the others.

## Removing a year

`DELETE /api/school-years/{id}` is refused while the year is either:

- **current** → activate another year first, or
- **still holding subjects** → move them to another year, or rename the year
  instead (everything filed under it follows the rename).

Deleting a *school year* never deletes subjects, lectures or grades.

## API

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/school-years` | `{ items: [...], active }`, newest first |
| `POST` | `/api/school-years` | `{ name, starts_on?, ends_on?, is_active? }`; the first year created becomes current |
| `PATCH` | `/api/school-years/{id}` | partial; `is_active: true` promotes, renaming cascades |
| `POST` | `/api/school-years/{id}/activate` | one-step "make current" |
| `DELETE` | `/api/school-years/{id}` | guarded as described above |

Module `school-years`, permissions `school-years.view` and
`school-years.manage`. `ADMIN` holds both; other roles read the year names off
the subjects they are enrolled in.

## Screens

- **`/school-years`** (Manage) — the calendar: every year with its dates,
  subject count, status, and actions to make current, edit or delete.
- **Subjects** — a year filter in the page header, a year and semester chip on
  every row, and a school-year select on the subject form. An empty select on
  create means "the current year".
- **Grades / Study record** — group and label entries by the year they were
  filed under (already the case; the year is now always a real one).

## Migrating an existing database

Migration `000013_school_years` adopts what the subjects already said:

1. Normalises `subjects.school_year` and `grade_scales.school_year` to the slash
   form (`2026-2027` → `2026/2027`).
2. Creates one `school_years` row per distinct value found.
3. Makes the newest of them current.
4. Adds the `school-years` module and its permissions to `ADMIN`.

Subjects that had no year keep none; they show as "No school year" until one is
picked in the subject form.

## Starting a new year

1. Add the new year on `/school-years` with its dates, leaving "Make this the
   current year" on. The previous year is archived by that single change.
2. New subjects are filed under the new year automatically.
3. Duplicate the subjects that continue (or move them with `PATCH
   /api/subjects/{id}`), and leave last year's grading untouched — its grade
   scale still applies to it.
