using System.ComponentModel.DataAnnotations;

namespace backend.ViewModels.Auth
{
    public class LoginVm
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }
}