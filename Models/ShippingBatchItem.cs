namespace ARMS.Web.Models;

public class ShippingBatchItem
{
    public int Id { get; set; }
    public int ShippingBatchId { get; set; }
    public int ServiceDeviceId { get; set; }
    public string DeviceCodeSnapshot { get; set; } = "";
    public string ModelSnapshot { get; set; } = "";
    public string ColorSnapshot { get; set; } = "";
    public string Status { get; set; } = "ضمن الشحنة";
    public DateTime? RemovedAt { get; set; }
    public string RemovedBy { get; set; } = "";
    public string RemovalReason { get; set; } = "";
    public ShippingBatch? ShippingBatch { get; set; }
    public ServiceDevice? ServiceDevice { get; set; }
}
