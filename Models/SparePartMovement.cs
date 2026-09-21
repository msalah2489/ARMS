namespace ARMS.Web.Models;

public class SparePartMovement
{
    public int Id { get; set; }
    public int SparePartId { get; set; }
    public string MovementType { get; set; } = "استلام";
    public int Quantity { get; set; }
    public DateTime MovementDate { get; set; } = DateTime.Now;
    public string ReferenceNumber { get; set; } = "";
    public string ReferenceImagePath { get; set; } = "";
    public string Location { get; set; } = "فرع الصيانة";
    public string TechnicianName { get; set; } = "";
    public int? ServiceDeviceId { get; set; }
    public string DeviceModel { get; set; } = "";
    public string DeviceCode { get; set; } = "";
    public string Notes { get; set; } = "";
    public SparePart? SparePart { get; set; }
}
