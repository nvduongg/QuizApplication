using backend.Enums;

namespace backend.ViewModels.Questions
{
    public class QuestionVm
    {
        public int QuestionId { get; set; }

        public int QuestionBankId { get; set; }

        public string Content { get; set; } = string.Empty;

        public QuestionType QuestionType { get; set; }

        public DateTime CreatedAt { get; set; }

        public int AnswerCount { get; set; }
    }
}