using backend.Data;
using backend.Enums;
using backend.Exceptions;
using backend.Models;
using backend.Services.Implementations;
using backend.ViewModels.Quizzes;
using backend.ViewModels.QuizAttempts;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;

// Opt-in isolated SQL Server integration. Never touches the application's database.
if (Environment.GetEnvironmentVariable("QUIZIZI_TIMED_CHECKS") != "1")
    throw new InvalidOperationException("Set QUIZIZI_TIMED_CHECKS=1 to create an isolated local test database.");
var database = "QuiziziTimedChecks_" + Guid.NewGuid().ToString("N");
var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(
    $"Server=.\\MSSQLSERVER01;Database={database};Trusted_Connection=True;TrustServerCertificate=True").Options;
AppDbContext Db() => new(options);
var checks = 0;
void Check(bool pass, string name) { if (!pass) throw new Exception("FAILED: " + name); checks++; Console.WriteLine("PASS " + name); }
async Task Reject<T>(Func<Task> action, string name) where T : Exception
{
    try { await action(); } catch (T) { Check(true, name); return; }
    throw new Exception("FAILED: " + name);
}
var clock = new TestClock();
var start = clock.Now;
await using var seed = Db();
await seed.Database.MigrateAsync();
var user = new ApplicationUser { Id = Guid.NewGuid().ToString(), UserName = "timed-owner", FullName = "Timed owner" };
seed.Users.Add(user);
var bank = new QuestionBank { OwnerId = user.Id, Name = "Timed checks" };
var question = new Question { QuestionBank = bank, Content = "Choose both", QuestionType = QuestionType.MultipleChoice,
    Answers = [new Answer { Content = "A", IsCorrect = true }, new Answer { Content = "B", IsCorrect = true }, new Answer { Content = "C" }] };
var quiz = new Quiz { CreatorId = user.Id, Title = "Timed checks", Duration = 10, Visibility = Visibility.Public,
    QuizQuestions = [new QuizQuestion { Question = question, Points = 3, QuestionOrder = 1 }] };
seed.Quizzes.Add(quiz);
await seed.SaveChangesAsync();
async Task<T> Use<T>(Func<QuizAttemptService, Task<T>> action) { await using var db = Db(); return await action(new(db, clock)); }
SubmitQuizAttemptVm Answers(params int[] ids) => new() { Questions = [new() { QuestionId = question.QuestionId, AnswerIds = ids.ToList() }] };
var correct = question.Answers.Where(a => a.IsCorrect).Select(a => a.AnswerId).ToArray();
var a = await Use(s => s.StartAsync(user.Id, quiz.QuizId));
Check(a.StartedAt == start.UtcDateTime && a.ExpiresAt == start.AddMinutes(10).UtcDateTime, "start snapshots original duration");
Check(a.StartedAt.Kind == DateTimeKind.Utc && a.ExpiresAt!.Value.Kind == DateTimeKind.Utc && a.ServerNow.Kind == DateTimeKind.Utc, "safe timing fields are UTC");
Check(!JsonSerializer.Serialize(a).Contains("IsCorrect"), "participation does not expose correctness");
clock.Now = start.AddMinutes(2);
var refreshed = await Use(s => s.GetAsync(user.Id, a.QuizAttemptId));
Check(refreshed.ExpiresAt == a.ExpiresAt && refreshed.ServerNow == clock.Now.UtcDateTime, "refresh retains deadline and supplies current server time");
var starts = await Task.WhenAll(Use(s => s.StartAsync(user.Id, quiz.QuizId)), Use(s => s.StartAsync(user.Id, quiz.QuizId)));
Check(starts.All(x => x.QuizAttemptId == a.QuizAttemptId), "parallel tabs reuse active attempt");
quiz.Duration = 1; await seed.SaveChangesAsync();
Check((await Use(s => s.GetAsync(user.Id, a.QuizAttemptId))).ExpiresAt == a.ExpiresAt, "duration edits cannot move active deadline");
await Reject<NotFoundException>(() => Use(s => s.GetAsync("another-user", a.QuizAttemptId)), "retrieve enforces ownership");
await Reject<NotFoundException>(() => Use(s => s.SubmitAsync("another-user", a.QuizAttemptId, Answers(correct))), "submit enforces ownership");
await Use(s => s.SubmitAsync(user.Id, a.QuizAttemptId, Answers(correct)));
var result = await Use(s => s.GetResultAsync(user.Id, a.QuizAttemptId));
Check(result.Score == 3 && result.ReviewAvailable && result.Questions.Single().CorrectAnswerIds.Count == 2, "normal submission preserves exact-set grading and snapshot");
await Reject<ConflictException>(() => Use(s => s.SubmitAsync(user.Id, a.QuizAttemptId, Answers(correct))), "completed attempt cannot resubmit");
question.Content = "Edited after result"; quiz.QuizQuestions.Single().Points = 5; await seed.SaveChangesAsync();
result = await Use(s => s.GetResultAsync(user.Id, a.QuizAttemptId));
Check(result.TotalPoints == 3 && result.Questions.Single().Content == "Choose both", "result snapshot survives authoring changes");

