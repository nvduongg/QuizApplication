using backend.Enums;

namespace backend.ViewModels.QuizAttempts
{
    public class QuizAttemptSubmissionVm
    {
        public int QuizAttemptId { get; set; }
        public AttemptStatus Status { get; set; }
        public DateTime SubmittedAt { get; set; }
    }
}
