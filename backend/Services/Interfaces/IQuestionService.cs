using backend.ViewModels.Questions;

namespace backend.Services.Interfaces
{
    public interface IQuestionService
    {
        Task<IEnumerable<QuestionVm>> GetByBankAsync(
            int bankId,
            string userId);

        Task<IEnumerable<QuestionVm>> SearchAccessibleAsync(
            string userId,
            string search);

        Task<QuestionDetailVm> GetByIdAsync(
            int id,
            string userId);

        Task<QuestionDetailVm> CreateAsync(
            int bankId,
            string userId,
            CreateQuestionVm model);

        Task<QuestionDetailVm> UpdateAsync(
            int id,
            string userId,
            UpdateQuestionVm model);

        Task DeleteAsync(
            int id,
            string userId);
    }
}