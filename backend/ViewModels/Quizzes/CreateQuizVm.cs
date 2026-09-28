using System.ComponentModel.DataAnnotations;

namespace backend.ViewModels.Quizzes
{
    public class CreateQuizVm
    {
        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [Range(1, 1440)]
        public int Duration { get; set; }
    }
}