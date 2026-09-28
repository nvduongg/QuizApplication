# Authoritative timed-attempt checks

This executable exercises the real EF Core/SQL Server service with an injected
clock. It creates a uniquely named `QuiziziTimedChecks_*` database on the local
`.\MSSQLSERVER01` SQL Server instance, applies the real migrations, and retains
that isolated database for diagnosis. It never connects to the application's
database. No JWT secrets are needed for these service-level checks.

```powershell
$env:QUIZIZI_TIMED_CHECKS = '1'
dotnet run --project backend/Tests/TimedChecks/TimedChecks.csproj -c Release
```

Checks cover start/deadline snapshots, UTC, safe participation, refresh/reopen,
parallel start reuse, duration edits, ownership, normal/grace/late submission,
exact-set grading, stable result snapshots, duplicate and competing submission,
expiration through attempt/result/history reads, rejected untimed authoring,
and compatibility for legacy null-deadline attempts.

No production test-clock override exists. `Program.cs` registers `TimeProvider.System`.

## Live end-to-end acceptance

After applying the new migration and starting the updated backend plus Angular:

1. Create an isolated one-minute public quiz with a valid question.
2. Start it as a User; confirm `expiresAt - startedAt` is 60 seconds and the
   participation payload contains no correctness fields.
3. Select an answer. Reload, then leave and reopen using History. The original
   deadline must remain unchanged and the countdown must decrease.
4. Open that same attempt in another tab; both must use the same deadline.
5. Keep the answered tab foreground at zero. Inputs lock, one automatic submit
   occurs, and normal Result/History display the persisted grade.
6. Start a second attempt, close its page, wait until deadline + 5 seconds, and
   manually submit correct answer IDs through the API. It must finalize with
   zero/unanswered review. Repeated submission must return 409. Other users
   must receive 404 for the attempt and cannot submit it.
7. Repeat a ten-minute attempt reload/reopen to check the normal timer state,
   plus narrow-screen layout. Do not shorten an existing attempt via quiz edits.

Answers exist only in the final request. Session storage is a same-tab recovery
aid, not a server draft or cross-tab synchronization mechanism. An offline or
closed tab cannot deliver unsent answers; reliable server autosave would require
a separate persisted-draft architecture. Untouched expired attempts are finalized
on the next attempt/result/history request, not by a background job.
