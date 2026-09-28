using backend.Enums;

namespace backend.ViewModels.Admin
{
    public class AdminQuizVm
    {
        public int QuizId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string CreatorId { get; set; } = string.Empty;
        public Visibility Visibility { get; set; }
        public int QuestionCount { get; set; }
        public int AttemptCount { get; set; }
    }
}
