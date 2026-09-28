# Quizizi. frontend

The active Quizizi Angular application uses standalone components, signals, reactive forms and typed HTTP services.

## Development server

Start the active API first, from the workspace root:

```powershell
dotnet run --project backend/backend.csproj --launch-profile http
```

The HTTP profile listens at `http://localhost:5224`. The HTTPS profile additionally
listens at `https://localhost:7145`. In Development, HTTP requests are not redirected;
HTTPS redirection remains enabled in other environments.

The backend requires SQL Server from `ConnectionStrings:DefaultConnection` and a
`Jwt:Key` of at least 32 UTF-8 bytes. Issuer/audience are in backend appsettings.
The backend project already has a UserSecretsId. If a signing key is not configured,
generate a local-only random key and store it outside the repository (do not replace
an existing key, since doing so invalidates existing tokens):

```powershell
# Run once, only when Jwt:Key is missing. PowerShell 7 / .NET required.
$localJwtKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
@{ 'Jwt:Key' = $localJwtKey } | ConvertTo-Json | dotnet user-secrets set --project backend/backend.csproj
Remove-Variable localJwtKey
```

Alternatively, supply `Jwt__Key` in the backend process environment through your
local secret manager. Never put a real key in appsettings, launchSettings, Angular
environment files, or source control. User secrets belong to the OS user starting
the backend and are loaded automatically in Development.

In another terminal, run `npm start` inside `frontend/`. Angular's dev-server uses
`proxy.conf.json`: `/api/**` forwards unchanged to `http://localhost:5224`.
Services keep the relative `/api` base. No separate Vite configuration is needed.
Restart the frontend after changing proxy configuration.

Verify `http://localhost:5224/api/public/quizzes` first, then
`http://localhost:4200/api/public/quizzes`. A proxy `ECONNREFUSED` means no backend
accepted the connection at the target address/port. Check the backend terminal for
startup failures (including missing JWT configuration or unavailable SQL Server),
and its `Now listening on` line. Starting only Angular does not start the API.
An HTTPS certificate error is a different failure from connection refusal.

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Build and test

```powershell
npm ci
npm run build
npm test -- --watch=false
```

The production browser files are in `dist/frontend/browser`. TypeScript strict checks and unused production import/parameter checks are enabled. Angular also checks templates during the build. There is no configured lint or browser end-to-end target.

## Production hosting

Keep API requests relative to `/api`. The development proxy is not shipped in the static build. Configure the production host to forward `/api/*` to the API and fall back to `index.html` for frontend routes only. See the workspace README for backend secrets, migration and HTTPS requirements.
