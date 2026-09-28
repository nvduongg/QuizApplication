using backend.Enums;

namespace backend.ViewModels.QuestionBanks
{
    public class QuestionBankVm
    {
        public int QuestionBankId { get; set; }

        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        public Visibility Visibility { get; set; }

        public DateTime CreatedAt { get; set; }

        public string OwnerId { get; set; } = string.Empty;

        public string OwnerName { get; set; } = string.Empty;

        public int QuestionCount { get; set; }
    }
}