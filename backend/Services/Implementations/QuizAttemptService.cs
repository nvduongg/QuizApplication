using backend.Data;
using backend.Enums;
using backend.Exceptions;
using backend.Models;
using backend.Services.Interfaces;
using backend.ViewModels.QuizAttempts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

namespace backend.Services.Implementations
{
    public class QuizAttemptService : IQuizAttemptService
    {
        private readonly AppDbContext _context;
        private readonly TimeProvider _clock;
        public static readonly TimeSpan SubmissionGrace = TimeSpan.FromSeconds(5);

        public QuizAttemptService(AppDbContext context, TimeProvider clock)
        {
            _context = context;
            _clock = clock;
        }

        public async Task<QuizAttemptVm> StartAsync(string userId, int quizId)
        {
            // Serialize starts for this quiz so two tabs reuse the same active attempt.
            await using var transaction = await _context.Database.BeginTransactionAsync();
            var quiz = await _context.Quizzes
                .FromSqlInterpolated($"SELECT * FROM [Quizzes] WITH (UPDLOCK, HOLDLOCK) WHERE [QuizId] = {quizId}")
                .AsNoTracking()
                .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Visibility == Visibility.Public);

            if (quiz == null)
            {
                throw new NotFoundException($"Public Quiz with ID {quizId} was not found.");
            }

            var existing = await _context.QuizAttempts.AsNoTracking()
                .Where(a => a.UserId == userId && a.QuizId == quizId && a.Status == AttemptStatus.InProgress)
                .OrderByDescending(a => a.StartedAt).FirstOrDefaultAsync();
            if (existing != null)
            {
                await transaction.CommitAsync();
                await transaction.DisposeAsync();
                return await GetAsync(userId, existing.QuizAttemptId);
            }

            var now = _clock.GetUtcNow().UtcDateTime;
            var attempt = new QuizAttempt
            {
                UserId = userId,
                QuizId = quizId,
                StartedAt = now,
                ExpiresAt = quiz.Duration > 0 ? now.AddMinutes(quiz.Duration) : null,
                Status = AttemptStatus.InProgress
            };

            _context.QuizAttempts.Add(attempt);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            await transaction.DisposeAsync();

            return await GetAsync(userId, attempt.QuizAttemptId);
        }

        public async Task<QuizAttemptVm> GetAsync(string userId, int attemptId)
        {
            var attempt = await GetOwnedAttemptAsync(userId, attemptId);
            attempt = await FinalizeExpiredAsync(userId, attempt);
            return Map(attempt);
        }

        public async Task<QuizAttemptResultVm> GetResultAsync(string userId, int attemptId)
        {
            var attempt = await GetOwnedAttemptAsync(userId, attemptId);
            attempt = await FinalizeExpiredAsync(userId, attempt);
            if (attempt.Status != AttemptStatus.Completed)
            {
                throw new ConflictException("The quiz attempt has not been submitted.");
            }

            return MapResult(attempt);
        }

