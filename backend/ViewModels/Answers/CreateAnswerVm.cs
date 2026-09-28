using System.ComponentModel.DataAnnotations;

namespace backend.ViewModels.Answers
{
    public class CreateAnswerVm
    {
        [Required]
        [MaxLength(500)]
        public string Content { get; set; } = string.Empty;

        public bool IsCorrect { get; set; }
    }
}