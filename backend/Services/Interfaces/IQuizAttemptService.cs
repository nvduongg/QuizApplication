using backend.ViewModels.QuizAttempts;

namespace backend.Services.Interfaces
{
    public interface IQuizAttemptService
    {
        Task<QuizAttemptVm> StartAsync(string userId, int quizId);
        Task<QuizAttemptVm> GetAsync(string userId, int attemptId);
        Task<QuizAttemptSubmissionVm> SubmitAsync(string userId, int attemptId, SubmitQuizAttemptVm model);
        Task<QuizAttemptResultVm> GetResultAsync(string userId, int attemptId);
        Task<IReadOnlyList<QuizAttemptHistoryItemVm>> GetHistoryAsync(string userId, int page, int pageSize);
    }
}
