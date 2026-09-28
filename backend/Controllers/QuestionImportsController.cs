using System.Security.Claims;
using backend.Constants;
using backend.Exceptions;
using backend.Services.Implementations;
using backend.Services.Interfaces;
using backend.ViewModels.QuestionImports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Authorize(Roles = AppRoles.User)]
[Route("api/question-banks")]
public sealed class QuestionImportsController(IQuestionImportService imports) : ControllerBase
{
    [HttpGet("import-template")]
    [Produces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    public IActionResult Template() => File(imports.Template(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Quizizi-Question-Import-Template.xlsx");

    [HttpPost("{bankId:int}/import/preview")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(QuestionImportWorkbook.MaxRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = QuestionImportWorkbook.MaxRequestBytes)]
    public async Task<ActionResult<QuestionImportPreviewVm>> Preview(int bankId,
        [FromForm] QuestionImportUploadVm upload, CancellationToken ct) =>
        Ok(await imports.PreviewAsync(bankId, CurrentUser(), upload.File, ct));

    [HttpPost("{bankId:int}/import")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(QuestionImportWorkbook.MaxRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = QuestionImportWorkbook.MaxRequestBytes)]
    public async Task<ActionResult<QuestionImportResultVm>> Import(int bankId,
        [FromForm] QuestionImportUploadVm upload, CancellationToken ct) =>
        Ok(await imports.ImportAsync(bankId, CurrentUser(), upload.File, ct));

    private string CurrentUser() => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new ForbiddenException("Authenticated user ID is missing.");
}
