namespace ARMS.Web.Models;

public class DiagnosticOption
{
    public int Id { get; set; }
    public int DiagnosticQuestionId { get; set; }
    public string OptionText { get; set; } = "";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
