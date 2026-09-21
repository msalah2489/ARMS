namespace ARMS.Web.Models;

public class ShippingBatch
{
    public int Id { get; set; }
    public string BatchNumber { get; set; } = "";
    public string ShipmentNumber { get; set; } = "";
    public string Carrier { get; set; } = "";
    public string Direction { get; set; } = "وارد"; // وارد / إرسال للصيانة / إرجاع
    public string SourceType { get; set; } = "";
    public string SourceName { get; set; } = "";
    public string DestinationType { get; set; } = "";
    public string DestinationName { get; set; } = "";
    public string Status { get; set; } = "مسودة";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public string CreatedBy { get; set; } = "";
    public DateTime? HandedToCarrierAt { get; set; }
    public string HandedToCarrierBy { get; set; } = "";
    public DateTime? ReceivedAt { get; set; }
    public string ReceivedBy { get; set; } = "";
    public int? ParentBatchId { get; set; }
    public string Notes { get; set; } = "";
    public List<ShippingBatchItem> Items { get; set; } = new();
}
