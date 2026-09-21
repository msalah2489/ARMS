namespace ARMS.Web.Models;
public class DeviceStatusHistory
{
 public int Id { get; set; }
 public int ServiceDeviceId { get; set; }
 public int? ServiceRequestId { get; set; }
 public string Status { get; set; } = "";
 public string Location { get; set; } = "";
 public DateTime StartedAt { get; set; } = DateTime.Now;
 public DateTime? EndedAt { get; set; }
 public string ChangedBy { get; set; } = "";
 public string Notes { get; set; } = "";
}
