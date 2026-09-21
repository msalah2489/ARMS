namespace ARMS.Web.Models;

public class DeviceModel
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string DeviceType { get; set; } = "Diffuser";
    public string Brand { get; set; } = "Aromatic";
    public bool IsActive { get; set; } = true;
    public string UserGuideUrl { get; set; } = "";
    public string MediaGuideUrl { get; set; } = "";
}
