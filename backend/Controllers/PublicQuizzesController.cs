using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/public/quizzes")]
    [AllowAnonymous]
    public class PublicQuizzesController
        : ControllerBase
    {
        private readonly IPublicQuizService
            _publicQuizService;

        public PublicQuizzesController(
            IPublicQuizService publicQuizService)
        {
            _publicQuizService =
                publicQuizService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? search = null)
        {
            var result =
                await _publicQuizService
                    .GetAllAsync(search);

            return Ok(result);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(
            int id)
        {
            var result =
                await _publicQuizService
                    .GetByIdAsync(id);

            return Ok(result);
        }
    }
}