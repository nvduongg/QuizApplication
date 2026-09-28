using backend.Constants;
using backend.Exceptions;
using backend.Services.Interfaces;
using backend.ViewModels.Quizzes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/quizzes")]
    [Authorize(Roles = AppRoles.User)]
    public class QuizzesController : ControllerBase
    {
        private readonly IQuizService _quizService;

        public QuizzesController(
            IQuizService quizService)
        {
            _quizService = quizService;
        }

        [HttpGet("mine")]
        public async Task<IActionResult> GetMine()
        {
            var result =
                await _quizService.GetMineAsync(
                    GetCurrentUserId());

            return Ok(result);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(
            int id)
        {
            var result =
                await _quizService.GetByIdAsync(
                    id,
                    GetCurrentUserId());

            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create(
            CreateQuizVm model)
        {
            var result =
                await _quizService.CreateAsync(
                    GetCurrentUserId(),
                    model);

            return StatusCode(
                StatusCodes.Status201Created,
                result);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, UpdateQuizVm model)
        {
            var result =
                await _quizService.UpdateAsync(
                    id,
                    GetCurrentUserId(),
                    model);

            return Ok(result);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _quizService.DeleteAsync(
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

        [HttpPut("{id:int}/publish")]
        public async Task<IActionResult> Publish(int id)
        {
            var result =
                await _quizService.PublishAsync(
                    id,
                    GetCurrentUserId());

            return Ok(result);
        }

        [HttpPut("{id:int}/unpublish")]
        public async Task<IActionResult> Unpublish(int id)
        {
            var result =
                await _quizService.UnpublishAsync(
                    id,
                    GetCurrentUserId());

            return Ok(result);
        }
    }
}