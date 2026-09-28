using backend.Enums;
using System.ComponentModel.DataAnnotations;

namespace backend.ViewModels.QuestionBanks
{
    public class UpdateQuestionBankVm
    {
        [Required]
        [MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [EnumDataType(typeof(Visibility))]
        public Visibility Visibility { get; set; }
    }
}