var partial = await Use(s => s.StartAsync(user.Id, quiz.QuizId));
await Use(s => s.SubmitAsync(user.Id, partial.QuizAttemptId, Answers(correct[0])));
Check((await Use(s => s.GetResultAsync(user.Id, partial.QuizAttemptId))).Score == 0, "partial multiple-choice selection earns zero");
var grace = await Use(s => s.StartAsync(user.Id, quiz.QuizId));
clock.Now = new DateTimeOffset(grace.ExpiresAt!.Value).AddSeconds(5);
await Use(s => s.SubmitAsync(user.Id, grace.QuizAttemptId, Answers(correct)));
Check((await Use(s => s.GetResultAsync(user.Id, grace.QuizAttemptId))).Score == 5, "inclusive five-second grace accepts network arrival");
var late = await Use(s => s.StartAsync(user.Id, quiz.QuizId));
clock.Now = new DateTimeOffset(late.ExpiresAt!.Value).AddSeconds(5).AddTicks(1);
await Use(s => s.SubmitAsync(user.Id, late.QuizAttemptId, Answers(correct)));
result = await Use(s => s.GetResultAsync(user.Id, late.QuizAttemptId));
Check(result.Score == 0 && result.Questions.Single().Outcome == QuizAttemptQuestionOutcome.Unanswered, "late answers discarded and attempt finalized unanswered");
Check(!result.Questions.Single().SelectedAnswerIds.Any(), "late browser answers are never persisted");
var abandoned = await Use(s => s.StartAsync(user.Id, quiz.QuizId));
clock.Now = new DateTimeOffset(abandoned.ExpiresAt!.Value).AddSeconds(6);
Check((await Use(s => s.GetAsync(user.Id, abandoned.QuizAttemptId))).Status == AttemptStatus.Completed, "reopening expired attempt finalizes it");
var historyExpired = await Use(s => s.StartAsync(user.Id, quiz.QuizId));
clock.Now = new DateTimeOffset(historyExpired.ExpiresAt!.Value).AddSeconds(6);
Check((await Use(s => s.GetHistoryAsync(user.Id, 1, 20))).First().Status == AttemptStatus.Completed, "history reconciles expired attempts");
var resultExpired = await Use(s => s.StartAsync(user.Id, quiz.QuizId));
clock.Now = new DateTimeOffset(resultExpired.ExpiresAt!.Value).AddSeconds(6);
Check((await Use(s => s.GetResultAsync(user.Id, resultExpired.QuizAttemptId))).Score == 0, "result lookup finalizes expired attempts");

var concurrent = await Use(s => s.StartAsync(user.Id, quiz.QuizId));
async Task<bool> Race() { try { await Use(s => s.SubmitAsync(user.Id, concurrent.QuizAttemptId, Answers(correct))); return true; } catch (ConflictException) { return false; } }
var races = await Task.WhenAll(Race(), Race());
Check(races.Count(x => x) == 1, "concurrent submission has exactly one winner");
await using (var verify = Db()) Check(await verify.QuizAttemptQuestionResults.CountAsync(q => q.QuizAttemptId == concurrent.QuizAttemptId) == 1, "concurrent submission cannot duplicate snapshots");

var untimedInput = new CreateQuizVm { Title = "Untimed", Duration = 0 };
Check(!Validator.TryValidateObject(untimedInput, new ValidationContext(untimedInput), new List<ValidationResult>(), true), "create contract rejects untimed duration");
// Legacy null-deadline data retains previous behavior; do not invent a timer.
var legacy = new QuizAttempt { UserId = user.Id, QuizId = quiz.QuizId, StartedAt = start.UtcDateTime.AddYears(-1) };
seed.QuizAttempts.Add(legacy); await seed.SaveChangesAsync();
var legacyVm = await Use(s => s.GetAsync(user.Id, legacy.QuizAttemptId));
Check(legacyVm.ExpiresAt == null && legacyVm.Status == AttemptStatus.InProgress, "legacy no-deadline attempt remains untimed");
await Use(s => s.SubmitAsync(user.Id, legacy.QuizAttemptId, Answers(correct)));
Check((await Use(s => s.GetResultAsync(user.Id, legacy.QuizAttemptId))).Score == 5, "legacy submission remains functional");
Console.WriteLine($"PASS: {checks} assertions. Isolated database retained: {database}");

sealed class TestClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = new(2026, 9, 22, 0, 0, 0, TimeSpan.Zero);
    public override DateTimeOffset GetUtcNow() => Now;
}
