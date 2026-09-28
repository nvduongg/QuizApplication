using backend.Constants;
using backend.Exceptions;
using backend.Services.Interfaces;
using backend.ViewModels.Questions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace backend.Controllers
{
    [ApiController]
    [Authorize(Roles = AppRoles.User)]
    public class QuestionsController : ControllerBase
    {
        private readonly IQuestionService _questionService;

        public QuestionsController(
            IQuestionService questionService)
        {
            _questionService = questionService;
        }

        [HttpGet(
            "api/question-banks/{bankId:int}/questions")]
        public async Task<IActionResult> GetByBank(
            int bankId)
        {
            var result =
                await _questionService.GetByBankAsync(
                    bankId,
                    GetCurrentUserId());

            return Ok(result);
        }

        [HttpGet("api/questions/search")]
        public async Task<IActionResult> Search([FromQuery] string search)
        {
            return Ok(await _questionService.SearchAccessibleAsync(
                GetCurrentUserId(), search));
        }

        [HttpGet("api/questions/{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var result =
                await _questionService.GetByIdAsync(
                    id,
                    GetCurrentUserId());

            return Ok(result);
        }

        [HttpPost(
            "api/question-banks/{bankId:int}/questions")]
        public async Task<IActionResult> Create(
            int bankId,
            CreateQuestionVm model)
        {
            var result =
                await _questionService.CreateAsync(
                    bankId,
                    GetCurrentUserId(),
                    model);

            return StatusCode(
                StatusCodes.Status201Created,
                result);
        }

        [HttpPut("api/questions/{id:int}")]
        public async Task<IActionResult> Update(
            int id,
            UpdateQuestionVm model)
        {
            var result =
                await _questionService.UpdateAsync(
                    id,
                    GetCurrentUserId(),
                    model);

            return Ok(result);
        }

        [HttpDelete("api/questions/{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _questionService.DeleteAsync(
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