using backend.Enums;

namespace backend.ViewModels.QuizAttempts
{
    public class QuizAttemptVm
    {
        public int QuizAttemptId { get; set; }
        public int QuizId { get; set; }
        public string QuizTitle { get; set; } = string.Empty;
        public DateTime StartedAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime ServerNow { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public decimal? Score { get; set; }
        public decimal TotalPoints { get; set; }
        public decimal? Percentage { get; set; }
        public AttemptStatus Status { get; set; }
        public List<QuizAttemptQuestionVm> Questions { get; set; } = new();
    }
}
