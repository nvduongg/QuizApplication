using backend.Enums;

namespace backend.ViewModels.QuizAttempts
{
    public class QuizAttemptQuestionVm
    {
        public int QuestionId { get; set; }
        public string Content { get; set; } = string.Empty;
        public QuestionType QuestionType { get; set; }
        public int QuestionOrder { get; set; }
        public decimal Points { get; set; }
        public List<QuizAttemptAnswerVm> Answers { get; set; } = new();
    }

    public class QuizAttemptAnswerVm
    {
        public int AnswerId { get; set; }
        public string Content { get; set; } = string.Empty;
    }
}
