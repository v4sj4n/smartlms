# Academic structure

The university is modelled the way it is actually run:

```
University
└── Fakulteti      → Faculty            (e.g. Faculty of Natural Sciences)
    └── Departamenti → Department       (e.g. Department of Computer Science)
        └── Dega       → Programme      (e.g. Computer Science, BSc)
```

A **programme** (*dega*) is the unit a student is admitted to and the unit that
owns a curriculum: the subjects it teaches, and in which year of study each one
is taught.

| Albanian | English | Where it lives |
|---|---|---|
| Universiteti | University | The deployment itself; not a row. |
| Fakulteti | Faculty / School | `faculties` |
| Departamenti | Department | `departments` (`faculty_id`) |
| Dega | Programme / Field of study | `programmes` (`department_id`) |
| Drejtimi | Specialization / Study track | **Not modelled yet** — see [Study tracks](#study-tracks-drejtimi). |

Study tracks (*drejtimi*) subdivide a programme from the third year on. Every
institution that needs them also needs to decide when a student picks one, so
they are deliberately left out; a track can later hang off `programmes` without
touching anything below it.

## The records

### Faculty and department

Both are thin: a name, an optional short code, and their parent. Deleting a
faculty cascades to its departments, their programmes, and the admissions in
them — only do it for a faculty created by mistake.

| Table | Fields |
|---|---|
| `faculties` | `name` (unique), `code` (unique, optional) |
| `departments` | `faculty_id`, `name` (unique per faculty), `code` |

### Programme

| Field | Meaning |
|---|---|
| `department_id` | The department that runs it. |
| `name` | `Computer Science` — unique inside the department. |
| `code` | `BSc-CS` — unique across the institution, used on the course list. |
| `level` | `BACHELOR`, `MASTER` or `DOCTORATE`. |
| `duration_years` | 1–8, defaults to 3 (bachelor) or 2 (master). |
| `total_ects` | Optional credit total, e.g. 180. |
| `description` | Optional prose for the programme page. |

The list response also carries two counts the tree screen shows: how many
`courses` the programme offers and how many `students` hold an admission to it.

### Admission

`programme_enrollments` is separate from course enrolment on purpose. An
admission answers *"which programme does this student belong to?"*;
`enrollments` still answers *"who sits in this subject?"*. A student is normally
in both, but they are not the same fact and they change at different times.

| Field | Meaning |
|---|---|
| `programme_id`, `student_id` | Who, where. Unique pair — one admission per student per programme. |
| `school_year` | Year of admission, `2026/2027`. |
| `year_of_study` | 1st year, 2nd year, … (1–8). |
| `status` | `ACTIVE`, `SUSPENDED`, `GRADUATED`, `WITHDRAWN`. |

A student follows **one programme at a time**, enforced by the database rather
than by convention:

```sql
CREATE UNIQUE INDEX programme_enrollments_one_active
  ON programme_enrollments (student_id) WHERE status = 'ACTIVE';
```

The partial index is what makes a path through the institution possible: finish
a bachelor's (`GRADUATED`), enrol in a master's (`ACTIVE`), and both rows stay on
record. Trying to create a second active admission is refused with
`409 that student already follows a programme; end the current admission first`
— end the old one (set it to `GRADUATED`/`WITHDRAWN`) and the new one goes in.

### Courses on a programme

`subjects` gained two columns:

| Column | Meaning |
|---|---|
| `programme_id` | The programme that offers the course. `ON DELETE SET NULL`. |
| `year_of_study` | The year of the programme it is taught in. |

`ON DELETE SET NULL` matters: deleting a programme never deletes the courses it
taught. They simply become unassigned, and the tree reports them as
`unassigned_courses` so an administrator can adopt them elsewhere.

`year_of_study` must fit inside the programme's `duration_years`; a two-year
master's rejects year 3 with a message that names the range.

## Screens

**Academic structure** (`/academic`, module `academic`) shows the tree: one card
per faculty, its departments inside, and the departments' programmes as tiles.
The header reports courses with no programme and students with no admission.

Opening a programme (`/academic?programme=<id>`) shows the programme panel:

- **Curriculum** — its courses grouped by year of study, with ECTS and lecturer,
  an *Assign course* action that picks from unassigned subjects (or moves one
  from another programme), and a *Remove* action that unassigns.
- **Students** — every admission with its year, study year and status, plus
  *Admit student*, *Change* (year, status) and *Remove*.

## Permissions

| Module | Permissions | ADMIN | LECTURER | STUDENT |
|---|---|---|---|---|
| `academic` | `academic.view`, `academic.manage` | both | view | — |

The frontend gates the screen with `ModuleGate`/`AccessGate` and shows the edit
actions only with `academic.manage`; the API does not enforce permissions per
route, consistent with the rest of the backend.

## API

| Method and path | Purpose |
|---|---|
| `GET /api/academic` | Whole tree + `unassigned_courses` / `unplaced_students`. |
| `POST /api/faculties`, `PATCH`/`DELETE /api/faculties/{id}` | Faculties. |
| `POST /api/departments`, `PATCH`/`DELETE /api/departments/{id}` | Departments (`faculty_id` in the body on create). |
| `GET /api/programmes/{id}` | Programme, its `courses`, its `students`. |
| `POST /api/programmes`, `PATCH`/`DELETE /api/programmes/{id}` | Programmes (`department_id` in the body on create). |
| `POST /api/programmes/{id}/students` | Admit a student. |
| `PATCH`/`DELETE /api/programme-enrollments/{id}` | Change or end an admission. |
| `POST /api/programmes/{id}/courses` | Assign a course: `{subject_id, year_of_study}`. |
| `DELETE /api/programmes/{id}/courses/{subjectId}` | Unassign a course. |

## Seed

`backend/internal/db/seed_academic.go` builds a small demo university:

- **Faculty of Natural Sciences (FNS)** — Department of Computer Science
  (Computer Science `BSc-CS`, Software Engineering `BSc-SE`, Data Science
  `MSc-DS`) and Department of Mathematics (Mathematics `BSc-MATH`).
- **Faculty of Economics (FE)** — Business Administration `BSc-BA`, Finance and
  Banking `MSc-FB`.

`MATH101` and `PHYS101` are filed under Computer Science, year 1, the demo
student is admitted there, and any other student left without an admission is
placed in a programme so the tree has no empty tables.

## Study tracks (drejtimi)

Left for a follow-up, and the schema is ready for it: a `study_tracks` table
(`programme_id`, `name`, `code`) plus a nullable `study_tracks` reference on the
admission. Nothing above needs to change to add it.
