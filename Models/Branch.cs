namespace ARMS.Web.Models;

public class Branch
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string City { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public bool IsMaintenanceCenter { get; set; } = false;
}
