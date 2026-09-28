using backend.ViewModels.QuestionBanks;

namespace backend.Services.Interfaces
{
    public interface IQuestionBankService
    {
        Task<IEnumerable<QuestionBankVm>> GetMineAsync(
            string userId);

        Task<IEnumerable<QuestionBankVm>> GetPublicAsync(
            string? currentUserId);

        Task<QuestionBankVm> GetByIdAsync(
            int id,
            string? currentUserId);

        Task<QuestionBankVm> CreateAsync(
            string userId,
            CreateQuestionBankVm model);

        Task<QuestionBankVm> UpdateAsync(
            int id,
            string userId,
            UpdateQuestionBankVm model);

        Task DeleteAsync(
            int id,
            string userId);
    }
}