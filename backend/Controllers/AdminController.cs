using backend.Constants;
using backend.Data;
using backend.Enums;
using backend.Exceptions;
using backend.Models;
using backend.ViewModels.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/admin")]
    [Authorize(Roles = AppRoles.Administrator)]
    public class AdminController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly AppDbContext _context;

        public AdminController(UserManager<ApplicationUser> userManager, AppDbContext context)
        {
            _userManager = userManager;
            _context = context;
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _userManager.Users
                .AsNoTracking()
                .OrderBy(u => u.Email)
                .ToListAsync();

            // Load role memberships once rather than making one query per user.
            var memberships = await _context.UserRoles.AsNoTracking()
                .Join(_context.Roles.AsNoTracking(), membership => membership.RoleId,
                    role => role.Id, (membership, role) => new { membership.UserId, role.Name })
                .ToListAsync();
            var rolesByUser = memberships.ToLookup(membership => membership.UserId,
                membership => membership.Name!);
            var result = users.Select(user => MapUser(user, rolesByUser[user.Id].ToList())).ToList();

            return Ok(result);
        }

        [HttpGet("users/{id}")]
        public async Task<IActionResult> GetUser(string id)
        {
            var user = await _userManager.FindByIdAsync(id)
                ?? throw new NotFoundException("User was not found.");
            return Ok(await MapUserAsync(user));
        }

        [HttpPut("users/{id}/status")]
        public async Task<IActionResult> SetUserStatus(string id, SetUserStatusVm model)
        {
            var user = await _userManager.FindByIdAsync(id)
                ?? throw new NotFoundException("User was not found.");

            user.LockoutEnabled = true;
            user.LockoutEnd = model.Blocked ? DateTimeOffset.MaxValue : null;
            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                throw new BadRequestException(string.Join("; ", result.Errors.Select(e => e.Description)));
            }

            return Ok(await MapUserAsync(user));
        }

        [HttpGet("quizzes")]
        public async Task<IActionResult> GetQuizzes()
        {
            return Ok(await _context.Quizzes
                .AsNoTracking()
                .OrderByDescending(q => q.CreatedAt)
                .Select(q => new AdminQuizVm
                {
                    QuizId = q.QuizId,
                    Title = q.Title,
                    CreatorId = q.CreatorId,
                    Visibility = q.Visibility,
                    QuestionCount = q.QuizQuestions.Count,
                    AttemptCount = q.QuizAttempts.Count
                })
                .ToListAsync());
        }

        [HttpPut("quizzes/{id:int}/disable")]
        public async Task<IActionResult> DisableQuiz(int id)
        {
            var quiz = await _context.Quizzes.FirstOrDefaultAsync(q => q.QuizId == id)
                ?? throw new NotFoundException("Quiz was not found.");
            quiz.Visibility = Visibility.Private;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("quizzes/{id:int}")]
        public async Task<IActionResult> DeleteQuiz(int id)
        {
            var quiz = await _context.Quizzes.FirstOrDefaultAsync(q => q.QuizId == id)
                ?? throw new NotFoundException("Quiz was not found.");
            if (await _context.QuizAttempts.AnyAsync(a => a.QuizId == id))
            {
                throw new ConflictException("The Quiz has existing attempts and cannot be deleted.");
            }

            _context.Quizzes.Remove(quiz);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private async Task<AdminUserVm> MapUserAsync(ApplicationUser user)
            => MapUser(user, await _userManager.GetRolesAsync(user));

        private static AdminUserVm MapUser(ApplicationUser user, IList<string> roles)
        {
            return new AdminUserVm
            {
                UserId = user.Id,
                Email = user.Email ?? string.Empty,
                FullName = user.FullName,
                IsBlocked = user.LockoutEnd.HasValue && user.LockoutEnd > DateTimeOffset.UtcNow,
                Roles = roles
            };
        }
    }
}
