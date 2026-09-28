using backend.Enums;
using backend.Models;
using backend.ViewModels.Answers;

namespace backend.ViewModels.Questions
{
    public class QuestionDetailVm
    {
        public int QuestionId { get; set; }

        public int QuestionBankId { get; set; }

        public string Content { get; set; } = string.Empty;

        public QuestionType QuestionType { get; set; }

        public DateTime CreatedAt { get; set; }

        public List<AnswerVm> Answers { get; set; } = [];
    }
}