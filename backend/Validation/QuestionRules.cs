using backend.Enums;
using backend.Exceptions;
using backend.Models;
namespace backend.Validation;

public static class QuestionRules
{
    public static void ValidateQuestion(
        string content,
        QuestionType questionType)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new BadRequestException(
                "Question content cannot be empty.");
        }

        if (!Enum.IsDefined(questionType))
        {
            throw new BadRequestException(
                "Invalid question type.");
        }
    }

    public static void ValidateNewAnswer(
        Question question,
        string content,
        bool isCorrect)
    {
        if (question.Answers.Any(x =>
                x.Content.ToLower() ==
                content.ToLower()))
        {
            throw new BadRequestException(
                "This answer already exists for the question.");
        }

        switch (question.QuestionType)
        {
            case QuestionType.SingleChoice:
                if (isCorrect &&
                    question.Answers.Any(x =>
                        x.IsCorrect))
                {
                    throw new BadRequestException(
                        "A Single Choice question can have only one correct answer.");
                }

                break;

            case QuestionType.MultipleChoice:
                break;

            case QuestionType.TrueFalse:
                ValidateTrueFalse(
                    question.Answers,
                    content,
                    isCorrect);

                break;

            default:
                throw new BadRequestException(
                    "Unsupported question type.");
        }
    }

    public static void ValidateUpdatedAnswer(
        QuestionType questionType,
        IEnumerable<Answer> siblingAnswers,
        string content,
        bool isCorrect)
    {
        var siblings = siblingAnswers.ToList();

        if (siblings.Any(x =>
                x.Content.Equals(
                    content,
                    StringComparison.OrdinalIgnoreCase)))
        {
            throw new BadRequestException(
                "This answer already exists for the question.");
        }

        if (questionType == QuestionType.SingleChoice &&
            isCorrect &&
            siblings.Any(x => x.IsCorrect))
        {
            throw new BadRequestException(
                "A Single Choice question can have only one correct answer.");
        }

        if (questionType == QuestionType.TrueFalse)
        {
            ValidateTrueFalse(
                siblings,
                content,
                isCorrect);
        }
    }

    public static void ValidateTrueFalse(
        IEnumerable<Answer> existingAnswers,
        string content,
        bool isCorrect)
    {
        var answers = existingAnswers.ToList();

        var isTrue =
            content.Equals(
                "True",
                StringComparison.OrdinalIgnoreCase);

        var isFalse =
            content.Equals(
                "False",
                StringComparison.OrdinalIgnoreCase);

        if (!isTrue && !isFalse)
        {
            throw new BadRequestException(
                "True/False questions can contain only 'True' and 'False' answers.");
        }

        if (answers.Count >= 2)
        {
            throw new BadRequestException(
                "A True/False question can contain only two answers.");
        }

        if (isCorrect &&
            answers.Any(x => x.IsCorrect))
        {
            throw new BadRequestException(
                "A True/False question can have only one correct answer.");
        }
    }

    public static void ValidateContent(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new BadRequestException(
                "Answer content cannot be empty.");
        }
    }

    public static void ValidateQuestionForPublishing(
        Question question)
    {
        var answers =
            question.Answers.ToList();

        if (answers.Count < 2)
        {
            throw new BadRequestException(
                $"Question {question.QuestionId} must contain at least two answers.");
        }

        switch (question.QuestionType)
        {
            case QuestionType.SingleChoice:
                {
                    var correctCount =
                        answers.Count(a =>
                            a.IsCorrect);

                    if (correctCount != 1)
                    {
                        throw new BadRequestException(
                            $"Single Choice question {question.QuestionId} must have exactly one correct answer.");
                    }

                    break;
                }

            case QuestionType.MultipleChoice:
                {
                    var correctCount =
                        answers.Count(a =>
                            a.IsCorrect);

                    if (correctCount < 1)
                    {
                        throw new BadRequestException(
                            $"Multiple Choice question {question.QuestionId} must have at least one correct answer.");
                    }

                    break;
                }

            case QuestionType.TrueFalse:
                {
                    if (answers.Count != 2)
                    {
                        throw new BadRequestException(
                            $"True/False question {question.QuestionId} must contain exactly two answers.");
                    }

                    var hasTrue =
                        answers.Any(a =>
                            a.Content.Equals(
                                "True",
                                StringComparison.OrdinalIgnoreCase));

                    var hasFalse =
                        answers.Any(a =>
                            a.Content.Equals(
                                "False",
                                StringComparison.OrdinalIgnoreCase));

                    if (!hasTrue || !hasFalse)
                    {
                        throw new BadRequestException(
                            $"True/False question {question.QuestionId} must contain both True and False answers.");
                    }

                    var correctCount =
                        answers.Count(a =>
                            a.IsCorrect);

                    if (correctCount != 1)
                    {
                        throw new BadRequestException(
                            $"True/False question {question.QuestionId} must have exactly one correct answer.");
                    }

                    break;
                }

            default:
                throw new BadRequestException(
                    $"Question {question.QuestionId} has an unsupported question type.");
        }
    }

}