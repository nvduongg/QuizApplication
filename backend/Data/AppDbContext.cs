using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace backend.Data
{
    public class AppDbContext
        : IdentityDbContext<ApplicationUser, IdentityRole, string>
    {
        public AppDbContext(
            DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<QuestionBank> QuestionBanks { get; set; }

        public DbSet<Question> Questions { get; set; }

        public DbSet<Answer> Answers { get; set; }

        public DbSet<Quiz> Quizzes { get; set; }

        public DbSet<QuizQuestion> QuizQuestions { get; set; }

        public DbSet<QuizAttempt> QuizAttempts { get; set; }

        public DbSet<AttemptAnswer> AttemptAnswers { get; set; }

        public DbSet<QuizAttemptQuestionResult> QuizAttemptQuestionResults { get; set; }

        public DbSet<QuizAttemptResultAnswer> QuizAttemptResultAnswers { get; set; }

        protected override void OnModelCreating(
            ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            ConfigureApplicationUser(modelBuilder);
            ConfigureQuestionBank(modelBuilder);
            ConfigureQuestion(modelBuilder);
            ConfigureAnswer(modelBuilder);
            ConfigureQuiz(modelBuilder);
            ConfigureQuizQuestion(modelBuilder);
            ConfigureQuizAttempt(modelBuilder);
            ConfigureAttemptAnswer(modelBuilder);
            ConfigureQuizAttemptQuestionResult(modelBuilder);
            ConfigureQuizAttemptResultAnswer(modelBuilder);
        }

        private static void ConfigureApplicationUser(
            ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<ApplicationUser>(entity =>
            {
                entity.Property(u => u.FullName)
                    .IsRequired()
                    .HasMaxLength(100);
            });
        }

        private static void ConfigureQuestionBank(
            ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<QuestionBank>(entity =>
            {
                entity.HasKey(qb => qb.QuestionBankId);

                entity.Property(qb => qb.Name)
                    .IsRequired()
                    .HasMaxLength(150);

                entity.Property(qb => qb.Description)
                    .HasMaxLength(500);

                entity.Property(qb => qb.Visibility)
                    .IsRequired();

                entity.Property(qb => qb.CreatedAt)
                    .IsRequired();

                entity.HasOne(qb => qb.Owner)
                    .WithMany(u => u.QuestionBanks)
                    .HasForeignKey(qb => qb.OwnerId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(qb => qb.OwnerId);

                entity.HasIndex(qb => new
                {
                    qb.OwnerId,
                    qb.Name
                });
            });
        }

        private static void ConfigureQuestion(
            ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Question>(entity =>
            {
                entity.HasKey(q => q.QuestionId);

                entity.Property(q => q.Content)
                    .IsRequired()
                    .HasColumnType("nvarchar(max)");

                entity.Property(q => q.QuestionType)
                    .IsRequired();

                entity.Property(q => q.CreatedAt)
                    .IsRequired();

                entity.HasOne(q => q.QuestionBank)
                    .WithMany(qb => qb.Questions)
                    .HasForeignKey(q => q.QuestionBankId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(q => q.QuestionBankId);
            });
        }

        private static void ConfigureAnswer(
            ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Answer>(entity =>
            {
                entity.HasKey(a => a.AnswerId);

                entity.Property(a => a.Content)
                    .IsRequired()
                    .HasColumnType("nvarchar(max)");

                entity.Property(a => a.IsCorrect)
                    .IsRequired();

                entity.HasOne(a => a.Question)
                    .WithMany(q => q.Answers)
                    .HasForeignKey(a => a.QuestionId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(a => a.QuestionId);
            });
        }

        private static void ConfigureQuiz(
            ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Quiz>(entity =>
            {
                entity.HasKey(q => q.QuizId);

                entity.Property(q => q.Title)
                    .IsRequired()
                    .HasMaxLength(255);

                entity.Property(q => q.Description)
                    .HasMaxLength(1000);

                entity.Property(q => q.Duration)
                    .IsRequired();

                entity.Property(q => q.Visibility)
                    .IsRequired();

                entity.Property(q => q.CreatedAt)
                    .IsRequired();

                entity.HasOne(q => q.Creator)
                    .WithMany(u => u.CreatedQuizzes)
                    .HasForeignKey(q => q.CreatorId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(q => q.CreatorId);

                entity.HasIndex(q => q.Visibility);
            });
        }

        private static void ConfigureQuizQuestion(
            ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<QuizQuestion>(entity =>
            {
                entity.HasKey(qq => new
                {
                    qq.QuizId,
                    qq.QuestionId
                });

                entity.Property(qq => qq.QuestionOrder)
                    .IsRequired();

                entity.Property(qq => qq.Points)
                    .HasPrecision(8, 2)
                    .IsRequired();

                entity.HasOne(qq => qq.Quiz)
                    .WithMany(q => q.QuizQuestions)
                    .HasForeignKey(qq => qq.QuizId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(qq => qq.Question)
                    .WithMany(q => q.QuizQuestions)
                    .HasForeignKey(qq => qq.QuestionId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(qq => new
                {
                    qq.QuizId,
                    qq.QuestionOrder
                })
                .IsUnique();
            });
        }

        private static void ConfigureQuizAttemptQuestionResult(
            ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<QuizAttemptQuestionResult>(entity =>
            {
                entity.HasKey(x => x.QuizAttemptQuestionResultId);

                entity.Property(x => x.Content)
                    .IsRequired()
                    .HasColumnType("nvarchar(max)");

                entity.Property(x => x.EarnedPoints)
                    .HasPrecision(8, 2)
                    .IsRequired();

                entity.Property(x => x.MaxPoints)
                    .HasPrecision(8, 2)
                    .IsRequired();

                entity.Property(x => x.Outcome)
                    .IsRequired();

                entity.HasOne(x => x.QuizAttempt)
                    .WithMany(x => x.QuestionResults)
                    .HasForeignKey(x => x.QuizAttemptId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(x => new
                {
                    x.QuizAttemptId,
                    x.QuestionId
                })
                .IsUnique();
            });
        }

        private static void ConfigureQuizAttemptResultAnswer(
            ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<QuizAttemptResultAnswer>(entity =>
            {
                entity.HasKey(x => x.QuizAttemptResultAnswerId);

                entity.Property(x => x.Content)
                    .IsRequired()
                    .HasColumnType("nvarchar(max)");

                entity.HasOne(x => x.QuestionResult)
                    .WithMany(x => x.Answers)
                    .HasForeignKey(x => x.QuizAttemptQuestionResultId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(x => new
                {
                    x.QuizAttemptQuestionResultId,
                    x.AnswerId
                })
                .IsUnique();
            });
        }

        private static void ConfigureQuizAttempt(
            ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<QuizAttempt>(entity =>
            {
                entity.HasKey(qa => qa.QuizAttemptId);

                entity.Property(qa => qa.StartedAt)
                    .IsRequired();

                entity.Property(qa => qa.Score)
                    .HasPrecision(8, 2);

                entity.Property(qa => qa.Status)
                    .IsRequired()
                    .IsConcurrencyToken();

                entity.HasOne(qa => qa.User)
                    .WithMany(u => u.QuizAttempts)
                    .HasForeignKey(qa => qa.UserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(qa => qa.Quiz)
                    .WithMany(q => q.QuizAttempts)
                    .HasForeignKey(qa => qa.QuizId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(qa => qa.UserId);

                entity.HasIndex(qa => qa.QuizId);

                entity.HasIndex(qa => new
                {
                    qa.UserId,
                    qa.QuizId
                });
            });
        }

        private static void ConfigureAttemptAnswer(
            ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<AttemptAnswer>(entity =>
            {
                entity.HasKey(aa => aa.AttemptAnswerId);

                entity.HasOne(aa => aa.QuizAttempt)
                    .WithMany(qa => qa.AttemptAnswers)
                    .HasForeignKey(aa => aa.QuizAttemptId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(aa => aa.Question)
                    .WithMany(q => q.AttemptAnswers)
                    .HasForeignKey(aa => aa.QuestionId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(aa => aa.Answer)
                    .WithMany(a => a.AttemptAnswers)
                    .HasForeignKey(aa => aa.AnswerId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(aa => new
                {
                    aa.QuizAttemptId,
                    aa.QuestionId,
                    aa.AnswerId
                })
                .IsUnique();
            });
        }
    }
}
