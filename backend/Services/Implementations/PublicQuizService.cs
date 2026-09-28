using backend.Data;
using backend.Enums;
using backend.Exceptions;
using backend.Services.Interfaces;
using backend.ViewModels.PublicQuizzes;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations
{
    public class PublicQuizService : IPublicQuizService
    {
        private readonly AppDbContext _context;

        public PublicQuizService(
            AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<PublicQuizVm>> GetAllAsync(
            string? search)
        {
            var query = _context.Quizzes
                .AsNoTracking()
                .Where(q =>
                    q.Visibility == Visibility.Public);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var keyword = search.Trim();

                query = query.Where(q =>
                    q.Title.Contains(keyword) ||
                    (
                        q.Description != null &&
                        q.Description.Contains(keyword)
                    ));
            }

            return await query
                .OrderByDescending(q => q.CreatedAt)
                .Select(q => new PublicQuizVm
                {
                    QuizId = q.QuizId,

                    Title = q.Title,

                    Description = q.Description,

                    Duration = q.Duration,

                    CreatorName =
                        q.Creator.FullName,

                    QuestionCount =
                        q.QuizQuestions.Count,

                    TotalPoints =
                        q.QuizQuestions
                            .Sum(qq =>
                                (decimal?)qq.Points)
                        ?? 0,

                    CreatedAt = q.CreatedAt
                })
                .ToListAsync();
        }

        public async Task<PublicQuizDetailVm> GetByIdAsync(
            int id)
        {
            var quiz = await _context.Quizzes
                .AsNoTracking()
                .Where(q =>
                    q.QuizId == id &&
                    q.Visibility ==
                        Visibility.Public)
                .Select(q => new PublicQuizDetailVm
                {
                    QuizId = q.QuizId,

                    Title = q.Title,

                    Description = q.Description,

                    Duration = q.Duration,

                    CreatorName =
                        q.Creator.FullName,

                    QuestionCount =
                        q.QuizQuestions.Count,

                    TotalPoints =
                        q.QuizQuestions
                            .Sum(qq =>
                                (decimal?)qq.Points)
                        ?? 0,

                    CreatedAt = q.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (quiz == null)
            {
                throw new NotFoundException(
                    $"Public Quiz with ID {id} was not found.");
            }

            return quiz;
        }
    }
}