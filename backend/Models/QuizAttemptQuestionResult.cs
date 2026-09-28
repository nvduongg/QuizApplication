using backend.Enums;

namespace backend.Models
{
    public class QuizAttemptQuestionResult
    {
        public int QuizAttemptQuestionResultId { get; set; }
        public int QuizAttemptId { get; set; }
        public int QuestionId { get; set; }
        public string Content { get; set; } = string.Empty;
        public QuestionType QuestionType { get; set; }
        public int QuestionOrder { get; set; }
        public decimal EarnedPoints { get; set; }
        public decimal MaxPoints { get; set; }
        public QuizAttemptQuestionOutcome Outcome { get; set; }

        public QuizAttempt QuizAttempt { get; set; } = null!;
        public ICollection<QuizAttemptResultAnswer> Answers { get; set; } = new List<QuizAttemptResultAnswer>();
    }
}
