# Course weeks

A school year is taught in two halves. Each subject runs in one of them, and
inside that season it is read week by week, the way the old LMS laid it out:

```
Fall semester (Semestri 1)
├── Week 1 · 23 Nov 2026 – 29 Nov 2026
│   ├── Lecture      Introduction to limits      23 Nov 2026, 09:00
│   └── Assignment   Derivative exercises         due 5 Dec 2026, 23:59
├── Week 2 · 30 Nov 2026 – 6 Dec 2026
│   └── Assignment   Limits problem set
└── …

Not in a week yet: 1 quiz, 2 flashcards
```

## The record

`course_weeks` hangs off a subject:

| Field | Meaning |
|---|---|
| `subject_id` | The subject the week belongs to. Deleting the subject removes its weeks. |
| `school_year` | `2026/2027`, or empty for a week that is not filed under a year. |
| `season` | `FALL` or `SUMMER`. |
| `week_number` | 1–30, counted inside the season. |
| `title`, `description` | Optional: `Vectors`, `Mid-term revision`. |
| `starts_on`, `ends_on` | The week's dates (`YYYY-MM-DD`). |

One week per number inside a subject and season:

```sql
CREATE UNIQUE INDEX course_weeks_unique_week
  ON course_weeks (subject_id, COALESCE(school_year, ''), season, week_number);
```

`COALESCE` folds an unassigned year to `''` so the constraint still holds when
`school_year` is NULL. A second week 3 in the same season is refused with
`409`; the form offers the next free number instead.

## Dates

A week is meant to be a Monday-to-Sunday span, so the API only needs one end of
it. Send `starts_on` and `ends_on` is filled with start + 6 days; send only
`ends_on` and the start is worked backwards. Both are validated as real dates,
and an end before the start is refused. Nothing requires a week to have dates —
a plan can be laid out before the calendar is fixed — and a week without them
reads as *No dates set*.

## Seasons and the subject's semester

`subjects.semester` (`FIRST` / `SECOND`) and `course_weeks.season` describe the
same half of the year, so the two map onto each other:

| `subjects.semester` | `course_weeks.season` | Shown as |
|---|---|---|
| `FIRST` | `FALL` | Fall semester |
| `SECOND` | `SUMMER` | Summer semester |

When a week is created without a season it takes the subject's, and the new-week
form opens on that season with the next free number. On the subject page the
season the subject actually runs in is marked *This subject runs here*, so a
year-round course can carry both.

## Content in a week

`lectures`, `assignments`, `quizzes` and `flashcards` each gained a nullable
`week_id` (`ON DELETE SET NULL`):

- Every content form has a **Week** picker listing the subject's weeks as
  `Week 3 · Fall · 7 Dec 2026 – 13 Dec 2026`, with *No week yet* at the top.
  A draft does not have to sit in a week.
- A week card's **+** opens that picker already answered: it offers *lecture*,
  *assignment*, *quiz* and *flashcard*, and the form it opens is filed into the
  week it was started from. Only the kinds the role may create (`*.manage`) are
  listed, so a lecturer with `quizzes.manage` alone gets a one-item menu.
  Seminars are stored as lectures — the API has one shape for both — so they
  are added from the same entry.
- Deleting a week **never deletes what was taught in it**. The content falls
  back to the *Not in a week yet* card at the bottom of the tab, ready to be
  refiled.
- Moving a piece of content between weeks is just editing it and picking a
  different week.

## Screens

The subject page (`/subjects/<id>`) opens on the **Weeks** tab, with a count of
the weeks next to the label. The tab renders:

- one section per season that has weeks, with the week count and school year,
- one card per week: number, optional title, date range, description, and every
  lecture, assignment, quiz and flashcard taught in it (with its time or due
  date),
- an empty-state line inside a week that has nothing in it yet,
- a *Not in a week yet* card listing the content that belongs to the subject but
  to no week, or a note saying everything is filed.

*Add week* and the per-week edit/delete actions appear only with
`subjects.manage`. Each card also carries a **+** that adds content to that
week; it is shown when the role holds any of `lectures.manage`,
`assignments.manage`, `quizzes.manage` or `flashcards.manage`.

## Seeding

`backend/internal/db/seed_weeks.go` plans the demo term: four fall weeks
anchored on the Monday of the earliest scheduled content, with the dated
lectures and assignments filed into the week that contains them. Quizzes and
flashcards stay unscheduled on purpose, so the *Not in a week yet* card has
something in it.

## API

| Method and path | Purpose |
|---|---|
| `GET /api/subjects/{id}/weeks` | `subject_id`, `subject_name`, `school_year`, `season`, `weeks`, `unscheduled`. |
| `POST /api/subjects/{id}/weeks` | Add a week; `week_number` is optional and defaults to the next free one. |
| `PATCH /api/weeks/{id}` | Change season, number, title, description or dates. |
| `DELETE /api/weeks/{id}` | Remove the week; its content becomes unscheduled. |

Week objects carry their `items` (`id`, `kind`, `title`, `scheduled_at`,
`due_at`) so one request draws the whole tab.

## Permissions

Weeks are part of the subject module: `subjects.view` to read the tab,
`subjects.manage` to plan it. There is no separate week permission, because a
week is not a thing an institution grants access to — a subject is.
