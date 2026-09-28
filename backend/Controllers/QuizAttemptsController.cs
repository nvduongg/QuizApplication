using backend.Constants;
using backend.Exceptions;
using backend.Services.Interfaces;
using backend.ViewModels.QuizAttempts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/quiz-attempts")]
    [Authorize(Roles = AppRoles.User)]
    public class QuizAttemptsController : ControllerBase
    {
        private readonly IQuizAttemptService _service;

        public QuizAttemptsController(IQuizAttemptService service)
        {
            _service = service;
        }

        [HttpPost]
        public async Task<IActionResult> Start(StartQuizAttemptVm model)
        {
            return StatusCode(StatusCodes.Status201Created,
                await _service.StartAsync(GetCurrentUserId(), model.QuizId));
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            return Ok(await _service.GetAsync(GetCurrentUserId(), id));
        }

        [HttpGet("{id:int}/result")]
        public async Task<IActionResult> GetResult(int id)
        {
            return Ok(await _service.GetResultAsync(GetCurrentUserId(), id));
        }

        [HttpGet("mine")]
        public async Task<IActionResult> GetHistory(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            return Ok(await _service.GetHistoryAsync(
                GetCurrentUserId(), page, pageSize));
        }

        [HttpPost("{id:int}/submit")]
        public async Task<IActionResult> Submit(int id, SubmitQuizAttemptVm model)
        {
            return Ok(await _service.SubmitAsync(GetCurrentUserId(), id, model));
        }

        private string GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? throw new ForbiddenException("Authenticated user ID is missing.");
        }
    }
}
