using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.IO.Compression;
using backend.Exceptions;
using backend.Services.Implementations;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Http;

var checks = new List<string>();
void Check(bool value, string name) { if (!value) throw new Exception("FAILED: " + name); checks.Add(name); }
var parser = new QuestionImportWorkbook();
byte[] template = parser.Template();
if (args.Length == 2 && args[0] == "--template")
{
    await System.IO.File.WriteAllBytesAsync(args[1], template);
    Console.WriteLine("Generated template saved for visual inspection.");
    return;
}
byte[] Edit(byte[] source, Action<IXLWorksheet> edit)
{
    using var input = new MemoryStream(source);
    using var book = new XLWorkbook(input);
    edit(book.Worksheet(1));
    using var output = new MemoryStream(); book.SaveAs(output); return output.ToArray();
}
IFormFile File(byte[] bytes, string name = "questions.xlsx") => new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name);
async Task Bad(byte[] bytes, string name, string fileName = "questions.xlsx")
{
    try { await parser.ParseAsync(File(bytes, fileName)); throw new Exception("Accepted " + name); }
    catch (BadRequestException) { checks.Add(name); }
}
using (var book = new XLWorkbook(new MemoryStream(template)))
{
    var sheet = book.Worksheet("Questions");
    Check(book.Worksheets.Count == 1 && sheet.Cell(1, 11).GetString() == "Correct", "Template worksheet and headers");
    Check(sheet.SheetView.SplitRow == 1 && sheet.Row(1).Style.Font.Bold, "Template frozen bold header");
    Check(sheet.DataValidations.Any(), "Template Type dropdown");
}
var preview = await parser.ParseAsync(File(template));
Check(preview.ValidRows == 3 && preview.InvalidRows == 0, "Generated template round trip: all three types");
var mixed = Edit(template, sheet =>
{
    sheet.Row(2).CopyTo(sheet.Row(5)); sheet.Cell(5, 11).Value = "A,C";
    sheet.Row(2).CopyTo(sheet.Row(6)); sheet.Cell(6, 11).Value = "H";
    sheet.Row(2).CopyTo(sheet.Row(7)); sheet.Cell(7, 2).Value = "Unknown";
    sheet.Row(2).CopyTo(sheet.Row(8)); sheet.Cell(8, 4).Clear(XLClearOptions.Contents);
    sheet.Row(10).Style.Fill.BackgroundColor = XLColor.White;
});
var mixedPreview = await parser.ParseAsync(File(mixed));
Check(mixedPreview.TotalRows == 7 && mixedPreview.ValidRows == 3 && mixedPreview.InvalidRows == 4, "Mixed workbook: 7/3/4 and formatted blank ignored");
Check(mixedPreview.Rows.Where(r => !r.IsValid).Select(r => r.RowNumber).SequenceEqual([5,6,7,8]), "Original Excel row numbers retained");
foreach (var code in new[] { "MULTIPLE_CORRECT_FOR_SINGLE_CHOICE", "INVALID_CORRECT_KEY", "INVALID_TYPE", "ANSWER_GAP" })
    Check(mixedPreview.Rows.SelectMany(r => r.Errors).Any(e => e.Code == code), code);
