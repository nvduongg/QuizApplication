using backend.Data;
using backend.Enums;
using backend.Exceptions;
using backend.Models;
using backend.Services.Interfaces;
using backend.ViewModels.QuestionBanks;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations
{
    public class QuestionBankService
        : IQuestionBankService
    {
        private readonly AppDbContext _context;

        public QuestionBankService(
            AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<QuestionBankVm>> GetMineAsync(
            string userId)
        {
            return await _context.QuestionBanks
                .AsNoTracking()
                .Where(qb => qb.OwnerId == userId)
                .OrderBy(qb => qb.Name)
                .Select(qb => new QuestionBankVm
                {
                    QuestionBankId = qb.QuestionBankId,
                    Name = qb.Name,
                    Description = qb.Description,
                    Visibility = qb.Visibility,
                    CreatedAt = qb.CreatedAt,
                    OwnerId = qb.OwnerId,
                    OwnerName = qb.Owner.FullName,
                    QuestionCount = qb.Questions.Count
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<QuestionBankVm>> GetPublicAsync(
            string? currentUserId)
        {
            return await _context.QuestionBanks
                .AsNoTracking()
                .Where(qb =>
                    qb.Visibility == Visibility.Public &&
                    qb.OwnerId != currentUserId)
                .OrderBy(qb => qb.Name)
                .Select(qb => new QuestionBankVm
                {
                    QuestionBankId = qb.QuestionBankId,
                    Name = qb.Name,
                    Description = qb.Description,
                    Visibility = qb.Visibility,
                    CreatedAt = qb.CreatedAt,
                    OwnerId = qb.OwnerId,
                    OwnerName = qb.Owner.FullName,
                    QuestionCount = qb.Questions.Count
                })
                .ToListAsync();
        }

        public async Task<QuestionBankVm> GetByIdAsync(
            int id,
            string? currentUserId)
        {
            var bank = await _context.QuestionBanks
                .AsNoTracking()
                .Where(qb => qb.QuestionBankId == id)
                .Select(qb => new
                {
                    qb.QuestionBankId,
                    qb.Name,
                    qb.Description,
                    qb.Visibility,
                    qb.CreatedAt,
                    qb.OwnerId,
                    OwnerName = qb.Owner.FullName,
                    QuestionCount = qb.Questions.Count
                })
                .FirstOrDefaultAsync();

            if (bank == null)
            {
                throw new NotFoundException(
                    $"Question Bank with ID {id} was not found.");
            }

            var canAccess =
                bank.OwnerId == currentUserId ||
                bank.Visibility == Visibility.Public;

            if (!canAccess)
            {
                throw new ForbiddenException(
                    "You do not have permission to access this Question Bank.");
            }

            return new QuestionBankVm
            {
                QuestionBankId = bank.QuestionBankId,
                Name = bank.Name,
                Description = bank.Description,
                Visibility = bank.Visibility,
                CreatedAt = bank.CreatedAt,
                OwnerId = bank.OwnerId,
                OwnerName = bank.OwnerName,
                QuestionCount = bank.QuestionCount
            };
        }

        public async Task<QuestionBankVm> CreateAsync(
            string userId,
            CreateQuestionBankVm model)
        {
            if (string.IsNullOrWhiteSpace(model.Name))
            {
                throw new BadRequestException(
                    "Question Bank name cannot be empty.");
            }

            var normalizedName = model.Name.Trim();

            var duplicateExists =
                await _context.QuestionBanks
                    .AnyAsync(qb =>
                        qb.OwnerId == userId &&
                        qb.Name == normalizedName);

            if (duplicateExists)
            {
                throw new BadRequestException(
                    "You already have a Question Bank with this name.");
            }

            var bank = new QuestionBank
            {
                OwnerId = userId,
                Name = normalizedName,
                Description =
                    string.IsNullOrWhiteSpace(model.Description)
                        ? null
                        : model.Description.Trim(),
                Visibility = model.Visibility,
                CreatedAt = DateTime.UtcNow
            };

            _context.QuestionBanks.Add(bank);

            await _context.SaveChangesAsync();

            return await GetByIdAsync(
                bank.QuestionBankId,
                userId);
        }

        public async Task<QuestionBankVm> UpdateAsync(
            int id,
            string userId,
            UpdateQuestionBankVm model)
        {
            var bank =
                await _context.QuestionBanks
                    .FirstOrDefaultAsync(
                        qb => qb.QuestionBankId == id);

            if (bank == null)
            {
                throw new NotFoundException(
                    $"Question Bank with ID {id} was not found.");
            }

            if (bank.OwnerId != userId)
            {
                throw new ForbiddenException(
                    "You can only modify your own Question Banks.");
            }

            if (string.IsNullOrWhiteSpace(model.Name))
            {
                throw new BadRequestException(
                    "Question Bank name cannot be empty.");
            }

            var normalizedName = model.Name.Trim();

            var duplicateExists =
                await _context.QuestionBanks
                    .AnyAsync(qb =>
                        qb.OwnerId == userId &&
                        qb.QuestionBankId != id &&
                        qb.Name == normalizedName);

            if (duplicateExists)
            {
                throw new BadRequestException(
                    "You already have another Question Bank with this name.");
            }

            bank.Name = normalizedName;

            bank.Description =
                string.IsNullOrWhiteSpace(model.Description)
                    ? null
                    : model.Description.Trim();

            bank.Visibility = model.Visibility;

            await _context.SaveChangesAsync();

            return await GetByIdAsync(
                bank.QuestionBankId,
                userId);
        }

        public async Task DeleteAsync(
            int id,
            string userId)
        {
            var bank =
                await _context.QuestionBanks
                    .FirstOrDefaultAsync(
                        qb => qb.QuestionBankId == id);

            if (bank == null)
            {
                throw new NotFoundException(
                    $"Question Bank with ID {id} was not found.");
            }

            if (bank.OwnerId != userId)
            {
                throw new ForbiddenException(
                    "You can only delete your own Question Banks.");
            }

            var questionIds = await _context.Questions
                .Where(q => q.QuestionBankId == id)
                .Select(q => q.QuestionId)
                .ToListAsync();

            var isReferenced = await _context.QuizQuestions
                .AnyAsync(qq => questionIds.Contains(qq.QuestionId)) ||
                await _context.AttemptAnswers
                    .AnyAsync(aa => questionIds.Contains(aa.QuestionId));

            if (isReferenced)
            {
                throw new ConflictException(
                    "The Question Bank contains questions used by quiz content or historical attempts and cannot be deleted.");
            }

            var questions = await _context.Questions
                .Where(q => q.QuestionBankId == id)
                .ToListAsync();

            await using var transaction = await _context.Database.BeginTransactionAsync();
            _context.Questions.RemoveRange(questions);
            _context.QuestionBanks.Remove(bank);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
    }
}