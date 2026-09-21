namespace ARMS.Web.Models;

public class UserAccount
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Role { get; set; } = "";
    public string Branch { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public DateTime? PasswordChangedAt { get; set; }
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Theme { get; set; } = "light";
    public bool CanReturnDevices { get; set; } = true;
    public int? BranchId { get; set; }
    public bool IsActive { get; set; } = true;
    public int? MaintenanceCenterId { get; set; }
}
