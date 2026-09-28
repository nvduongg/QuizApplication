# Local backend integration checks

These scripts exercise the **real SQL Server-backed API**, including mutations. They are not production diagnostics. No dependencies beyond Node.js and the running backend are required.

Before use, positively verify the backend runs in Development and its effective database is the intended local development database. The scripts use only `http://localhost:5225` (a dedicated test-port override, not the application's default 5224), but a loopback API URL alone does not prove its database is local; verify the server configuration separately.

Credentials are read from the backend's existing .NET user secrets store (`UserSecretsId` in backend.csproj): `SeedAdmin:Email`, `SeedAdmin:Password`, and the `DevelopmentTestAccounts` section (`UserEmail`, `OtherEmail`, `Password`). No credentials or JWTs are embedded in source or result files. The two synthetic User accounts were created through normal registration. Existing administrator credentials were reused.

Run the backend from this directory in Development, with the verified connection supplied explicitly, on port 5225. Build before starting it; Windows can lock a running assembly. A Release build avoids an unrelated Visual Studio Debug executable lock encountered during this pass. Do not terminate unrelated hosts to build.

```powershell
$env:QUIZIZI_LOCAL_INTEGRATION = '1'
node Development/integration-check.cjs
node Development/edge-check.cjs
node Development/verify-retained.cjs
```

`integration-check.cjs` expects empty business tables and creates the canonical data. It does not delete existing data automatically. Resetting must remain a separately verified, explicitly authorized operation. It preserves/reuses test accounts and exercises the existing Administrator account. Registration is tested on first account creation; subsequent runs reuse accounts.

`edge-check.cjs` uses the IDs in integration-results.json. It temporarily unpublishes, changes and restores the canonical quiz/question/answer, tests a historical delete conflict, and creates one fully correct completed attempt through concurrent submission. Repeating it adds another attempt; use it as part of a controlled reset-and-test run, not as a background monitor.

`verify-retained.cjs` logs in and performs read-only final checks. It creates no business data.

Result JSON files record safe endpoint statuses, assertions, generated IDs and expected review data. They contain no passwords or JWTs. The scripts exit nonzero on failed assertions. A conventional .NET unit-test project was not added; these focused executable integration checks cover the SQL-backed behaviors that exposed the defects. Unit tests can be added later without replacing real SQL concurrency and constraint checks.

These scripts and their generated result files are excluded from backend publish output. Generated results are ignored by source control, but retained local result files may be inputs to the follow-up checks above. Do not delete them merely because they are generated. For normal development and deployment setup, use the workspace README. The current API returns a safe submission acknowledgement and separate completed result/history contracts.
