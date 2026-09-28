using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.IO.Compression;
using System.Xml;
using backend.Enums;
using backend.Exceptions;
using backend.Models;
using backend.Validation;
using backend.ViewModels.Answers;
using backend.ViewModels.QuestionImports;
using backend.ViewModels.Questions;
using ClosedXML.Excel;
using DocumentFormat.OpenXml.Packaging;

namespace backend.Services.Implementations;

/// <summary>Stateless, bounded XLSX format handling. No database writes or formula evaluation.</summary>
public sealed class QuestionImportWorkbook
{
    public const int MaxRows = 500;
    public const long MaxFileBytes = 5 * 1024 * 1024;
    public const long MaxRequestBytes = MaxFileBytes + 64 * 1024;
    private const long MaxExpandedBytes = 20 * 1024 * 1024;
    private const int MaxCells = 20000;
    public static readonly IReadOnlyList<string> Headers = Array.AsReadOnly(new[]
    { "Question", "Type", "Answer A", "Answer B", "Answer C", "Answer D", "Answer E", "Answer F", "Answer G", "Answer H", "Correct" });
    private static readonly Dictionary<string, QuestionType> Types = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SingleChoice"] = QuestionType.SingleChoice,
        ["MultipleChoice"] = QuestionType.MultipleChoice,
        ["TrueFalse"] = QuestionType.TrueFalse
    };

    public byte[] Template()
    {
        using var book = new XLWorkbook();
        var sheet = book.AddWorksheet("Questions");
        for (var i = 0; i < Headers.Count; i++) sheet.Cell(1, i + 1).Value = Headers[i];
        string[][] examples =
        [
            ["Which HTTP method is normally used to create a resource?", "SingleChoice", "GET", "POST", "PUT", "DELETE", "", "", "", "", "B"],
            ["Which HTTP methods are commonly considered idempotent?", "MultipleChoice", "GET", "POST", "PUT", "DELETE", "", "", "", "", "A,C,D"],
            ["HTTP is a stateless protocol.", "TrueFalse", "True", "False", "", "", "", "", "", "", "A"]
        ];
        for (var r = 0; r < examples.Length; r++)
            for (var c = 0; c < Headers.Count; c++)
                if (examples[r][c].Length > 0) sheet.Cell(r + 2, c + 1).Value = examples[r][c];
        sheet.Row(1).Style.Font.Bold = true;
        sheet.Row(1).Height = 24;
        sheet.SheetView.FreezeRows(1);
        sheet.Column(1).Width = 60;
        sheet.Column(2).Width = 20;
        sheet.Columns(3, 10).Width = 18;
        sheet.Column(11).Width = 18;
        sheet.Range(2, 1, MaxRows + 1, 11).Style.Alignment.WrapText = true;
        sheet.Rows(2, 4).Height = 45;
        var validation = sheet.Range(2, 2, MaxRows + 1, 2).CreateDataValidation();
        validation.List("\"SingleChoice,MultipleChoice,TrueFalse\"", true);
        validation.ErrorTitle = "Choose a question type";
        validation.ErrorMessage = "Use SingleChoice, MultipleChoice or TrueFalse.";
        validation.ShowErrorMessage = true;
        var note = sheet.Cell(1, 1).CreateComment();
        note.AddText("Replace the three examples before importing. Maximum 500 questions. Keep answers contiguous from A. Correct uses keys such as B or A,C,D. Preview first; valid rows import and invalid rows are skipped. Uploading again creates new questions.");
        using var output = new MemoryStream();
        book.SaveAs(output);
        return output.ToArray();
    }

    public async Task<QuestionImportPreviewVm> ParseAsync(IFormFile? file, CancellationToken ct = default)
    {
        if (file is null || file.Length == 0) throw new BadRequestException("Select a non-empty .xlsx file.");
        if (!Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
            throw new BadRequestException("Only .xlsx files are supported.");
        if (file.Length > MaxFileBytes) throw new BadRequestException("The file must not exceed 5 MB.");
        using var data = new MemoryStream();
        await using (var input = file.OpenReadStream())
        {
            var buffer = new byte[81920];
            int read;
            while ((read = await input.ReadAsync(buffer, ct)) > 0)
            {
                if (data.Length + read > MaxFileBytes) throw new BadRequestException("The file must not exceed 5 MB.");
                await data.WriteAsync(buffer.AsMemory(0, read), ct);
            }
        }
        data.Position = 0;
        Preflight(data, ct);
        data.Position = 0;
        using var book = Open(data);
        if (!book.TryGetWorksheet("Questions", out var sheet))
            throw new BadRequestException("The workbook must contain a Questions worksheet.");
        if (book.Worksheets.Count != 1)
            throw new BadRequestException("Use one worksheet named Questions.");
        var columns = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var cell in sheet.Row(1).CellsUsed(XLCellsUsedOptions.Contents))
        {
            if (cell.HasFormula) throw new BadRequestException("Header cells must not contain formulas.");
            var name = Text(cell).Trim();
            if (!Headers.Contains(name, StringComparer.OrdinalIgnoreCase)) continue;
            if (!columns.TryAdd(name, cell.Address.ColumnNumber))
                throw new BadRequestException($"Duplicate required column: {name}.");
        }
        var missing = Headers.Where(h => !columns.ContainsKey(h)).ToArray();
        if (missing.Length > 0) throw new BadRequestException("Missing required columns: " + string.Join(", ", missing) + ".");

        var rows = new List<QuestionImportPreviewRowVm>();
        foreach (var row in sheet.RowsUsed(XLCellsUsedOptions.Contents).Where(r => r.RowNumber() > 1))
        {
            ct.ThrowIfCancellationRequested();
            var cells = Headers.Select(h => row.Cell(columns[h])).ToArray();
            // Formatting alone is not data. Whitespace-only supplied cells are still validated.
            if (cells.All(c => !c.HasFormula && Text(c).Length == 0)) continue;
            if (rows.Count == MaxRows) throw new BadRequestException($"A file can contain at most {MaxRows} non-empty question rows.");
            var values = cells.Select(c => c.HasFormula ? "" : Text(c)).ToArray();
            var result = ValidateRow(row.RowNumber(), values);
            for (var c = 0; c < cells.Length; c++)
            {
                if (cells[c].HasFormula)
                    result.Errors.Add(new(row.RowNumber(), "FORMULA_NOT_ALLOWED", $"{Headers[c]} contains a formula. Replace it with a plain value."));
                else if (cells[c].DataType == XLDataType.Error)
                    result.Errors.Add(new(row.RowNumber(), "INVALID_CELL_VALUE", $"{Headers[c]} contains an Excel error. Replace it with a plain value."));
            }
            rows.Add(result);
        }
        return new() { FileName = Path.GetFileName(file.FileName.Replace('\\', '/')), Rows = rows };
    }

    private static string Text(IXLCell cell) => cell.HasFormula ? "" : cell.Value.ToString(CultureInfo.InvariantCulture);

    private static QuestionImportPreviewRowVm ValidateRow(int number, string[] values)
    {
        var errors = new List<QuestionImportErrorVm>();
        void Error(string code, string message) => errors.Add(new(number, code, message));
        var typeKnown = Types.TryGetValue(values[1].Trim(), out var type);
        var answers = new List<QuestionImportAnswerVm>();
        var gap = false;
        for (var i = 0; i < 8; i++)
        {
            var raw = values[i + 2];
            var key = ((char)('A' + i)).ToString();
            if (raw.Length > 0 && string.IsNullOrWhiteSpace(raw)) Error("ANSWER_REQUIRED", $"Answer {key} contains only whitespace.");
            if (string.IsNullOrWhiteSpace(raw)) { gap = true; continue; }
            if (gap) Error("ANSWER_GAP", $"Answer {key} has an empty answer before it. Fill answers consecutively from A.");
            answers.Add(new(key, raw.Trim()));
            ValidateDto(new CreateAnswerVm { Content = raw }, "INVALID_ANSWER", Error);
        }
        var keys = values[10].Trim().Length == 0 ? [] : values[10].Split(',').Select(k => k.Trim().ToUpperInvariant()).ToList();
        if (keys.Count == 0) Error("NO_CORRECT_ANSWER", "Correct must contain at least one answer key.");
        foreach (var key in keys.Distinct())
        {
            if (key.Length != 1 || key[0] < 'A' || key[0] > 'H') Error("INVALID_CORRECT_KEY", $"Correct answer key '{key}' is not A–H.");
            else if (!answers.Any(a => a.Key == key)) Error("INVALID_CORRECT_KEY", $"Correct answer '{key}' references an empty answer.");
            if (keys.Count(k => k == key) > 1) Error("DUPLICATE_CORRECT_KEY", $"Correct answer '{key}' is repeated.");
        }
        if (string.IsNullOrWhiteSpace(values[0])) Error("QUESTION_REQUIRED", "Question is required.");
        if (!typeKnown) Error("INVALID_TYPE", "Type must be SingleChoice, MultipleChoice or TrueFalse.");
        if (typeKnown)
        {
            ValidateDto(new CreateQuestionVm { Content = values[0], QuestionType = type }, "INVALID_QUESTION", Error);
            if (type == QuestionType.SingleChoice && keys.Count > 1)
                Error("MULTIPLE_CORRECT_FOR_SINGLE_CHOICE", "SingleChoice requires exactly one correct answer key.");
            if (type == QuestionType.TrueFalse && (answers.Count != 2 ||
                !answers[0].Content.Equals("True", StringComparison.OrdinalIgnoreCase) ||
                !answers[1].Content.Equals("False", StringComparison.OrdinalIgnoreCase) || keys.Count != 1))
                Error("INVALID_TRUE_FALSE", "TrueFalse requires Answer A = True, Answer B = False, no other answers, and Correct = A or B.");
            // The completed question must meet the same answer and publish-readiness rules as manual content.
            var question = new Question { Content = values[0].Trim(), QuestionType = type };
            try
            {
                QuestionRules.ValidateQuestion(values[0], type);
                foreach (var answer in answers)
                {
                    var correct = keys.Contains(answer.Key);
                    QuestionRules.ValidateContent(answer.Content);
                    QuestionRules.ValidateNewAnswer(question, answer.Content, correct);
                    question.Answers.Add(new Answer { Content = answer.Content, IsCorrect = correct });
                }
                QuestionRules.ValidateQuestionForPublishing(question);
            }
            catch (BadRequestException e) { Error("INVALID_QUESTION_STRUCTURE", e.Message.Replace("question 0", "question").Replace("Question 0", "Question")); }
        }
        if (typeKnown && type == QuestionType.TrueFalse)
            answers = answers.Select(a => a with { Content = a.Content.Equals("True", StringComparison.OrdinalIgnoreCase) ? "True" : a.Content.Equals("False", StringComparison.OrdinalIgnoreCase) ? "False" : a.Content }).ToList();
        return new() { RowNumber = number, Question = values[0].Trim(), Type = typeKnown ? type.ToString() : values[1].Trim(), Answers = answers, CorrectAnswerKeys = keys, Errors = errors };
    }

    private static void ValidateDto(object value, string code, Action<string, string> error)
    {
        var errors = new List<ValidationResult>();
        Validator.TryValidateObject(value, new ValidationContext(value), errors, true);
        foreach (var item in errors) error(code, item.ErrorMessage ?? "Invalid content.");
    }

    internal static Question ToQuestion(QuestionImportPreviewRowVm row, int bankId) => new()
    {
        QuestionBankId = bankId,
        Content = row.Question,
        QuestionType = Types[row.Type],
        CreatedAt = DateTime.UtcNow,
        Answers = row.Answers.Select(a => new Answer { Content = a.Content, IsCorrect = row.CorrectAnswerKeys.Contains(a.Key) }).ToList()
    };

    private static XLWorkbook Open(Stream data)
    {
        try { return new XLWorkbook(data); }
        catch (Exception e) when (e is InvalidDataException or XmlException or OpenXmlPackageException or FormatException or ArgumentException)
        { throw new BadRequestException("The file is not a readable .xlsx workbook. Save it as a new Excel workbook and try again."); }
    }

    private static void Preflight(Stream data, CancellationToken ct)
    {
        try
        {
            using var zip = new ZipArchive(data, ZipArchiveMode.Read, true);
            if (zip.Entries.Count > 256 || zip.Entries.Sum(e => e.Length) > MaxExpandedBytes)
                throw new BadRequestException("The workbook is too complex or expands beyond the 20 MB limit.");
            if (zip.GetEntry("[Content_Types].xml") is null || zip.GetEntry("xl/workbook.xml") is null)
                throw new BadRequestException("The file is not an .xlsx workbook.");
            var cells = 0;
            foreach (var entry in zip.Entries)
            {
                ct.ThrowIfCancellationRequested();
                if (entry.FullName.EndsWith("vbaProject.bin", StringComparison.OrdinalIgnoreCase))
                    throw new BadRequestException("Macro-enabled workbooks are not supported.");
                if (!entry.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase) && !entry.FullName.EndsWith(".rels", StringComparison.OrdinalIgnoreCase)) continue;
                using var stream = entry.Open();
                using var reader = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = MaxExpandedBytes });
                while (reader.Read())
                {
                    if (reader.NodeType != XmlNodeType.Element) continue;
                    if (reader.LocalName == "Override" && reader.GetAttribute("ContentType")?.Contains("macroEnabled", StringComparison.OrdinalIgnoreCase) == true)
                        throw new BadRequestException("Macro-enabled workbooks are not supported.");
                    if (entry.FullName.StartsWith("xl/worksheets/", StringComparison.Ordinal) && reader.LocalName == "c" && ++cells > MaxCells)
                        throw new BadRequestException("The workbook contains too many cells. Use the import template with at most 500 questions.");
                }
            }
        }
        catch (Exception e) when (e is InvalidDataException or XmlException)
        { throw new BadRequestException("The file is corrupt or is not a supported .xlsx workbook."); }
    }
}
