namespace ARMS.Web.Models;

public class SparePartUsage
{
    public int Id { get; set; }
    public int ServiceDeviceId { get; set; }
    public int ServiceRequestId { get; set; }
    public int SparePartId { get; set; }
    public int Quantity { get; set; }
    public string TechnicianName { get; set; } = "";
    public DateTime UsedAt { get; set; } = DateTime.Now;
    public SparePart? SparePart { get; set; }
    public ServiceDevice? ServiceDevice { get; set; }
}
