using System.ComponentModel.DataAnnotations;

namespace backend.ViewModels.QuizAttempts
{
    public class SubmitQuizAttemptVm
    {
        [Required]
        public List<SubmittedQuestionVm> Questions { get; set; } = new();
    }

    public class SubmittedQuestionVm
    {
        public int QuestionId { get; set; }

        public List<int> AnswerIds { get; set; } = new();
    }
}
