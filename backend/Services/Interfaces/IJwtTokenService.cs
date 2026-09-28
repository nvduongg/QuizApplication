using backend.Models;
using backend.ViewModels.Auth;

namespace backend.Services.Interfaces
{
    public interface IJwtTokenService
    {
        Task<AuthResponseVm> CreateTokenAsync(
            ApplicationUser user);
    }
}