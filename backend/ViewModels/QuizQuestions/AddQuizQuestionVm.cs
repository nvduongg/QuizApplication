using System.ComponentModel.DataAnnotations;

namespace backend.ViewModels.QuizQuestions
{
    public class AddQuizQuestionVm
    {
        [Range(1, int.MaxValue)]
        public int QuestionId { get; set; }

        [Range(
            typeof(decimal),
            "0.01",
            "100000")]
        public decimal Points { get; set; }
    }
}