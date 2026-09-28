# Quizizi.

Quizizi is an Angular application backed by an ASP.NET Core API, EF Core, SQL Server and Identity/JWT authentication. It supports public quiz discovery, owned question banks, Excel import, quiz authoring, timed participation, snapshot-based result review, history and administrator controls.

## Active projects

- `backend/backend.csproj`: .NET 10 API; `backend/backend.slnx` contains this project.
- `frontend/`: Angular 22 application, managed by npm and its committed lock file.
- `backend/Tests/ImportChecks/`: executable workbook and optional HTTP checks.
- `backend/Tests/TimedChecks/`: opt-in checks against a uniquely named local SQL Server database.

`QuizApplication/` and `quiz-frontend/` are separate, older project trees retained for owner review. They are not dependencies of the active projects. Do not use their setup or configuration for the active application.

## Development setup

Install the .NET 10 SDK, SQL Server and a Node/npm version compatible with the frontend's package manifest. Run these commands from this workspace root:

```powershell
dotnet restore backend/backend.csproj
cd frontend
npm ci
cd ..
```

Development defaults to the local SQL Server instance `.\MSSQLSERVER01`, database `QuizApplicationDb`. Override `ConnectionStrings:DefaultConnection` through .NET user secrets if your instance differs. Production has no default database connection.

Configure a random `Jwt:Key` of at least 32 UTF-8 bytes in user secrets or `Jwt__Key`. Never put signing keys, passwords or tokens in source files. The project already has a UserSecretsId. To provision a **missing** local signing key (PowerShell 7), without printing it:

```powershell
$localJwtKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
@{ 'Jwt:Key' = $localJwtKey } | ConvertTo-Json | dotnet user-secrets set --project backend/backend.csproj
Remove-Variable localJwtKey
```

Do not overwrite an existing key unnecessarily: doing so invalidates existing tokens. Issuer, audience and token lifetime are configured in `backend/appsettings.json`. Optional `SeedAdmin:Email` and `SeedAdmin:Password` provision an administrator; supply these only through a secret provider. Startup ensures the User and Administrator roles exist, so the database must be reachable and migrated first.

Inspect migrations, then apply them only to the intended development database:

```powershell
dotnet ef migrations list --project backend/backend.csproj -- --environment Development
dotnet ef database update --project backend/backend.csproj -- --environment Development
dotnet run --project backend/backend.csproj --launch-profile http
```

Use an EF CLI version compatible with the project's EF Core packages. The HTTP profile listens on `http://localhost:5224`; the HTTPS profile also exposes `https://localhost:7145`. OpenAPI/Scalar are available only in Development.

In another terminal:

```powershell
cd frontend
npm start
```

Open `http://localhost:4200`. Angular's development proxy forwards `/api/**` to `http://localhost:5224`. API calls remain relative. Restart Angular after changing proxy configuration. A proxy connection refusal means the API is not accepting connections at the target; inspect API startup and configuration first.

## Verification

```powershell
dotnet build backend/backend.csproj
dotnet run --project backend/Tests/ImportChecks/ImportChecks.csproj
# Opt-in: creates and retains a separate local test database, never resets application data.
$env:QUIZIZI_TIMED_CHECKS = '1'
dotnet run --project backend/Tests/TimedChecks/TimedChecks.csproj
cd frontend
npm run build
npm test -- --watch=false
```

HTTP import checks have a separate opt-in; see `backend/Tests/ImportChecks/README.md`. Older `backend/Development/` scripts mutate local fixtures and require their documented setup. Never run them against production or reset data as part of routine startup. There is no configured browser end-to-end or lint target; Angular build checks templates/types and the suite uses Vitest.

## Deployment configuration (no deployment is performed by these commands)

- Build Angular with `npm run build`; serve `frontend/dist/frontend/browser` as static files.
- Publish the API with `dotnet publish backend/backend.csproj -c Release`.
- Supply `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Jwt__Issuer` and `Jwt__Audience` through the deployment environment/secret manager. Use a production SQL connection with validated TLS; the development trust-certificate setting is not a production default.
- Route `/api/*` to the API at the same public origin. The Angular development proxy is not part of the production build. Serve `index.html` for frontend routes on refresh, but never rewrite API failures to the SPA.
- Terminate HTTPS correctly and configure trusted forwarding at the chosen reverse proxy/host. The API redirects to HTTPS outside Development. Do not trust arbitrary forwarded headers. Cross-origin hosting would require an explicit CORS policy; none is currently configured.
- Set an appropriate host allowlist, logging policy and secret rotation process. JWTs are stored by the current frontend in local storage; hosting must include suitable XSS defenses/CSP.
- Review and apply migrations through a controlled release process with backups; startup does not apply migrations or reset databases. Keep every migration and model snapshot.
- Remove administrator bootstrap credentials after provisioning. Blocked accounts cannot log in; existing issued JWTs are not revoked immediately by blocking.
- Development scripts/results and Development appsettings are excluded from API publishing. Production OpenAPI is not mapped.
- Retain request limits for Excel uploads: 5 MB files, bounded expanded workbooks and 500 question rows. Configure the hosting proxy consistently with the API request limit.
- Timers use backend deadlines with a five-second delivery grace. Late unsent answers cannot be recovered; expired attempts are finalized when next accessed. New authoring requires a positive duration; legacy null-deadline attempts remain untimed.

Compilation is not deployment acceptance. Run authenticated browser workflows, authorization tests and hosting/SPA refresh checks against the intended deployment environment before release.
