using backend.ViewModels.Answers;

namespace backend.Services.Interfaces
{
    public interface IAnswerService
    {
        Task<IEnumerable<AnswerVm>> GetByQuestionAsync(
            int questionId,
            string userId);

        Task<AnswerVm> CreateAsync(
            int questionId,
            string userId,
            CreateAnswerVm model);

        Task<AnswerVm> UpdateAsync(
            int id,
            string userId,
            UpdateAnswerVm model);

        Task DeleteAsync(
            int id,
            string userId);
    }
}