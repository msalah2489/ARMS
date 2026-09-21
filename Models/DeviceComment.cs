namespace ARMS.Web.Models;

// A free-text note attached to a device — e.g. left by Customer Service — that shows up
// wherever the device's history is viewed (technician, supervisor, manager, branch staff).
public class DeviceComment
{
    public int Id { get; set; }
    public int ServiceDeviceId { get; set; }
    public string Text { get; set; } = "";
    public string CreatedBy { get; set; } = "";
    public string CreatedByRole { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
