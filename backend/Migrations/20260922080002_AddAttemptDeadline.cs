using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddAttemptDeadline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiresAt",
                table: "QuizAttempts",
                type: "datetime2",
                nullable: true);

            // Adopt timing for existing active attempts; completed legacy results stay intact.
            migrationBuilder.Sql("""
                UPDATE a SET ExpiresAt = DATEADD(minute, q.Duration, a.StartedAt)
                FROM QuizAttempts a INNER JOIN Quizzes q ON q.QuizId = a.QuizId
                WHERE a.Status = 1 AND q.Duration BETWEEN 1 AND 1440;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "QuizAttempts");
        }
    }
}
