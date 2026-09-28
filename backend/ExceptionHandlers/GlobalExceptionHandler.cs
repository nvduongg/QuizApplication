using backend.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace backend.ExceptionHandlers
{
    public class GlobalExceptionHandler
        : IExceptionHandler
    {
        private readonly ILogger<GlobalExceptionHandler>
            _logger;

        public GlobalExceptionHandler(
            ILogger<GlobalExceptionHandler> logger)
        {
            _logger = logger;
        }

        public async ValueTask<bool> TryHandleAsync(
            HttpContext httpContext,
            Exception exception,
            CancellationToken cancellationToken)
        {
            var problemDetails =
                CreateProblemDetails(
                    httpContext,
                    exception);
            if (exception is QuestionImportValidationException importValidation)
                problemDetails.Extensions["errors"] = importValidation.Errors;

            if (problemDetails.Status >= 500)
            {
                _logger.LogError(
                    exception,
                    "Unhandled exception occurred. TraceId: {TraceId}",
                    httpContext.TraceIdentifier);
            }
            else
            {
                _logger.LogWarning(
                    "Request failed with status {Status}. " +
                    "Message: {Message}. TraceId: {TraceId}",
                    problemDetails.Status,
                    exception.Message,
                    httpContext.TraceIdentifier);
            }

            httpContext.Response.StatusCode =
                problemDetails.Status
                ?? StatusCodes.Status500InternalServerError;

            await httpContext.Response
                .WriteAsJsonAsync(
                    problemDetails,
                    cancellationToken);

            return true;
        }

        private static ProblemDetails CreateProblemDetails(
            HttpContext httpContext,
            Exception exception)
        {
            var (status, title, detail) =
                exception switch
                {
                    BadHttpRequestException { StatusCode: StatusCodes.Status413PayloadTooLarge } =>
                    (
                        StatusCodes.Status413PayloadTooLarge,
                        "Payload Too Large",
                        "The upload request is too large. The Excel file must not exceed 5 MB."
                    ),
                    BadRequestException =>
                    (
                        StatusCodes.Status400BadRequest,
                        "Bad Request",
                        exception.Message
                    ),

                    ForbiddenException =>
                    (
                        StatusCodes.Status403Forbidden,
                        "Forbidden",
                        exception.Message
                    ),

                    NotFoundException =>
                    (
                        StatusCodes.Status404NotFound,
                        "Not Found",
                        exception.Message
                    ),

                    ConflictException =>
                    (
                        StatusCodes.Status409Conflict,
                        "Conflict",
                        exception.Message
                    ),

                    _ =>
                    (
                        StatusCodes.Status500InternalServerError,
                        "Internal Server Error",
                        "An unexpected error occurred."
                    )
                };

            return new ProblemDetails
            {
                Status = status,
                Title = title,
                Detail = detail,
                Instance = httpContext.Request.Path,
                Extensions =
                {
                    ["traceId"] =
                        httpContext.TraceIdentifier
                }
            };
        }
    }
}
