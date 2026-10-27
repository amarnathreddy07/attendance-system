# DEPLOYING THE APPS SCRIPT BACKEND

The backend is a Google Apps Script Web App. It is the only component that
touches the spreadsheet, so it must be deployed with the owner's identity and
the spreadsheet kept private.

## 1. Create the spreadsheet

1. Create a new Google Sheet, e.g. `AttendIt Data`.
2. File → Share → *General access*: Restricted. Never "Anyone with the link".
3. Copy the spreadsheet id from the URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`.

## 2. Create the Apps Script project

1. Go to <https://script.google.com> → New project.
2. Project → Rename to `AttendIt Backend`.
3. Project Settings → check **Show "appsscript.json" manifest file**.
4. Replace the manifest with `apps-script/appsscript.json` from this repo.
5. Delete the default `Code.gs` content, then paste the files in this order
   (they share one global scope, so order matters for `ROUTES`):
   - `lib/Errors.gs`
   - `lib/Config.gs`
   - `lib/Policy.gs`
   - `lib/Sheets.gs`
   - `lib/Validate.gs`
   - `lib/Repo.gs`
   - `lib/Auth.gs`
   - `lib/Handlers.gs`
   - `Code.gs`
6. Run the `runPeopleSheetMigration` function once from the editor. This creates the eight
   tabs (`Teachers`, `Admins`, `Classes`, `ClassTeachers`, `Students`, `Sessions`,
   `Attendance`, `SyncLog`) with the correct headers. Missing tabs are also created
   automatically on the first request, so attendance sync can bootstrap an empty
   spreadsheet.
7. Authorise the Sheets scope when prompted.

When a teacher or admin creates a class, the backend automatically creates a
`Class_<class-id>` worksheet in this same spreadsheet. The worksheet includes
the class details followed by its attendance ledger; new submissions and
attendance corrections are mirrored there. The shared `Classes`, `Students`,
`Sessions`, and `Attendance` tabs remain the canonical data tables.

## 3. Script properties

Project Settings → Script Properties:

| property | value |
| --- | --- |
| `SPREADSHEET_ID` | id from step 1 |
| `GOOGLE_CLIENT_ID` | OAuth client id the frontend will use (step 5) |
| `ORG_EMAIL_DOMAIN` | optional, e.g. `university.edu` — extra restriction on top of both people sheets |
| `SESSION_TTL_HOURS` | optional, default `24` |
| `REFRESH_TTL_DAYS` | optional, default `30`; how long the app can renew a session without another Google sign-in |
| `SESSION_SECRET` | leave empty; generated automatically on first login. Rotating it signs everyone out. |

## 4. Deploy the Web App

1. Deploy → New deployment → **Web app**.
2. Description: `v1`.
3. Execute as: **Me** (the owner).
4. Who has access: **Anyone** in your Google Workspace domain, or **Anyone
   with a Google account** if you are not on Workspace. The app itself still
   checks the role-specific people sheet on every login, so a public endpoint is safe.
5. Authorise, then copy the deployment URL — this is `VITE_API_URL`.

> Deployments are immutable. After every code change: Deploy → Manage
> deployments → ✏️ → Version: New version → Deploy.

## 5. Create the OAuth client

1. <https://console.cloud.google.com> → APIs & Services → Credentials.
2. Configure the OAuth consent screen (External is fine for testing; add the
   teachers as test users, or switch to Internal on Workspace).
3. Credentials → Create credentials → **OAuth client ID** → **Web application**.
4. Authorised JavaScript origins: your deployed frontend origin,
   e.g. `https://your-project.vercel.app` and `http://localhost:5173`.
5. Copy the client id into:
   - Script Property `GOOGLE_CLIENT_ID` on the backend, and
   - `VITE_GOOGLE_CLIENT_ID` on the frontend (`.env`, not committed).

The backend verifies the ID token's `aud` against `GOOGLE_CLIENT_ID`, so both
must match exactly.

## 6. Add teachers and admins

The tabs have separate schemas and ID sequences. Add teachers only to
`Teachers` and administrators only to `Admins`:

| Teachers: `teacher_id` | name | email | active | created_at |
| --- | --- | --- | --- | --- |
| `TCH-0001` | Alice Rao | alice@example.edu | TRUE | 2026-01-15T09:00:00.000Z |

| Admins: `admin_id` | name | email | active | created_at |
| --- | --- | --- | --- | --- |
| `ADM-0001` | Admin User | admin@example.edu | TRUE | 2026-01-15T09:00:00.000Z |

When adding accounts through the admin interface, the backend assigns these
IDs automatically. If adding a row manually, use the next unused ID in that
sheet's sequence and keep email addresses unique across both tabs. Email
matching is case-insensitive.

## 7. Migrate an existing mixed-role sheet

For an existing backend whose `Teachers` tab has a `role` column:

1. Make a backup copy of the entire spreadsheet.
2. Update the Apps Script project with this repository's backend files.
3. Deploy a **new Web App version** before migrating the sheet.
4. Run `runPeopleSheetMigration` once from the editor. It separates admins, assigns `TCH-####`
   and `ADM-####` IDs, and updates matching teacher references in `Classes`,
   `ClassTeachers`, and `Sessions`.
5. Verify the two people tabs and the updated class assignments before
   continuing to use the application.

The migration assigns new IDs, so all users must sign in again afterward.

Migration is safe to retry if interrupted. If it finds a legacy admin assigned
to a class or session as its teacher, it stops without completing the migration;
reassign those records to a teacher and run `runPeopleSheetMigration` again.

## 8. Smoke test

```bash
curl -s -X POST "$VITE_API_URL" -H 'Content-Type: application/json' \
  -d '{"action":"getTodayClasses"}'
```

Expected envelope: `{"success":false,"error":{"code":"UNAUTHENTICATED",...}}`.
A `SERVER_ERROR` mentioning a script property means step 3 is incomplete.

## Troubleshooting

| symptom | cause |
| --- | --- |
| `SERVER_ERROR` ... missing script property | step 3 |
| `SERVER_ERROR` ... Sheet is missing | step 2.6 not run, or a tab renamed |
| `UNAUTHENTICATED` on login | wrong `GOOGLE_CLIENT_ID`, or the token audience differs |
| `UNAUTHORIZED` on login | email missing from `Teachers` and `Admins`, or `active` is `FALSE`, or domain mismatch |
| `UNAUTHORIZED` on a class | the teacher is not the class owner |
| `NOT_FOUND: Unknown action: refreshSession` | the deployed Web App is an older version; deploy a new version containing the current `Auth.gs` and `Code.gs` |
| `DUPLICATE` on submit | attendance already submitted for that class + date |
| Everything works in editor but not in the Web App | stale deployment — redeploy as a new version |
