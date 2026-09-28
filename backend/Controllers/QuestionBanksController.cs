using backend.Constants;
using backend.Exceptions;
using backend.Services.Interfaces;
using backend.ViewModels.QuestionBanks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/question-banks")]
    public class QuestionBanksController : ControllerBase
    {
        private readonly IQuestionBankService
            _questionBankService;

        public QuestionBanksController(
            IQuestionBankService questionBankService)
        {
            _questionBankService = questionBankService;
        }

        [Authorize(Roles = AppRoles.User)]
        [HttpGet("mine")]
        public async Task<IActionResult> GetMine()
        {
            var userId = GetCurrentUserId();

            var result =
                await _questionBankService
                    .GetMineAsync(userId);

            return Ok(result);
        }

        [Authorize]
        [HttpGet("public")]
        public async Task<IActionResult> GetPublic()
        {
            var userId =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier);

            var result =
                await _questionBankService
                    .GetPublicAsync(userId);

            return Ok(result);
        }

        [Authorize]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(
            int id)
        {
            var userId =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier);

            var result =
                await _questionBankService
                    .GetByIdAsync(
                        id,
                        userId);

            return Ok(result);
        }

        [Authorize(Roles = AppRoles.User)]
        [HttpPost]
        public async Task<IActionResult> Create(
            CreateQuestionBankVm model)
        {
            var userId = GetCurrentUserId();

            var result =
                await _questionBankService
                    .CreateAsync(
                        userId,
                        model);

            return StatusCode(
                StatusCodes.Status201Created,
                result);
        }

        [Authorize(Roles = AppRoles.User)]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(
            int id,
            UpdateQuestionBankVm model)
        {
            var userId = GetCurrentUserId();

            var result =
                await _questionBankService
                    .UpdateAsync(
                        id,
                        userId,
                        model);

            return Ok(result);
        }

        [Authorize(Roles = AppRoles.User)]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(
            int id)
        {
            var userId = GetCurrentUserId();

            await _questionBankService
                .DeleteAsync(
                    id,
                    userId);

            return NoContent();
        }

        private string GetCurrentUserId()
        {
            var userId =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ForbiddenException(
                    "Authenticated user ID is missing.");
            }

            return userId;
        }
    }
}