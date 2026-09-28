using backend.Data;
using backend.Exceptions;
using backend.Services.Interfaces;
using backend.ViewModels.QuestionImports;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public sealed class QuestionImportService(AppDbContext context, QuestionImportWorkbook workbook) : IQuestionImportService
{
    public byte[] Template() => workbook.Template();

    public async Task<QuestionImportPreviewVm> PreviewAsync(int bankId, string userId, IFormFile? file, CancellationToken ct)
    {
        await EnsureOwner(bankId, userId, ct);
        return await workbook.ParseAsync(file, ct);
    }

    public async Task<QuestionImportResultVm> ImportAsync(int bankId, string userId, IFormFile? file, CancellationToken ct)
    {
        // Recheck ownership and reparse the upload. Preview is never an authorization or validation token.
        var preview = await PreviewAsync(bankId, userId, file, ct);
        if (!preview.CanImport)
            throw new QuestionImportValidationException(preview.Rows.SelectMany(r => r.Errors).ToList());

        var questions = preview.Rows.Where(r => r.IsValid)
            .Select(r => QuestionImportWorkbook.ToQuestion(r, bankId)).ToList();
        // One SaveChanges is atomic for every question + its answers; explicit transaction documents
        // that ALL valid rows succeed together. Unexpected database failures propagate as server errors.
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        context.Questions.AddRange(questions);
        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new(preview.TotalRows, questions.Count, preview.InvalidRows,
            questions.Select(q => q.QuestionId).ToList(), preview.Rows.SelectMany(r => r.Errors).ToList());
    }

    private async Task EnsureOwner(int bankId, string userId, CancellationToken ct)
    {
        // Same response for unknown and non-owned banks, irrespective of public visibility.
        if (!await context.QuestionBanks.AsNoTracking()
                .AnyAsync(b => b.QuestionBankId == bankId && b.OwnerId == userId, ct))
            throw new NotFoundException("Question Bank was not found or is not available for import.");
    }
}
