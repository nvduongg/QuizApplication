namespace backend.ViewModels.QuestionImports;

public sealed record QuestionImportErrorVm(int RowNumber, string Code, string Message);
public sealed record QuestionImportAnswerVm(string Key, string Content);
public sealed class QuestionImportPreviewRowVm
{
    public int RowNumber { get; init; }
    public string Question { get; init; } = "";
    public string Type { get; init; } = "";
    public List<QuestionImportAnswerVm> Answers { get; init; } = [];
    public List<string> CorrectAnswerKeys { get; init; } = [];
    public bool IsValid => Errors.Count == 0;
    public List<QuestionImportErrorVm> Errors { get; init; } = [];
}
public sealed class QuestionImportPreviewVm
{
    public string FileName { get; init; } = "";
    public List<QuestionImportPreviewRowVm> Rows { get; init; } = [];
    public int TotalRows => Rows.Count;
    public int ValidRows => Rows.Count(r => r.IsValid);
    public int InvalidRows => TotalRows - ValidRows;
    public bool CanImport => ValidRows > 0;
}
public sealed record QuestionImportResultVm(int TotalRows, int ImportedCount, int SkippedCount,
    IReadOnlyList<int> ImportedQuestionIds, IReadOnlyList<QuestionImportErrorVm> Errors);
public sealed class QuestionImportUploadVm
{
    public IFormFile? File { get; set; }
}
