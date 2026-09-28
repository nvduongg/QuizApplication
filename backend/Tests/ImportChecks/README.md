# Excel import checks

This dependency-free executable test harness uses the backend's actual ClosedXML template and parser. It is excluded from the web application's compile/content items.

From the workspace root, run parser/template checks without a database:

```powershell
dotnet run --project backend/Tests/ImportChecks/ImportChecks.csproj -c Release
```

For real HTTP integration, first verify that the backend is running in Development against the intended **local development database**, on `http://localhost:5226`. Never point these mutation tests at production. Then run:

```powershell
$env:QUIZIZI_LOCAL_INTEGRATION = '1'
dotnet run --project backend/Tests/ImportChecks/ImportChecks.csproj -c Release -- --http
```

The HTTP mode creates two synthetic User accounts with random passwords retained only in process memory, downloads the actual template, creates an isolated bank, previews/imports it, checks invalid uploads and ownership, edits/searches/reuses an imported question, and starts a safe attempt. It prints retained fixture IDs. It does not reset the database or alter canonical fixtures. Repeated runs add development fixtures. A failed run may leave its bank/questions for diagnosis.

All workbooks are generated in memory. For intentional visual inspection only, the following option exports the actual server template to a supplied path:

```powershell
dotnet run --project backend/Tests/ImportChecks/ImportChecks.csproj -c Release -- --template template-review.xlsx
```

Delete that temporary file after inspection. The harness verifies template headers, freeze/dropdown, all three types, normalization, A–H, duplicates, gaps, lengths, formulas, ZIP expansion, 500/501-row boundaries, partial import, no-write preview, zero-valid behavior, correct answer persistence, public/private access, existing edit/delete/reuse semantics, safe participation and OpenAPI binary-file representation. Exit code is nonzero on a failed assertion.
