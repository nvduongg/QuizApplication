using backend.Enums;

namespace backend.Models
{
    public class Question
    {
        public int QuestionId { get; set; }

        public int QuestionBankId { get; set; }

        public string Content { get; set; } = string.Empty;

        public QuestionType QuestionType { get; set; }

        public DateTime CreatedAt { get; set; }
            = DateTime.UtcNow;

        public QuestionBank QuestionBank { get; set; } = null!;

        public ICollection<Answer> Answers { get; set; }
            = new List<Answer>();

        public ICollection<QuizQuestion> QuizQuestions { get; set; }
            = new List<QuizQuestion>();

        public ICollection<AttemptAnswer> AttemptAnswers { get; set; }
            = new List<AttemptAnswer>();
    }
}