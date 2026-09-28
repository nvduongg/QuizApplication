namespace backend.Models
{
    public class QuizAttemptResultAnswer
    {
        public int QuizAttemptResultAnswerId { get; set; }
        public int QuizAttemptQuestionResultId { get; set; }
        public int AnswerId { get; set; }
        public string Content { get; set; } = string.Empty;
        public bool IsCorrect { get; set; }
        public bool IsSelected { get; set; }

        public QuizAttemptQuestionResult QuestionResult { get; set; } = null!;
    }
}
