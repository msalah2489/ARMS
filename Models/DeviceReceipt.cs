namespace ARMS.Web.Models;
public class DeviceReceipt
{
    public int Id { get; set; }
    public int ServiceDeviceId { get; set; }
    public string ReceiptType { get; set; } = "استلام من العميل";
    public string ReceiptNumber { get; set; } = "";
    public string ImagePath { get; set; } = "";
    public DateTime ReceiptDate { get; set; } = DateTime.Now;
    public string RecordedBy { get; set; } = "";
}
