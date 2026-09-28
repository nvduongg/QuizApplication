using backend.Enums;

namespace backend.ViewModels.QuizQuestions
{
    public class QuizQuestionVm
    {
        public int QuizId { get; set; }

        public int QuestionId { get; set; }

        public string Content { get; set; }
            = string.Empty;

        public QuestionType QuestionType { get; set; }

        public int QuestionOrder { get; set; }

        public decimal Points { get; set; }

        public int AnswerCount { get; set; }

        public bool IsOwnedQuestion { get; set; }
    }
}