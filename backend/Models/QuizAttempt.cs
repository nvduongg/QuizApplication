using backend.Enums;

namespace backend.Models
{
    public class QuizAttempt
    {
        public int QuizAttemptId { get; set; }

        public string UserId { get; set; } = string.Empty;

        public int QuizId { get; set; }

        public DateTime StartedAt { get; set; }
            = DateTime.UtcNow;

        public DateTime? SubmittedAt { get; set; }

        // Fixed at start; later quiz-duration edits must not move this deadline.
        public DateTime? ExpiresAt { get; set; }

        public decimal? Score { get; set; }

        public AttemptStatus Status { get; set; }
            = AttemptStatus.InProgress;

        public ApplicationUser User { get; set; } = null!;

        public Quiz Quiz { get; set; } = null!;

        public ICollection<AttemptAnswer> AttemptAnswers { get; set; }
            = new List<AttemptAnswer>();

        public ICollection<QuizAttemptQuestionResult> QuestionResults { get; set; }
            = new List<QuizAttemptQuestionResult>();
    }
}
