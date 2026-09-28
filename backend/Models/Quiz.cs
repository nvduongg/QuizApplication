using backend.Enums;

namespace backend.Models
{
    public class Quiz
    {
        public int QuizId { get; set; }

        public string CreatorId { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        public int Duration { get; set; }

        public Visibility Visibility { get; set; }
            = Visibility.Private;

        public DateTime CreatedAt { get; set; }
            = DateTime.UtcNow;

        public ApplicationUser Creator { get; set; } = null!;

        public ICollection<QuizQuestion> QuizQuestions { get; set; }
            = new List<QuizQuestion>();

        public ICollection<QuizAttempt> QuizAttempts { get; set; }
            = new List<QuizAttempt>();
    }
}