using static backend.Validation.QuestionRules;
using backend.Data;
using backend.Enums;
using backend.Exceptions;
using backend.Models;
using backend.Services.Interfaces;
using backend.ViewModels.Answers;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations
{
    public class AnswerService : IAnswerService
    {
        private readonly AppDbContext _context;

        public AnswerService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<AnswerVm>> GetByQuestionAsync(
            int questionId,
            string userId)
        {
            var question = await _context.Questions
                .AsNoTracking()
                .Where(x => x.QuestionId == questionId)
                .Select(x => new
                {
                    x.QuestionId,
                    OwnerId = x.QuestionBank.OwnerId,
                    Visibility = x.QuestionBank.Visibility
                })
                .FirstOrDefaultAsync();

            if (question == null)
            {
                throw new NotFoundException(
                    $"Question with ID {questionId} was not found.");
            }

            EnsureCanRead(
                question.OwnerId,
                question.Visibility,
                userId);

            return await _context.Answers
                .AsNoTracking()
                .Where(x => x.QuestionId == questionId)
                .OrderBy(x => x.AnswerId)
                .Select(x => new AnswerVm
                {
                    AnswerId = x.AnswerId,
                    QuestionId = x.QuestionId,
                    Content = x.Content,
                    IsCorrect = x.IsCorrect
                })
                .ToListAsync();
        }

        public async Task<AnswerVm> CreateAsync(
            int questionId,
            string userId,
            CreateAnswerVm model)
        {
            var question = await _context.Questions
                .Include(x => x.QuestionBank)
                .Include(x => x.Answers)
                .FirstOrDefaultAsync(x =>
                    x.QuestionId == questionId);

            if (question == null)
            {
                throw new NotFoundException(
                    $"Question with ID {questionId} was not found.");
            }

            EnsureOwner(
                question.QuestionBank.OwnerId,
                userId);

            ValidateContent(model.Content);

            ValidateNewAnswer(
                question,
                model.Content.Trim(),
                model.IsCorrect);

            var answer = new Answer
            {
                QuestionId = questionId,
                Content = model.Content.Trim(),
                IsCorrect = model.IsCorrect
            };

            _context.Answers.Add(answer);

            await _context.SaveChangesAsync();

            return Map(answer);
        }

        public async Task<AnswerVm> UpdateAsync(
            int id,
            string userId,
            UpdateAnswerVm model)
        {
            var answer = await _context.Answers
                .Include(x => x.Question)
                    .ThenInclude(q => q.QuestionBank)
                .FirstOrDefaultAsync(x =>
                    x.AnswerId == id);

            if (answer == null)
            {
                throw new NotFoundException(
                    $"Answer with ID {id} was not found.");
            }

            EnsureOwner(
                answer.Question.QuestionBank.OwnerId,
                userId);

            ValidateContent(model.Content);

            var siblingAnswers =
                await _context.Answers
                    .Where(x =>
                        x.QuestionId == answer.QuestionId &&
                        x.AnswerId != answer.AnswerId)
                    .ToListAsync();

            ValidateUpdatedAnswer(
                answer.Question.QuestionType,
                siblingAnswers,
                model.Content.Trim(),
                model.IsCorrect);

            answer.Content = model.Content.Trim();
            answer.IsCorrect = model.IsCorrect;

            await _context.SaveChangesAsync();

            return Map(answer);
        }

        public async Task DeleteAsync(
            int id,
            string userId)
        {
            var answer = await _context.Answers
                .Include(x => x.Question)
                    .ThenInclude(q => q.QuestionBank)
                .FirstOrDefaultAsync(x =>
                    x.AnswerId == id);

            if (answer == null)
            {
                throw new NotFoundException(
                    $"Answer with ID {id} was not found.");
            }

            EnsureOwner(
                answer.Question.QuestionBank.OwnerId,
                userId);

            var usedInAttempt =
                await _context.AttemptAnswers
                    .AnyAsync(x =>
                        x.AnswerId == id);

            if (usedInAttempt)
            {
                throw new ConflictException(
                    "The answer is referenced by an existing quiz attempt and cannot be deleted.");
            }

            _context.Answers.Remove(answer);

            await _context.SaveChangesAsync();
        }

        private static void EnsureCanRead(
            string ownerId,
            Visibility visibility,
            string userId)
        {
            if (ownerId == userId ||
                visibility == Visibility.Public)
            {
                return;
            }

            throw new ForbiddenException(
                "You do not have permission to access these answers.");
        }

        private static void EnsureOwner(
            string ownerId,
            string userId)
        {
            if (ownerId != userId)
            {
                throw new ForbiddenException(
                    "You can only modify answers in your own Question Bank.");
            }
        }

        private static AnswerVm Map(Answer answer)
        {
            return new AnswerVm
            {
                AnswerId = answer.AnswerId,
                QuestionId = answer.QuestionId,
                Content = answer.Content,
                IsCorrect = answer.IsCorrect
            };
        }
    }
}