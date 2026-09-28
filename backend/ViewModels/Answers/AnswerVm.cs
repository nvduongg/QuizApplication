namespace backend.ViewModels.Answers
{
    public class AnswerVm
    {
        public int AnswerId { get; set; }

        public int QuestionId { get; set; }

        public string Content { get; set; } = string.Empty;

        public bool IsCorrect { get; set; }
    }
}