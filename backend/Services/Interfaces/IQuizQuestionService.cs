using backend.ViewModels.QuizQuestions;

namespace backend.Services.Interfaces
{
    public interface IQuizQuestionService
    {
        Task<IEnumerable<QuizQuestionVm>> GetAllAsync(
            int quizId,
            string userId);

        Task<QuizQuestionVm> AddAsync(
            int quizId,
            string userId,
            AddQuizQuestionVm model);

        Task<QuizQuestionVm> UpdatePointsAsync(
            int quizId,
            int questionId,
            string userId,
            UpdateQuizQuestionPointsVm model);

        Task ReorderAsync(
            int quizId,
            string userId,
            ReorderQuizQuestionsVm model);

        Task RemoveAsync(
            int quizId,
            int questionId,
            string userId);
    }
}