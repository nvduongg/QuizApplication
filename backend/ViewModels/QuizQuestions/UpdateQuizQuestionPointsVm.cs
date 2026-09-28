using System.ComponentModel.DataAnnotations;

namespace backend.ViewModels.QuizQuestions
{
    public class UpdateQuizQuestionPointsVm
    {
        [Range(
            typeof(decimal),
            "0.01",
            "100000")]
        public decimal Points { get; set; }
    }
}