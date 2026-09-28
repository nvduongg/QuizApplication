using backend.ViewModels.QuestionImports;
namespace backend.Services.Interfaces;

public interface IQuestionImportService
{
    byte[] Template();
    Task<QuestionImportPreviewVm> PreviewAsync(int bankId, string userId, IFormFile? file, CancellationToken ct);
    Task<QuestionImportResultVm> ImportAsync(int bankId, string userId, IFormFile? file, CancellationToken ct);
}
