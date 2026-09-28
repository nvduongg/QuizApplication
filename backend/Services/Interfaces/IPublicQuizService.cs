using backend.ViewModels.PublicQuizzes;

namespace backend.Services.Interfaces
{
    public interface IPublicQuizService
    {
        Task<IEnumerable<PublicQuizVm>> GetAllAsync(
            string? search);

        Task<PublicQuizDetailVm> GetByIdAsync(
            int id);
    }
}