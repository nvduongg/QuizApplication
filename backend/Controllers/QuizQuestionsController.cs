using backend.Constants;
using backend.Exceptions;
using backend.Services.Interfaces;
using backend.ViewModels.QuizQuestions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/quizzes/{quizId:int}/questions")]
    [Authorize(Roles = AppRoles.User)]
    public class QuizQuestionsController
        : ControllerBase
    {
        private readonly IQuizQuestionService
            _quizQuestionService;

        public QuizQuestionsController(
            IQuizQuestionService quizQuestionService)
        {
            _quizQuestionService =
                quizQuestionService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(
            int quizId)
        {
            var result =
                await _quizQuestionService
                    .GetAllAsync(
                        quizId,
                        GetCurrentUserId());

            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Add(
            int quizId,
            AddQuizQuestionVm model)
        {
            var result =
                await _quizQuestionService
                    .AddAsync(
                        quizId,
                        GetCurrentUserId(),
                        model);

            return StatusCode(
                StatusCodes.Status201Created,
                result);
        }

        [HttpPut("{questionId:int}/points")]
        public async Task<IActionResult> UpdatePoints(
            int quizId,
            int questionId,
            UpdateQuizQuestionPointsVm model)
        {
            var result =
                await _quizQuestionService
                    .UpdatePointsAsync(
                        quizId,
                        questionId,
                        GetCurrentUserId(),
                        model);

            return Ok(result);
        }

        [HttpPut("order")]
        public async Task<IActionResult> Reorder(
            int quizId,
            ReorderQuizQuestionsVm model)
        {
            await _quizQuestionService
                .ReorderAsync(
                    quizId,
                    GetCurrentUserId(),
                    model);

            return NoContent();
        }

        [HttpDelete("{questionId:int}")]
        public async Task<IActionResult> Remove(
            int quizId,
            int questionId)
        {
            await _quizQuestionService
                .RemoveAsync(
                    quizId,
                    questionId,
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