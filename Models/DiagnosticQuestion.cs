namespace ARMS.Web.Models;

public class DiagnosticQuestion
{
    public int Id { get; set; }
    public int DeviceModelId { get; set; }
    public string QuestionText { get; set; } = "";
    public string AnswerType { get; set; } = "نعم/لا";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public int? YesNextQuestionId { get; set; }
    public int? NoNextQuestionId { get; set; }
    public string YesResultText { get; set; } = "";
    public string NoResultText { get; set; } = "";
    public List<DiagnosticOption> Options { get; set; } = new();
}
