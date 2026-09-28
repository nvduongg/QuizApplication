using backend.ViewModels.QuestionImports;
namespace backend.Exceptions;

public sealed class QuestionImportValidationException(IReadOnlyList<QuestionImportErrorVm> errors)
    : BadRequestException("No valid question rows were found. Nothing was imported.")
{
    public IReadOnlyList<QuestionImportErrorVm> Errors { get; } = errors;
}
