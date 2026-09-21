namespace ARMS.Web.Models;

public class ServiceRequest
{
    public int Id { get; set; }
    public string RequestNumber { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Branch { get; set; } = "الرياض";
    public string Priority { get; set; } = "عادي";
    public string Status { get; set; } = "جديد";
    public string CreatedBy { get; set; } = "أحمد محمد";
    public string InvoiceNumber { get; set; } = "";
    public string Notes { get; set; } = "";
    public string ServiceType { get; set; } = "صيانة أجهزة التعطير";
    public string IntakeSource { get; set; } = "فرع";
    public string OriginName { get; set; } = "";
    public DateTime ReceivedAt { get; set; } = DateTime.Now;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime? ApprovedAt { get; set; }
    public DateTime? DispatchReportPrintedAt { get; set; }
    public DateTime? SentAt { get; set; }
    public List<ServiceDevice> Devices { get; set; } = new();
}
