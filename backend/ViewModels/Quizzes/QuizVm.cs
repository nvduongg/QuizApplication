using backend.Enums;

namespace backend.ViewModels.Quizzes
{
    public class QuizVm
    {
        public int QuizId { get; set; }

        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        public int Duration { get; set; }

        public Visibility Visibility { get; set; }

        public DateTime CreatedAt { get; set; }

        public string CreatorId { get; set; } = string.Empty;

        public string CreatorName { get; set; } = string.Empty;

        public int QuestionCount { get; set; }

        public decimal TotalPoints { get; set; }
    }
}