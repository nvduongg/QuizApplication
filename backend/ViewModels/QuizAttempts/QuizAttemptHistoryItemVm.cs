using backend.Enums;

namespace backend.ViewModels.QuizAttempts
{
    public class QuizAttemptHistoryItemVm
    {
        public int QuizAttemptId { get; set; }
        public int QuizId { get; set; }
        public string QuizTitle { get; set; } = string.Empty;
        public AttemptStatus Status { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public decimal? Score { get; set; }
        public decimal TotalPoints { get; set; }
        public decimal? Percentage { get; set; }
    }
}
