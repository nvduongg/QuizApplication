using backend.Models;
using backend.Services.Interfaces;
using backend.ViewModels.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace backend.Services.Implementations
{
    public class JwtTokenService : IJwtTokenService
    {
        private readonly IConfiguration _configuration;
        private readonly UserManager<ApplicationUser> _userManager;

        public JwtTokenService(
            IConfiguration configuration,
            UserManager<ApplicationUser> userManager)
        {
            _configuration = configuration;
            _userManager = userManager;
        }

        public async Task<AuthResponseVm> CreateTokenAsync(
            ApplicationUser user)
        {
            var jwtKey =
                _configuration["Jwt:Key"]
                ?? throw new InvalidOperationException(
                    "Jwt:Key is not configured.");

            var issuer =
                _configuration["Jwt:Issuer"]
                ?? throw new InvalidOperationException(
                    "Jwt:Issuer is not configured.");

            var audience =
                _configuration["Jwt:Audience"]
                ?? throw new InvalidOperationException(
                    "Jwt:Audience is not configured.");

            var expirationMinutes =
                int.TryParse(
                    _configuration["Jwt:ExpirationMinutes"],
                    out var configuredMinutes)
                    ? configuredMinutes
                    : 120;

            var roles =
                await _userManager.GetRolesAsync(user);

            var claims = new List<Claim>
            {
                new(
                    ClaimTypes.NameIdentifier,
                    user.Id),

                new(
                    ClaimTypes.Name,
                    user.UserName ?? user.Email ?? user.Id),

                new(
                    ClaimTypes.Email,
                    user.Email ?? string.Empty)
            };

            foreach (var role in roles)
            {
                claims.Add(
                    new Claim(
                        ClaimTypes.Role,
                        role));
            }

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey));

            var credentials =
                new SigningCredentials(
                    key,
                    SecurityAlgorithms.HmacSha256);

            var expiresAt =
                DateTime.UtcNow.AddMinutes(
                    expirationMinutes);

            var token =
                new JwtSecurityToken(
                    issuer: issuer,
                    audience: audience,
                    claims: claims,
                    expires: expiresAt,
                    signingCredentials: credentials);

            var accessToken =
                new JwtSecurityTokenHandler()
                    .WriteToken(token);

            return new AuthResponseVm
            {
                AccessToken = accessToken,
                ExpiresAt = expiresAt,
                UserId = user.Id,
                FullName = user.FullName,
                Email = user.Email ?? string.Empty,
                Roles = roles
            };
        }
    }
}