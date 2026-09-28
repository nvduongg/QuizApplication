using backend.ViewModels.Quizzes;

namespace backend.Services.Interfaces
{
    public interface IQuizService
    {
        Task<IEnumerable<QuizVm>> GetMineAsync(
            string userId);

        Task<QuizDetailVm> GetByIdAsync(
            int id,
            string userId);

        Task<QuizDetailVm> CreateAsync(
            string userId,
            CreateQuizVm model);

        Task<QuizDetailVm> UpdateAsync(
            int id,
            string userId,
            UpdateQuizVm model);

        Task<QuizDetailVm> PublishAsync(
            int id,
            string userId);

        Task<QuizDetailVm> UnpublishAsync(
            int id,
            string userId);

        Task DeleteAsync(
            int id,
            string userId);
    }
}