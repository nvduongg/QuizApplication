using backend.Enums;

namespace backend.ViewModels.QuizAttempts
{
    public class QuizAttemptResultVm
    {
        public int QuizAttemptId { get; set; }
        public int QuizId { get; set; }
        public string QuizTitle { get; set; } = string.Empty;
        public DateTime StartedAt { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public decimal? Score { get; set; }
        public decimal TotalPoints { get; set; }
        public decimal? Percentage { get; set; }
        public AttemptStatus Status { get; set; }
        public bool ReviewAvailable { get; set; }
        public List<QuizAttemptResultQuestionVm> Questions { get; set; } = new();
    }

    public class QuizAttemptResultQuestionVm
    {
        public int QuestionId { get; set; }
        public string Content { get; set; } = string.Empty;
        public QuestionType QuestionType { get; set; }
        public int QuestionOrder { get; set; }
        public decimal EarnedPoints { get; set; }
        public decimal MaxPoints { get; set; }
        public QuizAttemptQuestionOutcome Outcome { get; set; }
        public List<int> SelectedAnswerIds { get; set; } = new();
        public List<int> CorrectAnswerIds { get; set; } = new();
        public List<QuizAttemptResultAnswerVm> Answers { get; set; } = new();
    }

    public class QuizAttemptResultAnswerVm
    {
        public int AnswerId { get; set; }
        public string Content { get; set; } = string.Empty;
    }
}