async Task RowError(string label, Action<IXLWorksheet> edit, string code)
{
    var p = await parser.ParseAsync(File(Edit(template, edit)));
    Check(p.Rows.SelectMany(r => r.Errors).Any(e => e.Code == code), label);
}
await RowError("Duplicate correct keys rejected", s => s.Cell(2,11).Value="A,A", "DUPLICATE_CORRECT_KEY");
await RowError("Unknown key rejected", s => s.Cell(2,11).Value="Z", "INVALID_CORRECT_KEY");
await RowError("Empty correct rejected", s => s.Cell(2,11).Value="", "NO_CORRECT_ANSWER");
await RowError("Whitespace question rejected", s => s.Cell(2,1).Value="  ", "QUESTION_REQUIRED");
await RowError("Whitespace answer rejected", s => s.Cell(2,3).Value="  ", "ANSWER_REQUIRED");
await RowError("Question length matches manual DTO", s => s.Cell(2,1).Value=new string('x',1001), "INVALID_QUESTION");
await RowError("Answer length matches manual DTO", s => s.Cell(2,3).Value=new string('x',501), "INVALID_ANSWER");
await RowError("Duplicate answers match manual rules", s => s.Cell(2,4).Value="get", "INVALID_QUESTION_STRUCTURE");
await RowError("Too few answers match publish rules", s => s.Range("D2:F2").Clear(XLClearOptions.Contents), "INVALID_QUESTION_STRUCTURE");
await RowError("Malformed TrueFalse rejected", s => s.Cell(4,3).Value="Yes", "INVALID_TRUE_FALSE");
await RowError("Numeric enum not accepted", s => s.Cell(2,2).Value="2", "INVALID_TYPE");
await RowError("Formula rejected without evaluation", s => s.Cell(2,1).FormulaA1="1/0", "FORMULA_NOT_ALLOWED");
var normalized = await parser.ParseAsync(File(Edit(template, s => { s.Cell(2,2).Value=" SINGLEchoice "; s.Cell(2,11).Value=" b "; s.Cell(3,11).Value=" a, c, d "; })));
Check(normalized.ValidRows == 3 && normalized.Rows[0].Type == "SingleChoice", "Case and whitespace normalization");
var eight = await parser.ParseAsync(File(Edit(template, s => { for(var i=3;i<=10;i++) s.Cell(3,i).Value="Option "+i; s.Cell(3,11).Value="A,H"; })));
Check(eight.Rows[1].IsValid && eight.Rows[1].Answers.Count == 8, "All A-H answers supported");
var duplicateText = await parser.ParseAsync(File(Edit(template,s=>s.Cell(3,1).Value=s.Cell(2,1).GetString())));
Check(duplicateText.ValidRows==3,"Duplicate question text remains allowed");
await Bad([], "Empty file rejected");
await Bad(template, "Wrong extension rejected", "file.csv");
await Bad([1,2,3], "Corrupt XLSX rejected");
await Bad(Edit(template,s=>s.Name="Other"), "Missing Questions sheet rejected");
await Bad(Edit(template,s=>s.Cell(1,1).Value="Other"), "Missing header rejected");
await Bad(Edit(template,s=>s.Cell(1,12).Value="Question"), "Duplicate required header rejected");
await Bad(new byte[QuestionImportWorkbook.MaxFileBytes+1], "Oversize file rejected");
await Bad(Edit(template,s=>{for(var r=5;r<=502;r++)s.Row(2).CopyTo(s.Row(r));}), "501 nonempty rows rejected");
var limit = await parser.ParseAsync(File(Edit(template,s=>{for(var r=5;r<=501;r++)s.Row(2).CopyTo(s.Row(r));})));
Check(limit.ValidRows==500,"500 rows accepted");
var blank = Edit(template,s=>s.Range("A2:K4").Clear(XLClearOptions.Contents));
Check(!(await parser.ParseAsync(File(blank))).CanImport,"Empty template cannot import");
var bomb = new MemoryStream();
using (var zip=new ZipArchive(bomb,ZipArchiveMode.Create,true)) { using var entry=zip.CreateEntry("large.xml").Open(); entry.Write(new byte[21*1024*1024]); }
await Bad(bomb.ToArray(), "Compressed expansion limit enforced");

