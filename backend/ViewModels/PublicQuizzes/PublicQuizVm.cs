namespace backend.ViewModels.PublicQuizzes
{
    public class PublicQuizVm
    {
        public int QuizId { get; set; }

        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        public int Duration { get; set; }

        public string CreatorName { get; set; } = string.Empty;

        public int QuestionCount { get; set; }

        public decimal TotalPoints { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}