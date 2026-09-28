namespace backend.Models
{
    public class AttemptAnswer
    {
        public int AttemptAnswerId { get; set; }

        public int QuizAttemptId { get; set; }

        public int QuestionId { get; set; }

        public int AnswerId { get; set; }

        public QuizAttempt QuizAttempt { get; set; } = null!;

        public Question Question { get; set; } = null!;

        public Answer Answer { get; set; } = null!;
    }
}