using System.ComponentModel.DataAnnotations;

namespace backend.ViewModels.QuizQuestions
{
    public class ReorderQuizQuestionsVm
    {
        [Required]
        public List<int> QuestionIds { get; set; }
            = [];
    }
}
