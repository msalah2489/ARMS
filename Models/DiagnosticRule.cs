namespace ARMS.Web.Models;

public class DiagnosticRule
{
    public int Id { get; set; }
    public int DiagnosticProblemId { get; set; }
    public int DiagnosticQuestionId { get; set; }
    public string ExpectedAnswer { get; set; } = "";
    public string Classification { get; set; } = "محتملة جدًا";
    public bool IsActive { get; set; } = true;
}
