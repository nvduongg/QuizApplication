namespace backend.Models
{
    public class QuizQuestion
    {
        public int QuizId { get; set; }

        public int QuestionId { get; set; }

        public int QuestionOrder { get; set; }

        public decimal Points { get; set; }

        public Quiz Quiz { get; set; } = null!;

        public Question Question { get; set; } = null!;
    }
}