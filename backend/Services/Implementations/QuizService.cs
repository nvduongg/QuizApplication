using static backend.Validation.QuestionRules;
using backend.Data;
using backend.Enums;
using backend.Exceptions;
using backend.Models;
using backend.Services.Interfaces;
using backend.ViewModels.Quizzes;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations
{
    public class QuizService : IQuizService
    {
        private readonly AppDbContext _context;

        public QuizService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<QuizVm>> GetMineAsync(
            string userId)
        {
            return await _context.Quizzes
                .AsNoTracking()
                .Where(q => q.CreatorId == userId)
                .OrderByDescending(q => q.CreatedAt)
                .Select(q => new QuizVm
                {
                    QuizId = q.QuizId,
                    Title = q.Title,
                    Description = q.Description,
                    Duration = q.Duration,
                    Visibility = q.Visibility,
                    CreatedAt = q.CreatedAt,
                    CreatorId = q.CreatorId,
                    CreatorName = q.Creator.FullName,

                    QuestionCount =
                        q.QuizQuestions.Count,

                    TotalPoints =
                        q.QuizQuestions
                            .Sum(qq => (decimal?)qq.Points)
                        ?? 0
                })
                .ToListAsync();
        }

        public async Task<QuizDetailVm> GetByIdAsync(
            int id,
            string userId)
        {
            var quiz = await _context.Quizzes
                .AsNoTracking()
                .Where(q => q.QuizId == id)
                .Select(q => new
                {
                    q.QuizId,
                    q.Title,
                    q.Description,
                    q.Duration,
                    q.Visibility,
                    q.CreatedAt,
                    q.CreatorId,

                    CreatorName =
                        q.Creator.FullName,

                    QuestionCount =
                        q.QuizQuestions.Count,

                    TotalPoints =
                        q.QuizQuestions
                            .Sum(qq => (decimal?)qq.Points)
                        ?? 0
                })
                .FirstOrDefaultAsync();

            if (quiz == null)
            {
                throw new NotFoundException(
                    $"Quiz with ID {id} was not found.");
            }

            EnsureOwner(
                quiz.CreatorId,
                userId);

            return new QuizDetailVm
            {
                QuizId = quiz.QuizId,
                Title = quiz.Title,
                Description = quiz.Description,
                Duration = quiz.Duration,
                Visibility = quiz.Visibility,
                CreatedAt = quiz.CreatedAt,
                CreatorId = quiz.CreatorId,
                CreatorName = quiz.CreatorName,
                QuestionCount = quiz.QuestionCount,
                TotalPoints = quiz.TotalPoints
            };
        }

        public async Task<QuizDetailVm> CreateAsync(
            string userId,
            CreateQuizVm model)
        {
            ValidateQuiz(
                model.Title,
                model.Duration);

            var quiz = new Quiz
            {
                CreatorId = userId,

                Title =
                    model.Title.Trim(),

                Description =
                    string.IsNullOrWhiteSpace(
                        model.Description)
                        ? null
                        : model.Description.Trim(),

                Duration = model.Duration,

                // New quizzes are always private.
                Visibility = Visibility.Private,

                CreatedAt = DateTime.UtcNow
            };

            _context.Quizzes.Add(quiz);

            await _context.SaveChangesAsync();

            return await GetByIdAsync(
                quiz.QuizId,
                userId);
        }

        public async Task<QuizDetailVm> UpdateAsync(
            int id,
            string userId,
            UpdateQuizVm model)
        {
            var quiz = await _context.Quizzes
                .FirstOrDefaultAsync(q =>
                    q.QuizId == id);

            if (quiz == null)
            {
                throw new NotFoundException(
                    $"Quiz with ID {id} was not found.");
            }

            EnsureOwner(
                quiz.CreatorId,
                userId);

            ValidateQuiz(
                model.Title,
                model.Duration);

            quiz.Title =
                model.Title.Trim();

            quiz.Description =
                string.IsNullOrWhiteSpace(
                    model.Description)
                    ? null
                    : model.Description.Trim();

            quiz.Duration =
                model.Duration;

            await _context.SaveChangesAsync();

            return await GetByIdAsync(
                id,
                userId);
        }

        public async Task<QuizDetailVm> PublishAsync(
            int id,
            string userId)
        {
            var quiz = await _context.Quizzes
                .Include(q => q.QuizQuestions)
                    .ThenInclude(qq => qq.Question)
                        .ThenInclude(q => q.Answers)
                .FirstOrDefaultAsync(q =>
                    q.QuizId == id);

            if (quiz == null)
            {
                throw new NotFoundException(
                    $"Quiz with ID {id} was not found.");
            }

            EnsureOwner(
                quiz.CreatorId,
                userId);

            if (quiz.Visibility == Visibility.Public)
            {
                throw new ConflictException(
                    "The Quiz is already published.");
            }

            ValidateForPublishing(quiz);

            quiz.Visibility =
                Visibility.Public;

            await _context.SaveChangesAsync();

            return await GetByIdAsync(
                id,
                userId);
        }

        public async Task<QuizDetailVm> UnpublishAsync(
            int id,
            string userId)
        {
            var quiz = await _context.Quizzes
                .FirstOrDefaultAsync(q =>
                    q.QuizId == id);

            if (quiz == null)
            {
                throw new NotFoundException(
                    $"Quiz with ID {id} was not found.");
            }

            EnsureOwner(
                quiz.CreatorId,
                userId);

            if (quiz.Visibility == Visibility.Private)
            {
                throw new ConflictException(
                    "The Quiz is already private.");
            }

            quiz.Visibility =
                Visibility.Private;

            await _context.SaveChangesAsync();

            return await GetByIdAsync(
                id,
                userId);
        }

        public async Task DeleteAsync(
            int id,
            string userId)
        {
            var quiz = await _context.Quizzes
                .FirstOrDefaultAsync(q =>
                    q.QuizId == id);

            if (quiz == null)
            {
                throw new NotFoundException(
                    $"Quiz with ID {id} was not found.");
            }

            EnsureOwner(
                quiz.CreatorId,
                userId);

            var hasAttempts =
                await _context.QuizAttempts
                    .AnyAsync(a =>
                        a.QuizId == id);

            if (hasAttempts)
            {
                throw new ConflictException(
                    "The Quiz has existing attempts and cannot be deleted.");
            }

            _context.Quizzes.Remove(quiz);

            await _context.SaveChangesAsync();
        }

        private static void ValidateQuiz(
            string title,
            int duration)
        {
            if (string.IsNullOrWhiteSpace(title))
            {
                throw new BadRequestException(
                    "Quiz title cannot be empty.");
            }

            if (duration <= 0)
            {
                throw new BadRequestException(
                    "Quiz duration must be greater than zero.");
            }
        }

        private static void ValidateForPublishing(
            Quiz quiz)
        {
            if (quiz.QuizQuestions.Count == 0)
            {
                throw new BadRequestException(
                    "The Quiz must contain at least one question before it can be published.");
            }

            foreach (var quizQuestion
                     in quiz.QuizQuestions)
            {
                if (quizQuestion.Points <= 0)
                {
                    throw new BadRequestException(
                        $"Question {quizQuestion.QuestionId} must have points greater than zero.");
                }

                ValidateQuestionForPublishing(
                    quizQuestion.Question);
            }
        }

        private static void EnsureOwner(
            string creatorId,
            string userId)
        {
            if (creatorId != userId)
            {
                throw new ForbiddenException(
                    "You can only manage your own Quizzes.");
            }
        }
    }
}