using backend.Enums;

namespace backend.Models
{
    public class QuestionBank
    {
        public int QuestionBankId { get; set; }

        public string OwnerId { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        public Visibility Visibility { get; set; }
            = Visibility.Private;

        public DateTime CreatedAt { get; set; }
            = DateTime.UtcNow;

        public ApplicationUser Owner { get; set; } = null!;

        public ICollection<Question> Questions { get; set; }
            = new List<Question>();
    }
}