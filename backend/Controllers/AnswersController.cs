using backend.Constants;
using backend.Exceptions;
using backend.Services.Interfaces;
using backend.ViewModels.Answers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace backend.Controllers
{
    [ApiController]
    [Authorize(Roles = AppRoles.User)]
    public class AnswersController : ControllerBase
    {
        private readonly IAnswerService _answerService;

        public AnswersController(
            IAnswerService answerService)
        {
            _answerService = answerService;
        }

        [HttpGet(
            "api/questions/{questionId:int}/answers")]
        public async Task<IActionResult> GetByQuestion(
            int questionId)
        {
            var result =
                await _answerService.GetByQuestionAsync(
                    questionId,
                    GetCurrentUserId());

            return Ok(result);
        }

        [HttpPost(
            "api/questions/{questionId:int}/answers")]
        public async Task<IActionResult> Create(
            int questionId,
            CreateAnswerVm model)
        {
            var result =
                await _answerService.CreateAsync(
                    questionId,
                    GetCurrentUserId(),
                    model);

            return StatusCode(
                StatusCodes.Status201Created,
                result);
        }

        [HttpPut("api/answers/{id:int}")]
        public async Task<IActionResult> Update(
            int id,
            UpdateAnswerVm model)
        {
            var result =
                await _answerService.UpdateAsync(
                    id,
                    GetCurrentUserId(),
                    model);

            return Ok(result);
        }

        [HttpDelete("api/answers/{id:int}")]
        public async Task<IActionResult> Delete(
            int id)
        {
            await _answerService.DeleteAsync(
                id,
                GetCurrentUserId());

            return NoContent();
        }

        private string GetCurrentUserId()
        {
            return User.FindFirstValue(
                       ClaimTypes.NameIdentifier)
                   ?? throw new ForbiddenException(
                       "Authenticated user ID is missing.");
        }
    }
}