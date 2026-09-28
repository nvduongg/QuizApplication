using static backend.Validation.QuestionRules;
using backend.Data;
using backend.Enums;
using backend.Exceptions;
using backend.Models;
using backend.Services.Interfaces;
using backend.ViewModels.Answers;
using backend.ViewModels.Questions;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations
{
    public class QuestionService : IQuestionService
    {
        private readonly AppDbContext _context;

        public QuestionService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<QuestionVm>> GetByBankAsync(
            int bankId,
            string userId)
        {
            var bank = await _context.QuestionBanks
                .AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.QuestionBankId == bankId);

            if (bank == null)
            {
                throw new NotFoundException(
                    $"Question Bank with ID {bankId} was not found.");
            }

            EnsureCanReadBank(bank.OwnerId, bank.Visibility, userId);

            return await _context.Questions
                .AsNoTracking()
                .Where(x => x.QuestionBankId == bankId)
                .OrderBy(x => x.QuestionId)
                .Select(x => new QuestionVm
                {
                    QuestionId = x.QuestionId,
                    QuestionBankId = x.QuestionBankId,
                    Content = x.Content,
                    QuestionType = x.QuestionType,
                    CreatedAt = x.CreatedAt,
                    AnswerCount = x.Answers.Count
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<QuestionVm>> SearchAccessibleAsync(
            string userId,
            string search)
        {
            if (string.IsNullOrWhiteSpace(search))
            {
                throw new BadRequestException("A question search term is required.");
            }

            var keyword = search.Trim();
            return await _context.Questions
                .AsNoTracking()
                .Where(q => q.Content.Contains(keyword) &&
                    (q.QuestionBank.OwnerId == userId ||
                     q.QuestionBank.Visibility == Visibility.Public))
                .OrderBy(q => q.QuestionId)
                .Select(q => new QuestionVm
                {
                    QuestionId = q.QuestionId,
                    QuestionBankId = q.QuestionBankId,
                    Content = q.Content,
                    QuestionType = q.QuestionType,
                    CreatedAt = q.CreatedAt,
                    AnswerCount = q.Answers.Count
                })
                .ToListAsync();
        }

        public async Task<QuestionDetailVm> GetByIdAsync(
            int id,
            string userId)
        {
            var question = await _context.Questions
                .AsNoTracking()
                .Where(x => x.QuestionId == id)
                .Select(x => new
                {
                    x.QuestionId,
                    x.QuestionBankId,
                    x.Content,
                    x.QuestionType,
                    x.CreatedAt,

                    OwnerId = x.QuestionBank.OwnerId,
                    Visibility = x.QuestionBank.Visibility,

                    Answers = x.Answers
                        .OrderBy(a => a.AnswerId)
                        .Select(a => new AnswerVm
                        {
                            AnswerId = a.AnswerId,
                            QuestionId = a.QuestionId,
                            Content = a.Content,
                            IsCorrect = a.IsCorrect
                        })
                        .ToList()
                })
                .FirstOrDefaultAsync();

            if (question == null)
            {
                throw new NotFoundException(
                    $"Question with ID {id} was not found.");
            }

            EnsureCanReadBank(
                question.OwnerId,
                question.Visibility,
                userId);

            return new QuestionDetailVm
            {
                QuestionId = question.QuestionId,
                QuestionBankId = question.QuestionBankId,
                Content = question.Content,
                QuestionType = question.QuestionType,
                CreatedAt = question.CreatedAt,
                Answers = question.Answers
            };
        }

        public async Task<QuestionDetailVm> CreateAsync(
            int bankId,
            string userId,
            CreateQuestionVm model)
        {
            var bank = await _context.QuestionBanks
                .FirstOrDefaultAsync(x =>
                    x.QuestionBankId == bankId);

            if (bank == null)
            {
                throw new NotFoundException(
                    $"Question Bank with ID {bankId} was not found.");
            }

            EnsureOwner(bank.OwnerId, userId);

            ValidateQuestion(model.Content, model.QuestionType);

            var question = new Question
            {
                QuestionBankId = bankId,
                Content = model.Content.Trim(),
                QuestionType = model.QuestionType,
                CreatedAt = DateTime.UtcNow
            };

            _context.Questions.Add(question);

            await _context.SaveChangesAsync();

            return await GetByIdAsync(
                question.QuestionId,
                userId);
        }

        public async Task<QuestionDetailVm> UpdateAsync(
            int id,
            string userId,
            UpdateQuestionVm model)
        {
            var question = await _context.Questions
                .Include(x => x.QuestionBank)
                .Include(x => x.Answers)
                .FirstOrDefaultAsync(x =>
                    x.QuestionId == id);

            if (question == null)
            {
                throw new NotFoundException(
                    $"Question with ID {id} was not found.");
            }

            EnsureOwner(
                question.QuestionBank.OwnerId,
                userId);

            ValidateQuestion(
                model.Content,
                model.QuestionType);

            /*
             * Changing QuestionType after answers exist can make
             * existing answers invalid.
             *
             * Example:
             * MultipleChoice -> TrueFalse
             */
            if (question.QuestionType != model.QuestionType &&
                question.Answers.Count != 0)
            {
                throw new ConflictException(
                    "Question type cannot be changed while the question contains answers. Delete the answers first.");
            }

            question.Content = model.Content.Trim();
            question.QuestionType = model.QuestionType;

            await _context.SaveChangesAsync();

            return await GetByIdAsync(id, userId);
        }

        public async Task DeleteAsync(
            int id,
            string userId)
        {
            var question = await _context.Questions
                .Include(x => x.QuestionBank)
                .FirstOrDefaultAsync(x =>
                    x.QuestionId == id);

            if (question == null)
            {
                throw new NotFoundException(
                    $"Question with ID {id} was not found.");
            }

            EnsureOwner(
                question.QuestionBank.OwnerId,
                userId);

            var usedByQuiz =
                await _context.QuizQuestions
                    .AnyAsync(x =>
                        x.QuestionId == id);

            var usedByAttempt = await _context.AttemptAnswers
                .AnyAsync(x => x.QuestionId == id);

            if (usedByQuiz || usedByAttempt)
            {
                throw new ConflictException(
                    "The question is used by a quiz or a historical attempt and cannot be deleted.");
            }

            _context.Questions.Remove(question);

            await _context.SaveChangesAsync();
        }

        private static void EnsureCanReadBank(
            string ownerId,
            Visibility visibility,
            string userId)
        {
            if (ownerId == userId)
            {
                return;
            }

            if (visibility == Visibility.Public)
            {
                return;
            }

            throw new ForbiddenException(
                "You do not have permission to access this question.");
        }

        private static void EnsureOwner(
            string ownerId,
            string userId)
        {
            if (ownerId != userId)
            {
                throw new ForbiddenException(
                    "You can only modify questions in your own Question Bank.");
            }
        }
    }
}
