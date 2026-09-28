using backend.Enums;
using System.ComponentModel.DataAnnotations;

namespace backend.ViewModels.Questions
{
    public class UpdateQuestionVm
    {
        [Required]
        [MaxLength(1000)]
        public string Content { get; set; } = string.Empty;

        [Required]
        [EnumDataType(typeof(QuestionType))]
        public QuestionType QuestionType { get; set; }
    }
}