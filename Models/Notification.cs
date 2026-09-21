namespace ARMS.Web.Models;

public class Notification
{
    public int Id { get; set; }
    public string Message { get; set; } = "";
    public string TargetUrl { get; set; } = "/";
    public string Type { get; set; } = "info";
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
