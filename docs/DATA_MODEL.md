# DATA_MODEL

Backing store: one Google Sheet, one tab per table. The Apps Script backend is
the only writer; the frontend talks exclusively to the Web App.

## Conventions

- Primary keys are opaque, prefixed ids (`tch_`, `cls_`, `stu_`, `ses_`, `att_`).
- Timestamps are ISO-8601 UTC (`2026-01-15T09:00:00.000Z`).
- Booleans are stored as `TRUE` / `FALSE` text (what Sheets renders).
- Attendance status is normalized server-side to `P`, `A`, `OD`.
- The header row is frozen and must match `SCHEMA` in `lib/Sheets.gs` exactly.

## Tables

### Teachers

The single source of truth for who may sign in and what they may do.

| column | notes |
| --- | --- |
| teacher_id | primary key |
| name | display name |
| email | case-insensitive lookup key |
| role | `teacher` or `admin` |
| active | deactivating here revokes access on the next request |
| created_at | |

### Classes

| column | notes |
| --- | --- |
| class_id | primary key |
| class_name, section, subject, year, semester | display |
| teacher_id | primary owner; blank if unassigned |
| attendance_threshold | percentage, default 75 |
| active | hides the class from the teacher dashboard |
| created_at, updated_at | |

### ClassTeachers

Extra teachers assigned to a class beyond the primary owner.

| column | notes |
| --- | --- |
| class_id, teacher_id | composite identity |
| assigned_at | |

### Students

| column | notes |
| --- | --- |
| student_id | primary key |
| class_id | owning class |
| application_number, roll_number, prn_number | at least one required; used to match rows on import |
| name | required |
| email | optional |
| status | `active` / `inactive`; delete = set `inactive` |
| created_at, updated_at | |

### Sessions

One row per class per date once attendance has been submitted.

| column | notes |
| --- | --- |
| session_id | primary key |
| class_id | |
| date | `YYYY-MM-DD` |
| teacher_id | who submitted |
| name, start_time | display |
| submitted_at | ISO timestamp |
| status | `submitted` |

### Attendance

One row per student per session. Never deleted — corrections rewrite `status`.

| column | notes |
| --- | --- |
| attendance_id | primary key |
| session_id, student_id, class_id | |
| date | denormalized from the session for easy filtering |
| status | `P` / `A` / `OD` |
| marked_by | email of the last writer |
| client_operation_id | idempotency key from the frontend |
| created_at, updated_at | |

### SyncLog

Idempotency ledger. One row per accepted client operation.

| column | notes |
| --- | --- |
| client_operation_id | unique per logical write from a device |
| action | which handler consumed it |
| processed_at | |
| result | usually the resulting session_id |

## Write rules

- Attendance submit: one `setValues()` for all inserts, one for all updates,
  one for the session, one for the sync-log entry — regardless of roster size.
- A replayed `client_operation_id` returns the cached result and writes nothing.
- A second, *different* submission for the same class + date is refused with
  `DUPLICATE`.
- Corrections (`updateAttendance`) rewrite existing rows only; they never
  append and never require a new session.

## Read rules

- One `getDataRange().getValues()` per table, cached for 45s.
- Writes invalidate the cache for every table through `LockService`.
- Teachers read only classes owned/assigned to them; admins read everything.
