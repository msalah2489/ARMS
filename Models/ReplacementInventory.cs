namespace ARMS.Web.Models;

public class ReplacementInventory
{
    public int Id { get; set; }
    public string DeviceCode { get; set; } = "";
    public string DeviceType { get; set; } = "Diffuser";
    public string Brand { get; set; } = "Aromatic";
    public string Model { get; set; } = "";
    public string SerialNumber { get; set; } = "";
    public string Color { get; set; } = "";
    public string Status { get; set; } = "متاح";
    public string DeviceCondition { get; set; } = "جديد";
    public string Location { get; set; } = "مستودع المستبدل";
    public int? ServiceRequestId { get; set; }
    public int? AssignedServiceDeviceId { get; set; }
    public DateTime? ScrappedAt { get; set; }
    public string ScrapReason { get; set; } = "";
    public string ScrapNotes { get; set; } = "";
}
