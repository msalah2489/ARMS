namespace ARMS.Web.Models;

public class SparePart
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Code { get; set; } = "";
    public string Color { get; set; } = "";
    public string CompatibleDeviceModel { get; set; } = "";
    public int StockQuantity { get; set; }
    public bool IsActive { get; set; } = true;
}