        public async Task<IReadOnlyList<QuizAttemptHistoryItemVm>> GetHistoryAsync(
            string userId,
            int page,
            int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var offset = ((long)page - 1) * pageSize;
            if (offset > int.MaxValue)
            {
                return Array.Empty<QuizAttemptHistoryItemVm>();
            }

            var cutoff = _clock.GetUtcNow().UtcDateTime.Subtract(SubmissionGrace);
            var pageIds = await _context.QuizAttempts.AsNoTracking()
                .Where(a => a.UserId == userId).OrderByDescending(a => a.StartedAt)
                .ThenByDescending(a => a.QuizAttemptId).Skip((int)offset).Take(pageSize)
                .Where(a => a.Status == AttemptStatus.InProgress && a.ExpiresAt < cutoff)
                .Select(a => a.QuizAttemptId).ToListAsync();
            foreach (var id in pageIds) await GetAsync(userId, id);

            var history = await _context.QuizAttempts
                .AsNoTracking()
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.StartedAt)
                .ThenByDescending(a => a.QuizAttemptId)
                .Skip((int)offset)
                .Take(pageSize)
                .Select(a => new QuizAttemptHistoryItemVm
                {
                    QuizAttemptId = a.QuizAttemptId,
                    QuizId = a.QuizId,
                    QuizTitle = a.Quiz.Title,
                    Status = a.Status,
                    StartedAt = a.StartedAt,
                    SubmittedAt = a.SubmittedAt,
                    Score = a.Score,
                    TotalPoints = a.QuestionResults.Any()
                        ? a.QuestionResults.Sum(q => q.MaxPoints)
                        : a.Quiz.QuizQuestions.Sum(q => (decimal?)q.Points) ?? 0,
                    Percentage = a.Score.HasValue &&
                        (a.QuestionResults.Any()
                            ? a.QuestionResults.Sum(q => q.MaxPoints)
                            : a.Quiz.QuizQuestions.Sum(q => (decimal?)q.Points) ?? 0) > 0
                        ? Math.Round(a.Score.Value /
                            (a.QuestionResults.Any()
                                ? a.QuestionResults.Sum(q => q.MaxPoints)
                                : a.Quiz.QuizQuestions.Sum(q => (decimal?)q.Points) ?? 1) * 100m, 2)
                        : null
                })
                .ToListAsync();
            foreach (var item in history)
            {
                item.StartedAt = Utc(item.StartedAt);
                item.SubmittedAt = item.SubmittedAt.HasValue ? Utc(item.SubmittedAt.Value) : null;
            }
            return history;
        }

        public async Task<QuizAttemptSubmissionVm> SubmitAsync(
            string userId,
            int attemptId,
            SubmitQuizAttemptVm model)
        {
            // Admission time is server-owned, sampled before reading/grading the attempt.
            var receivedAt = _clock.GetUtcNow().UtcDateTime;
            var attempt = await GetOwnedAttemptAsync(userId, attemptId);

            if (attempt.Status != AttemptStatus.InProgress)
            {
                throw new ConflictException("This quiz attempt has already been submitted.");
            }

            // There is no server-side draft: answers arriving after the grace period
            // cannot be credited. Finalize an unanswered snapshot instead.
            var entries = IsExpired(attempt, receivedAt)
                ? new List<SubmittedQuestionVm>()
                : model.Questions ?? new List<SubmittedQuestionVm>();
            if (entries.GroupBy(x => x.QuestionId).Any(group => group.Count() > 1))
            {
                throw new BadRequestException("A question may only be submitted once.");
            }

            var quizQuestions = attempt.Quiz.QuizQuestions.ToDictionary(x => x.QuestionId);
            var submittedIds = entries.Select(x => x.QuestionId).ToHashSet();
            if (submittedIds.Any(id => !quizQuestions.ContainsKey(id)))
            {
                throw new BadRequestException("One or more submitted questions do not belong to this quiz.");
            }

            foreach (var entry in entries)
            {
                var quizQuestion = quizQuestions[entry.QuestionId];
                var answerIds = entry.AnswerIds ?? new List<int>();

                if (answerIds.Distinct().Count() != answerIds.Count)
                {
                    throw new BadRequestException("An answer may only be selected once for a question.");
                }

                var validAnswerIds = quizQuestion.Question.Answers.Select(a => a.AnswerId).ToHashSet();
                if (answerIds.Any(answerId => !validAnswerIds.Contains(answerId)))
                {
                    throw new BadRequestException("One or more selected answers do not belong to the submitted question.");
                }

                if (answerIds.Count == 0)
                {
                    continue;
                }

                if (quizQuestion.Question.QuestionType is QuestionType.SingleChoice or QuestionType.TrueFalse && answerIds.Count != 1)
                {
                    throw new BadRequestException("Single-choice and True/False questions require exactly one selected answer.");
                }

                foreach (var answerId in answerIds)
                {
                    attempt.AttemptAnswers.Add(new AttemptAnswer
                    {
                        QuestionId = entry.QuestionId,
                        AnswerId = answerId
                    });
                }
            }

            var score = 0m;
            foreach (var quizQuestion in attempt.Quiz.QuizQuestions)
            {
                var selected = entries
                    .FirstOrDefault(x => x.QuestionId == quizQuestion.QuestionId)?.AnswerIds
                    ?? new List<int>();
                var correct = quizQuestion.Question.Answers
                    .Where(a => a.IsCorrect)
                    .Select(a => a.AnswerId)
                    .ToHashSet();

                var outcome = selected.Count == 0
                    ? QuizAttemptQuestionOutcome.Unanswered
                    : selected.Count == correct.Count && selected.ToHashSet().SetEquals(correct)
                        ? QuizAttemptQuestionOutcome.Correct
                        : QuizAttemptQuestionOutcome.Incorrect;

                var earnedPoints = outcome == QuizAttemptQuestionOutcome.Correct
                    ? quizQuestion.Points
                    : 0m;

                if (outcome == QuizAttemptQuestionOutcome.Correct)
                {
                    score += quizQuestion.Points;
                }

                var resultQuestion = new QuizAttemptQuestionResult
                {
                    QuizAttemptId = attempt.QuizAttemptId,
                    QuestionId = quizQuestion.QuestionId,
                    Content = quizQuestion.Question.Content,
                    QuestionType = quizQuestion.Question.QuestionType,
                    QuestionOrder = quizQuestion.QuestionOrder,
                    EarnedPoints = earnedPoints,
                    MaxPoints = quizQuestion.Points,
                    Outcome = outcome
                };

                foreach (var answer in quizQuestion.Question.Answers)
                {
                    resultQuestion.Answers.Add(new QuizAttemptResultAnswer
                    {
                        AnswerId = answer.AnswerId,
                        Content = answer.Content,
                        IsCorrect = answer.IsCorrect,
                        IsSelected = selected.Contains(answer.AnswerId)
                    });
                }

                attempt.QuestionResults.Add(resultQuestion);
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();
            attempt.Score = score;
            attempt.SubmittedAt = receivedAt;
            attempt.Status = AttemptStatus.Completed;
            try
            {
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                await transaction.RollbackAsync();
                throw new ConflictException("This quiz attempt has already been submitted.");
            }
            catch (DbUpdateException exception) when
                (exception.InnerException is SqlException { Number: 2601 or 2627 })
            {
                // A parallel submission may have committed the same attempt first.
                // Preserve unique constraints and only translate a confirmed completion.
                await transaction.RollbackAsync();
                if (await _context.QuizAttempts.AsNoTracking().AnyAsync(a =>
                    a.QuizAttemptId == attemptId && a.UserId == userId &&
                    a.Status == AttemptStatus.Completed))
                {
                    throw new ConflictException("This quiz attempt has already been submitted.");
                }
                throw;
            }

            return new QuizAttemptSubmissionVm
            {
                QuizAttemptId = attempt.QuizAttemptId,
                Status = attempt.Status,
                SubmittedAt = attempt.SubmittedAt!.Value
            };
        }

        private async Task<QuizAttempt> GetOwnedAttemptAsync(
            string userId,
            int attemptId)
        {
            var attempt = await _context.QuizAttempts
                .Include(a => a.Quiz)
                    .ThenInclude(q => q.QuizQuestions)
                        .ThenInclude(qq => qq.Question)
                            .ThenInclude(q => q.Answers)
                .Include(a => a.AttemptAnswers)
                .Include(a => a.QuestionResults)
                    .ThenInclude(r => r.Answers)
                .FirstOrDefaultAsync(a => a.QuizAttemptId == attemptId && a.UserId == userId);

            if (attempt == null)
            {
                throw new NotFoundException($"Quiz attempt with ID {attemptId} was not found.");
            }

            return attempt;
        }

        private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

        private static bool IsExpired(QuizAttempt attempt, DateTime now) =>
            attempt.ExpiresAt.HasValue && now > Utc(attempt.ExpiresAt.Value).Add(SubmissionGrace);

        private async Task<QuizAttempt> FinalizeExpiredAsync(string userId, QuizAttempt attempt)
        {
            if (attempt.Status != AttemptStatus.InProgress || !IsExpired(attempt, _clock.GetUtcNow().UtcDateTime))
                return attempt;
            try { await SubmitAsync(userId, attempt.QuizAttemptId, new SubmitQuizAttemptVm()); }
            catch (ConflictException) { /* Another tab finalized first. Read its committed result. */ }
            _context.ChangeTracker.Clear();
            return await GetOwnedAttemptAsync(userId, attempt.QuizAttemptId);
        }

        private QuizAttemptVm Map(QuizAttempt attempt)
        {
            var useSnapshot = attempt.Status == AttemptStatus.Completed && attempt.QuestionResults.Count > 0;
            var totalPoints = useSnapshot
                ? attempt.QuestionResults.Sum(x => x.MaxPoints)
                : attempt.Quiz.QuizQuestions.Sum(x => x.Points);
            return new QuizAttemptVm
            {
                QuizAttemptId = attempt.QuizAttemptId,
                QuizId = attempt.QuizId,
                QuizTitle = attempt.Quiz.Title,
                StartedAt = Utc(attempt.StartedAt),
                ExpiresAt = attempt.ExpiresAt.HasValue ? Utc(attempt.ExpiresAt.Value) : null,
                ServerNow = _clock.GetUtcNow().UtcDateTime,
                SubmittedAt = attempt.SubmittedAt.HasValue ? Utc(attempt.SubmittedAt.Value) : null,
                Score = attempt.Score,
                TotalPoints = totalPoints,
                Percentage = attempt.Score.HasValue && totalPoints > 0
                    ? Math.Round(attempt.Score.Value / totalPoints * 100m, 2)
                    : null,
                Status = attempt.Status,
                Questions = useSnapshot
                    ? attempt.QuestionResults.OrderBy(x => x.QuestionOrder)
                        .Select(x => new QuizAttemptQuestionVm
                        {
                            QuestionId = x.QuestionId,
                            Content = x.Content,
                            QuestionType = x.QuestionType,
                            QuestionOrder = x.QuestionOrder,
                            Points = x.MaxPoints,
                            Answers = x.Answers.OrderBy(a => a.AnswerId)
                                .Select(a => new QuizAttemptAnswerVm
                                {
                                    AnswerId = a.AnswerId,
                                    Content = a.Content
                                }).ToList()
                        }).ToList()
                    : attempt.Quiz.QuizQuestions
                        .OrderBy(x => x.QuestionOrder)
                        .Select(x => new QuizAttemptQuestionVm
                        {
                            QuestionId = x.QuestionId,
                            Content = x.Question.Content,
                            QuestionType = x.Question.QuestionType,
                            QuestionOrder = x.QuestionOrder,
                            Points = x.Points,
                            Answers = x.Question.Answers
                                .OrderBy(a => a.AnswerId)
                                .Select(a => new QuizAttemptAnswerVm
                                {
                                    AnswerId = a.AnswerId,
                                    Content = a.Content
                                })
                                .ToList()
                        })
                    .ToList()
            };
        }

        private static QuizAttemptResultVm MapResult(QuizAttempt attempt)
        {
            var hasReviewDetails = attempt.QuestionResults.Count > 0;
            var totalPoints = hasReviewDetails
                ? attempt.QuestionResults.Sum(x => x.MaxPoints)
                : attempt.Quiz.QuizQuestions.Sum(x => x.Points);
            return new QuizAttemptResultVm
            {
                QuizAttemptId = attempt.QuizAttemptId,
                QuizId = attempt.QuizId,
                QuizTitle = attempt.Quiz.Title,
                StartedAt = Utc(attempt.StartedAt),
                SubmittedAt = attempt.SubmittedAt.HasValue ? Utc(attempt.SubmittedAt.Value) : null,
                Score = attempt.Score,
                TotalPoints = totalPoints,
                Percentage = attempt.Score.HasValue && totalPoints > 0
                    ? Math.Round(attempt.Score.Value / totalPoints * 100m, 2)
                    : null,
                Status = attempt.Status,
                ReviewAvailable = hasReviewDetails,
                Questions = attempt.QuestionResults
                    .OrderBy(x => x.QuestionOrder)
                    .Select(x => new QuizAttemptResultQuestionVm
                    {
                        QuestionId = x.QuestionId,
                        Content = x.Content,
                        QuestionType = x.QuestionType,
                        QuestionOrder = x.QuestionOrder,
                        EarnedPoints = x.EarnedPoints,
                        MaxPoints = x.MaxPoints,
                        Outcome = x.Outcome,
                        SelectedAnswerIds = x.Answers.Where(a => a.IsSelected).Select(a => a.AnswerId).ToList(),
                        CorrectAnswerIds = x.Answers.Where(a => a.IsCorrect).Select(a => a.AnswerId).ToList(),
                        Answers = x.Answers.OrderBy(a => a.AnswerId).Select(a => new QuizAttemptResultAnswerVm
                        {
                            AnswerId = a.AnswerId,
                            Content = a.Content
                        }).ToList()
                    })
                    .ToList()
            };
        }
    }
}
