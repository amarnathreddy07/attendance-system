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
6. Run the `ping_` function once from the editor. This creates the seven tabs
   (`Teachers`, `Classes`, `ClassTeachers`, `Students`, `Sessions`,
   `Attendance`, `SyncLog`) with the correct headers.
7. Authorise the Sheets scope when prompted.

## 3. Script properties

Project Settings → Script Properties:

| property | value |
| --- | --- |
| `SPREADSHEET_ID` | id from step 1 |
| `GOOGLE_CLIENT_ID` | OAuth client id the frontend will use (step 5) |
| `ORG_EMAIL_DOMAIN` | optional, e.g. `university.edu` — extra restriction on top of the Teachers sheet |
| `SESSION_TTL_HOURS` | optional, default `24` |
| `SESSION_SECRET` | leave empty; generated automatically on first login. Rotating it signs everyone out. |

## 4. Deploy the Web App

1. Deploy → New deployment → **Web app**.
2. Description: `v1`.
3. Execute as: **Me** (the owner).
4. Who has access: **Anyone** in your Google Workspace domain, or **Anyone
   with a Google account** if you are not on Workspace. The app itself still
   checks the Teachers sheet on every login, so a public endpoint is safe.
5. Authorise, then copy the deployment URL — this is `VITE_API_URL`.

> Deployments are immutable. After every code change: Deploy → Manage
> deployments → ✏️ → Version: New version → Deploy.

## 5. Create the OAuth client

1. <https://console.cloud.google.com> → APIs & Services → Credentials.
2. Configure the OAuth consent screen (External is fine for testing; add the
   teachers as test users, or switch to Internal on Workspace).
3. Credentials → Create credentials → **OAuth client ID** → **Web application**.
4. Authorised JavaScript origins: your deployed frontend origin,
   e.g. `https://amarnathreddy07.github.io` and `http://localhost:5173`.
5. Copy the client id into:
   - Script Property `GOOGLE_CLIENT_ID` on the backend, and
   - `VITE_GOOGLE_CLIENT_ID` on the frontend (`.env`, not committed).

The backend verifies the ID token's `aud` against `GOOGLE_CLIENT_ID`, so both
must match exactly.

## 6. Seed the Teachers sheet

Open the `Teachers` tab and add rows (header already present):

| teacher_id | name | email | role | active | created_at |
| --- | --- | --- | --- | --- | --- |
| tch_alice | Alice Rao | alice@example.edu | teacher | TRUE | 2026-01-15T09:00:00.000Z |
| tch_admin | Admin User | admin@example.edu | admin | TRUE | 2026-01-15T09:00:00.000Z |

`teacher_id` can be any unique text. Email matching is case-insensitive. Only
`teacher` and `admin` are accepted as roles.

## 7. Smoke test

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
| `UNAUTHORIZED` on login | email missing from Teachers, or `active` is `FALSE`, or domain mismatch |
| `UNAUTHORIZED` on a class | the teacher is not the class owner |
| `DUPLICATE` on submit | attendance already submitted for that class + date |
| Everything works in editor but not in the Web App | stale deployment — redeploy as a new version |
