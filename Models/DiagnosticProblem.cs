namespace ARMS.Web.Models;

public class DiagnosticProblem
{
    public int Id { get; set; }
    public int DeviceModelId { get; set; }
    public string ProblemName { get; set; } = "";
    public string Cause { get; set; } = "";
    public string Solution { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public List<DiagnosticRule> Rules { get; set; } = new();
}