if (args.Contains("--http"))
{
    if (Environment.GetEnvironmentVariable("QUIZIZI_LOCAL_INTEGRATION") != "1")
        throw new Exception("Verify the Development server uses the local development database, then set QUIZIZI_LOCAL_INTEGRATION=1.");
    using var http = new HttpClient { BaseAddress = new Uri("http://localhost:5226/"), Timeout = TimeSpan.FromSeconds(60) };
    async Task<JsonElement> Api(string method, string route, object? body, string? token, int expected=200)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), "api/"+route);
        if(token!=null) request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",token);
        if(body!=null) request.Content=JsonContent.Create(body);
        using var response=await http.SendAsync(request);
        var text=await response.Content.ReadAsStringAsync();
        Check((int)response.StatusCode==expected,$"{method} {route}: {expected} (actual {(int)response.StatusCode})");
        return text.Length>0?JsonDocument.Parse(text).RootElement.Clone():default;
    }
    async Task<string> Account(string label)
    {
        var email=$"quizizi.import.{label}.{Guid.NewGuid():N}@example.test";
        var password=$"Import!9aA{Guid.NewGuid():N}";
        await Api("POST","auth/register",new {email,password,fullName="Import verification "+label},null,201);
        return (await Api("POST","auth/login",new{email,password},null)).GetProperty("accessToken").GetString()!;
    }
    var owner=await Account("owner"); var other=await Account("other");
    using(var request=new HttpRequestMessage(HttpMethod.Get,"api/question-banks/import-template"))
    {
        request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",owner);
        using var response=await http.SendAsync(request);
        Check(response.IsSuccessStatusCode && response.Content.Headers.ContentType?.MediaType=="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","HTTP template download content type");
        template=await response.Content.ReadAsByteArrayAsync();
        Check((await parser.ParseAsync(File(template))).ValidRows==3,"Downloaded template parses");
        mixed=Edit(template,s=>{ s.Row(2).CopyTo(s.Row(5));s.Cell(5,11).Value="A,C";s.Row(2).CopyTo(s.Row(6));s.Cell(6,11).Value="H";s.Row(2).CopyTo(s.Row(7));s.Cell(7,2).Value="Unknown";s.Row(2).CopyTo(s.Row(8));s.Cell(8,4).Clear(XLClearOptions.Contents);s.Row(10).Style.Font.Bold=true; });
    }
    var name="Excel import verification "+Guid.NewGuid().ToString("N")[..8];
    var bank=await Api("POST","question-banks",new{name,visibility=1},owner,201);
    var id=bank.GetProperty("questionBankId").GetInt32();
    async Task<JsonElement> Upload(byte[] bytes,string suffix,string? token,int expected=200,string filename="questions.xlsx",int? bankId=null)
    {
        using var request=new HttpRequestMessage(HttpMethod.Post,$"api/question-banks/{bankId??id}/import{suffix}");
        request.Headers.ExpectContinue = true;
        if(token!=null) request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",token);
        using var form=new MultipartFormDataContent();
        form.Add(new ByteArrayContent(bytes),"file",filename); request.Content=form;
        using var response=await http.SendAsync(request);var text=await response.Content.ReadAsStringAsync();
        Check((int)response.StatusCode==expected,$"Upload {suffix} expected {expected}, actual {(int)response.StatusCode}");
        Check(!text.Contains("Exception")&&!text.Contains("stackTrace"),"Upload errors contain no internal exceptions");
        return text.Length>0?JsonDocument.Parse(text).RootElement.Clone():default;
    }
    await Upload(mixed,"/preview",null,401);await Upload(mixed,"",null,401);
    await Upload(mixed,"/preview",other,404);await Upload(mixed,"",other,404);
    await Upload(mixed,"/preview",owner,404,bankId:int.MaxValue);await Upload(mixed,"",owner,404,bankId:int.MaxValue);
    var before=await Api("GET",$"question-banks/{id}/questions",null,owner);
    var livePreview=await Upload(mixed,"/preview",owner);
    Check(livePreview.GetProperty("totalRows").GetInt32()==7 && livePreview.GetProperty("validRows").GetInt32()==3 && livePreview.GetProperty("invalidRows").GetInt32()==4,"HTTP preview counts 7/3/4");
    var after=await Api("GET",$"question-banks/{id}/questions",null,owner);
    Check(before.GetArrayLength()==0 && after.GetArrayLength()==0,"Preview has ZERO database question side effects");
    var result=await Upload(mixed,"",owner);
    Check(result.GetProperty("importedCount").GetInt32()==3&&result.GetProperty("skippedCount").GetInt32()==4,"HTTP partial import counts");
    Check(result.GetProperty("errors").EnumerateArray().Select(e=>e.GetProperty("rowNumber").GetInt32()).Distinct().SequenceEqual([5,6,7,8]),"HTTP skipped rows preserve Excel numbers");
    var ids=result.GetProperty("importedQuestionIds").EnumerateArray().Select(x=>x.GetInt32()).ToArray();
    var expectedCorrect=new[]{new[]{"POST"},new[]{"GET","PUT","DELETE"},new[]{"True"}};
    for(var i=0;i<ids.Length;i++)
    {
        var question=await Api("GET",$"questions/{ids[i]}",null,owner);
        Check(question.GetProperty("questionBankId").GetInt32()==id,"Imported question belongs to target bank");
        var answers=question.GetProperty("answers").EnumerateArray().ToArray();
        Check(answers.Length==(i==2?2:4),"All answers persisted atomically");
        Check(answers.Where(a=>a.GetProperty("isCorrect").GetBoolean()).Select(a=>a.GetProperty("content").GetString()).Order().SequenceEqual(expectedCorrect[i].Order()),"Correct keys persisted as IsCorrect");
    }
    await Upload(blank,"",owner,400);
    await Upload(Edit(template,s=>{s.Cell(2,2).Value="bad";s.Cell(3,2).Value="bad";s.Cell(4,2).Value="bad";}),"",owner,400);
    Check((await Api("GET",$"question-banks/{id}/questions",null,owner)).GetArrayLength()==3,"Zero-valid imports insert nothing");
    foreach(var suffix in new[]{"/preview",""})
    {
        await Upload([],suffix,owner,400);await Upload([1,2,3],suffix,owner,400);
        await Upload(template,suffix,owner,400,"wrong.csv");
        await Upload(Edit(template,s=>s.Name="Wrong"),suffix,owner,400);
        await Upload(Edit(template,s=>s.Cell(1,1).Value="Missing"),suffix,owner,400);
        await Upload(new byte[QuestionImportWorkbook.MaxFileBytes+1],suffix,owner,400);
        // MVC returns a safe 400 ValidationProblem when its form reader encounters the request cap.
        await Upload(new byte[6*1024*1024],suffix,owner,400);
        await Upload(Edit(template,s=>{for(var r=5;r<=502;r++)s.Row(2).CopyTo(s.Row(r));}),suffix,owner,400);
    }
    await Api("PUT",$"questions/{ids[0]}",new{content="Imported reusable HTTP question",questionType=2},owner);
    var privateSearch=await Api("GET","questions/search?search=Imported%20reusable%20HTTP",null,other);
    Check(!privateSearch.EnumerateArray().Any(q=>q.GetProperty("questionId").GetInt32()==ids[0]),"Private imported question not searchable by other user");
    await Api("PUT",$"question-banks/{id}",new{name,visibility=2},owner);
    await Upload(mixed,"/preview",other,404);await Upload(mixed,"",other,404);
    var publicSearch=await Api("GET","questions/search?search=Imported%20reusable%20HTTP",null,other);
    Check(publicSearch.EnumerateArray().Any(q=>q.GetProperty("questionId").GetInt32()==ids[0]),"Public imported question searchable for reuse");
    var quiz=await Api("POST","quizzes",new{title=name,duration=10},other,201);
    var quizId=quiz.GetProperty("quizId").GetInt32();
    await Api("POST",$"quizzes/{quizId}/questions",new{questionId=ids[0],points=2},other,201);
    await Api("PUT",$"quizzes/{quizId}/publish",new{},other);
    var attempt=await Api("POST","quiz-attempts",new{quizId},owner,201);
    var attemptText=attempt.GetRawText();
    Check(!attemptText.Contains("isCorrect")&&!attemptText.Contains("correctAnswerIds")&&!attemptText.Contains("outcome"),"Imported question participation has no correctness leak");
    var attemptId=attempt.GetProperty("quizAttemptId").GetInt32();
    await Api("GET",$"quiz-attempts/{attemptId}",null,owner);
    await Api("DELETE",$"questions/{ids[0]}",null,owner,409);
    await Api("DELETE",$"questions/{ids[2]}",null,owner,204);
    var openapi=await http.GetStringAsync("openapi/v1.json");
    Check(openapi.Contains("/api/question-banks/{bankId}/import/preview")&&openapi.Contains("multipart/form-data")&&openapi.Contains("Bearer"),"OpenAPI multipart import routes and Bearer remain available");
    var schema=JsonDocument.Parse(openapi).RootElement.GetProperty("components").GetProperty("schemas").GetProperty("IFormFile");
    Check(schema.GetProperty("type").GetString()=="string"&&schema.GetProperty("format").GetString()=="binary","OpenAPI advertises binary file picker");
    Console.WriteLine($"Retained local domain fixture: bank {id}, quiz {quizId}, active attempt {attemptId}; two synthetic users. No canonical data modified.");
}
Console.WriteLine($"PASS: {checks.Count} assertions");
foreach(var check in checks) Console.WriteLine("PASS "+check);
