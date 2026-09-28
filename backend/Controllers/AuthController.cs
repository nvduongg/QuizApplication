using backend.Constants;
using backend.Models;
using backend.Services.Interfaces;
using backend.ViewModels.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser>
            _userManager;

        private readonly IJwtTokenService
            _jwtTokenService;

        public AuthController(
            UserManager<ApplicationUser> userManager,
            IJwtTokenService jwtTokenService)
        {
            _userManager = userManager;
            _jwtTokenService = jwtTokenService;
        }

        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<IActionResult> Register(
            RegisterVm model)
        {
            if (string.IsNullOrWhiteSpace(model.FullName))
            {
                return BadRequest(new
                {
                    message =
                        "Full name cannot be empty."
                });
            }

            if (string.IsNullOrWhiteSpace(model.Email) ||
                string.IsNullOrWhiteSpace(model.Password))
            {
                return BadRequest(new
                {
                    message = "Email and password are required."
                });
            }

            var email =
                model.Email.Trim();

            var existingUser =
                await _userManager.FindByEmailAsync(
                    email);

            if (existingUser != null)
            {
                return BadRequest(new
                {
                    message =
                        "An account with this email already exists."
                });
            }

            var user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                FullName = model.FullName.Trim(),
                EmailConfirmed = true
            };

            var result =
                await _userManager.CreateAsync(
                    user,
                    model.Password);

            if (!result.Succeeded)
            {
                return BadRequest(new
                {
                    message = string.Join(
                        "; ",
                        result.Errors
                            .Select(e => e.Description))
                });
            }

            var roleResult =
                await _userManager.AddToRoleAsync(
                    user,
                    AppRoles.User);

            if (!roleResult.Succeeded)
            {
                await _userManager.DeleteAsync(user);

                return BadRequest(new
                {
                    message = string.Join(
                        "; ",
                        roleResult.Errors
                            .Select(e => e.Description))
                });
            }

            return StatusCode(
                StatusCodes.Status201Created,
                new
                {
                    message =
                        "Account created successfully."
                });
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login(
            LoginVm model)
        {
            var email =
                model.Email.Trim();

            var user =
                await _userManager.FindByEmailAsync(
                    email);

            if (user == null)
            {
                return Unauthorized(new
                {
                    message =
                        "Invalid email or password."
                });
            }

            if (user.LockoutEnd.HasValue &&
                user.LockoutEnd > DateTimeOffset.UtcNow)
            {
                return Unauthorized(new
                {
                    message = "This account is inactive or blocked."
                });
            }

            var validPassword =
                await _userManager.CheckPasswordAsync(
                    user,
                    model.Password);

            if (!validPassword)
            {
                return Unauthorized(new
                {
                    message =
                        "Invalid email or password."
                });
            }

            var response =
                await _jwtTokenService
                    .CreateTokenAsync(user);

            return Ok(response);
        }
    }
}