using backend.Data;
using backend.Enums;
using backend.Exceptions;
using backend.Models;
using backend.Services.Interfaces;
using backend.ViewModels.QuizQuestions;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations
{
    public class QuizQuestionService
        : IQuizQuestionService
    {
        private readonly AppDbContext _context;

        public QuizQuestionService(
            AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<QuizQuestionVm>>
            GetAllAsync(
                int quizId,
                string userId)
        {
            await EnsureQuizOwnerAsync(
                quizId,
                userId);

            return await _context.QuizQuestions
                .AsNoTracking()
                .Where(qq =>
                    qq.QuizId == quizId)
                .OrderBy(qq =>
                    qq.QuestionOrder)
                .Select(qq =>
                    new QuizQuestionVm
                    {
                        QuizId = qq.QuizId,
                        QuestionId =
                            qq.QuestionId,

                        Content =
                            qq.Question.Content,

                        QuestionType =
                            qq.Question.QuestionType,

                        QuestionOrder =
                            qq.QuestionOrder,

                        Points =
                            qq.Points,

                        AnswerCount =
                            qq.Question.Answers.Count,

                        IsOwnedQuestion =
                            qq.Question
                                .QuestionBank
                                .OwnerId
                            == userId
                    })
                .ToListAsync();
        }

        public async Task<QuizQuestionVm> AddAsync(
            int quizId,
            string userId,
            AddQuizQuestionVm model)
        {
            var quiz =
                await GetOwnedQuizAsync(
                    quizId,
                    userId);

            if (quiz.Visibility ==
                Visibility.Public)
            {
                throw new ConflictException(
                    "Unpublish the Quiz before changing its questions.");
            }

            if (model.Points <= 0)
            {
                throw new BadRequestException(
                    "Question points must be greater than zero.");
            }

            var question =
                await _context.Questions
                    .Include(q =>
                        q.QuestionBank)
                    .Include(q =>
                        q.Answers)
                    .FirstOrDefaultAsync(q =>
                        q.QuestionId ==
                        model.QuestionId);

            if (question == null)
            {
                throw new NotFoundException(
                    $"Question with ID {model.QuestionId} was not found.");
            }

            var canReuse =
                question.QuestionBank.OwnerId ==
                    userId
                ||
                question.QuestionBank.Visibility ==
                    Visibility.Public;

            if (!canReuse)
            {
                throw new ForbiddenException(
                    "You cannot add a question from another user's private Question Bank.");
            }

            var duplicate =
                await _context.QuizQuestions
                    .AnyAsync(qq =>
                        qq.QuizId == quizId &&
                        qq.QuestionId ==
                        model.QuestionId);

            if (duplicate)
            {
                throw new ConflictException(
                    "The question is already included in this Quiz.");
            }

            var maxOrder =
                await _context.QuizQuestions
                    .Where(qq =>
                        qq.QuizId == quizId)
                    .MaxAsync(qq =>
                        (int?)qq.QuestionOrder)
                ?? 0;

            var quizQuestion =
                new QuizQuestion
                {
                    QuizId = quizId,
                    QuestionId =
                        model.QuestionId,
                    QuestionOrder =
                        maxOrder + 1,
                    Points = model.Points
                };

            _context.QuizQuestions.Add(
                quizQuestion);

            await _context.SaveChangesAsync();

            return await GetOneAsync(
                quizId,
                model.QuestionId,
                userId);
        }

        public async Task<QuizQuestionVm>
            UpdatePointsAsync(
                int quizId,
                int questionId,
                string userId,
                UpdateQuizQuestionPointsVm model)
        {
            var quiz =
                await GetOwnedQuizAsync(
                    quizId,
                    userId);

            if (quiz.Visibility ==
                Visibility.Public)
            {
                throw new ConflictException(
                    "Unpublish the Quiz before changing question points.");
            }

            if (model.Points <= 0)
            {
                throw new BadRequestException(
                    "Question points must be greater than zero.");
            }

            var quizQuestion =
                await _context.QuizQuestions
                    .FirstOrDefaultAsync(qq =>
                        qq.QuizId == quizId &&
                        qq.QuestionId ==
                        questionId);

            if (quizQuestion == null)
            {
                throw new NotFoundException(
                    "The question is not included in this Quiz.");
            }

            quizQuestion.Points =
                model.Points;

            await _context.SaveChangesAsync();

            return await GetOneAsync(
                quizId,
                questionId,
                userId);
        }

        public async Task ReorderAsync(
            int quizId,
            string userId,
            ReorderQuizQuestionsVm model)
        {
            var quiz =
                await GetOwnedQuizAsync(
                    quizId,
                    userId);

            if (quiz.Visibility ==
                Visibility.Public)
            {
                throw new ConflictException(
                    "Unpublish the Quiz before reordering questions.");
            }

            var quizQuestions =
                await _context.QuizQuestions
                    .Where(qq =>
                        qq.QuizId == quizId)
                    .OrderBy(qq =>
                        qq.QuestionOrder)
                    .ToListAsync();

            if (model.QuestionIds == null)
            {
                throw new BadRequestException(
                    "Question order is required.");
            }

            if (model.QuestionIds.Count !=
                quizQuestions.Count)
            {
                throw new BadRequestException(
                    "The reorder request must contain every question in the Quiz.");
            }

            if (model.QuestionIds.Distinct().Count()
                != model.QuestionIds.Count)
            {
                throw new BadRequestException(
                    "The reorder request contains duplicate question IDs.");
            }

            var existingIds =
                quizQuestions
                    .Select(qq =>
                        qq.QuestionId)
                    .OrderBy(id => id)
                    .ToList();

            var requestedIds =
                model.QuestionIds
                    .OrderBy(id => id)
                    .ToList();

            if (!existingIds.SequenceEqual(
                    requestedIds))
            {
                throw new BadRequestException(
                    "The reorder request must contain exactly the questions currently in the Quiz.");
            }

            /*
             * QuizId + QuestionOrder has a UNIQUE index.
             *
             * We first move all orders into unique temporary
             * negative values so swapping 1 <-> 2 cannot
             * violate the unique constraint during SaveChanges.
             */
            await using var transaction =
                await _context.Database
                    .BeginTransactionAsync();

            for (var i = 0;
                 i < quizQuestions.Count;
                 i++)
            {
                quizQuestions[i].QuestionOrder =
                    -(i + 1);
            }

            await _context.SaveChangesAsync();

            var map =
                quizQuestions.ToDictionary(
                    qq => qq.QuestionId);

            for (var i = 0;
                 i < model.QuestionIds.Count;
                 i++)
            {
                map[model.QuestionIds[i]]
                    .QuestionOrder = i + 1;
            }

            await _context.SaveChangesAsync();

            await transaction.CommitAsync();
        }

        public async Task RemoveAsync(
            int quizId,
            int questionId,
            string userId)
        {
            var quiz =
                await GetOwnedQuizAsync(
                    quizId,
                    userId);

            if (quiz.Visibility ==
                Visibility.Public)
            {
                throw new ConflictException(
                    "Unpublish the Quiz before removing questions.");
            }

            var quizQuestion =
                await _context.QuizQuestions
                    .FirstOrDefaultAsync(qq =>
                        qq.QuizId == quizId &&
                        qq.QuestionId ==
                        questionId);

            if (quizQuestion == null)
            {
                throw new NotFoundException(
                    "The question is not included in this Quiz.");
            }

            _context.QuizQuestions.Remove(
                quizQuestion);

            await _context.SaveChangesAsync();

            await NormalizeOrderAsync(
                quizId);
        }

        private async Task<QuizQuestionVm>
            GetOneAsync(
                int quizId,
                int questionId,
                string userId)
        {
            var result =
                await _context.QuizQuestions
                    .AsNoTracking()
                    .Where(qq =>
                        qq.QuizId == quizId &&
                        qq.QuestionId ==
                        questionId)
                    .Select(qq =>
                        new QuizQuestionVm
                        {
                            QuizId =
                                qq.QuizId,

                            QuestionId =
                                qq.QuestionId,

                            Content =
                                qq.Question.Content,

                            QuestionType =
                                qq.Question
                                    .QuestionType,

                            QuestionOrder =
                                qq.QuestionOrder,

                            Points =
                                qq.Points,

                            AnswerCount =
                                qq.Question
                                    .Answers.Count,

                            IsOwnedQuestion =
                                qq.Question
                                    .QuestionBank
                                    .OwnerId
                                == userId
                        })
                    .FirstOrDefaultAsync();

            if (result == null)
            {
                throw new NotFoundException(
                    "Quiz Question was not found.");
            }

            return result;
        }

        private async Task<Quiz>
            GetOwnedQuizAsync(
                int quizId,
                string userId)
        {
            var quiz =
                await _context.Quizzes
                    .FirstOrDefaultAsync(q =>
                        q.QuizId == quizId);

            if (quiz == null)
            {
                throw new NotFoundException(
                    $"Quiz with ID {quizId} was not found.");
            }

            if (quiz.CreatorId != userId)
            {
                throw new ForbiddenException(
                    "You can only manage questions in your own Quiz.");
            }

            return quiz;
        }

        private async Task EnsureQuizOwnerAsync(
            int quizId,
            string userId)
        {
            _ = await GetOwnedQuizAsync(
                quizId,
                userId);
        }

        private async Task NormalizeOrderAsync(
            int quizId)
        {
            var questions =
                await _context.QuizQuestions
                    .Where(qq =>
                        qq.QuizId == quizId)
                    .OrderBy(qq =>
                        qq.QuestionOrder)
                    .ToListAsync();

            /*
             * Same unique-index issue as reordering:
             * temporarily move orders negative.
             */
            for (var i = 0;
                 i < questions.Count;
                 i++)
            {
                questions[i].QuestionOrder =
                    -(i + 1);
            }

            await _context.SaveChangesAsync();

            for (var i = 0;
                 i < questions.Count;
                 i++)
            {
                questions[i].QuestionOrder =
                    i + 1;
            }

            await _context.SaveChangesAsync();
        }
    }
}