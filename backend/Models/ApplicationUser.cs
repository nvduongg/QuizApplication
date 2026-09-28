using Microsoft.AspNetCore.Identity;

namespace backend.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string FullName { get; set; } = string.Empty;

        public ICollection<QuestionBank> QuestionBanks { get; set; }
            = new List<QuestionBank>();

        public ICollection<Quiz> CreatedQuizzes { get; set; }
            = new List<Quiz>();

        public ICollection<QuizAttempt> QuizAttempts { get; set; }
            = new List<QuizAttempt>();
    }
}