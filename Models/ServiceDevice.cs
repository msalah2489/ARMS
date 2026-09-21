namespace ARMS.Web.Models;

public class ServiceDevice
{
    public int Id { get; set; }
    public int ServiceRequestId { get; set; }
    public string DeviceCode { get; set; } = "";
    public string DeviceType { get; set; } = "Diffuser";
    public string Brand { get; set; } = "Aromatic";
    public string Model { get; set; } = "X100";
    public string Color { get; set; } = "";
    public string SerialNumber { get; set; } = "";
    public string Problem { get; set; } = "";
    public string Decision { get; set; } = "جاهز للإرسال";
    public string ExternalCondition { get; set; } = "سليم";
    public string Accessories { get; set; } = "";
    public string ComplaintDetails { get; set; } = "";
    public string DeviceImagePath { get; set; } = "";
    public string CustomerReceiptNumber { get; set; } = "";
    public string CustomerReceiptImagePath { get; set; } = "";
    public DateTime? CustomerReceiptReceivedAt { get; set; }
    public string CustomerDeliveryReceiptNumber { get; set; } = "";
    public string CustomerDeliveryReceiptImagePath { get; set; } = "";
    public DateTime? CustomerDeliveryReceiptAt { get; set; }
    public string AdditionalDetails { get; set; } = "";
    public string CurrentLocation { get; set; } = "الفرع";
    public string CurrentStatus { get; set; } = "مستلم بالفرع";
    public string MaintenanceRoute { get; set; } = "";
    public string LocalMaintenanceFailureReason { get; set; } = "";
    public DateTime? LocalMaintenanceCompletedAt { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? ReturnedAt { get; set; }
    public string ReturnReason { get; set; } = "";
    public string ReturnedBy { get; set; } = "";
    public int? AssignedTechnicianId { get; set; }
    public string AssignedTechnicianName { get; set; } = "";
    public DateTime? MaintenanceStartedAt { get; set; }
    public DateTime? MaintenanceCompletedAt { get; set; }
    public bool MaintenancePaused { get; set; }
    public string MaintenanceNotes { get; set; } = "";
    public string MaintenanceTestsJson { get; set; } = "";
    public string DispatchBatchCode { get; set; } = "";
    public DateTime? MaintenanceReceivedAt { get; set; }
    public DateTime? BranchReceivedAt { get; set; }
    public string BranchReceivedBy { get; set; } = "";
    public DateTime? CustomerDeliveredAt { get; set; }
    public string CustomerDeliveredBy { get; set; } = "";
    public string MaintenanceReceivedBy { get; set; } = "";
    public string MaintenancePauseReason { get; set; } = "";
    public DateTime? TechnicianReceivedAt { get; set; }
    public string TechnicianExternalCondition { get; set; } = "";
    public string TechnicianDamageTypes { get; set; } = "";
    public string TechnicianDecision { get; set; } = "";
    public string FaultCause { get; set; } = "";
    public string RepairAction { get; set; } = "";
    public string ConsumedParts { get; set; } = "";
    public string MaintenanceTechnicianName { get; set; } = "";
    public bool SparePartsDeducted { get; set; }
    public string MaintenanceResult { get; set; } = "";
    public string ReplacementReason { get; set; } = "";
    public string ReplacementSource { get; set; } = "خارجي";
    public string ReplacementCondition { get; set; } = "";
    public DateTime? ReplacementBarcodePrintedAt { get; set; }
    public string ReturnedAccessories { get; set; } = "";
    public string AccessoryReturnReasons { get; set; } = "";
    public string ReplacementNotes { get; set; } = "";
    public int? ReplacementDeviceId { get; set; }
    public DateTime? ReplacedAt { get; set; }
    public string ReplacedBy { get; set; } = "";
    public string ScrapReason { get; set; } = "";
    public string ScrapNotes { get; set; } = "";
    public DateTime? ScrappedAt { get; set; }
    public string ScrappedBy { get; set; } = "";
    public ServiceRequest? ServiceRequest { get; set; }
    public List<DeviceStatusHistory> DeviceStatusHistories { get; set; } = new();
}
