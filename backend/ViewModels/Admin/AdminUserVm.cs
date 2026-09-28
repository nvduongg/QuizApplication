namespace backend.ViewModels.Admin
{
    public class AdminUserVm
    {
        public string UserId { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public bool IsBlocked { get; set; }
        public IList<string> Roles { get; set; } = new List<string>();
    }
}
