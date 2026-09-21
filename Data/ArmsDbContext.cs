using ARMS.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace ARMS.Web.Data;

public class ArmsDbContext(DbContextOptions<ArmsDbContext> options) : DbContext(options)
{
    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<ServiceDevice> ServiceDevices => Set<ServiceDevice>();
    public DbSet<UserAccount> UserAccounts => Set<UserAccount>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<DeviceStatusHistory> DeviceStatusHistories => Set<DeviceStatusHistory>();
    public DbSet<ReplacementInventory> ReplacementInventory => Set<ReplacementInventory>();
    public DbSet<DeviceModel> DeviceModels => Set<DeviceModel>();
    public DbSet<Accessory> Accessories => Set<Accessory>();
    public DbSet<SparePart> SpareParts => Set<SparePart>();
    public DbSet<SparePartUsage> SparePartUsages => Set<SparePartUsage>();
    public DbSet<SparePartMovement> SparePartMovements => Set<SparePartMovement>();
    public DbSet<DeviceReceipt> DeviceReceipts => Set<DeviceReceipt>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<DeviceComment> DeviceComments => Set<DeviceComment>();
    public DbSet<DiagnosticQuestion> DiagnosticQuestions => Set<DiagnosticQuestion>();
    public DbSet<DiagnosticOption> DiagnosticOptions => Set<DiagnosticOption>();
    public DbSet<DiagnosticProblem> DiagnosticProblems => Set<DiagnosticProblem>();
    public DbSet<DiagnosticRule> DiagnosticRules => Set<DiagnosticRule>();
    public DbSet<ShippingBatch> ShippingBatches => Set<ShippingBatch>();
    public DbSet<ShippingBatchItem> ShippingBatchItems => Set<ShippingBatchItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ServiceRequest>().HasIndex(x => x.RequestNumber).IsUnique();
        modelBuilder.Entity<UserAccount>().HasIndex(x => x.Username).IsUnique();
        modelBuilder.Entity<UserSession>().HasIndex(x => x.Token).IsUnique();
        modelBuilder.Entity<Customer>().HasIndex(x => x.Phone).IsUnique();
        modelBuilder.Entity<ServiceRequest>().HasMany(x => x.Devices).WithOne(x => x.ServiceRequest).HasForeignKey(x => x.ServiceRequestId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<SparePartUsage>().HasOne(x => x.SparePart).WithMany().HasForeignKey(x => x.SparePartId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<SparePartUsage>().HasOne(x => x.ServiceDevice).WithMany().HasForeignKey(x => x.ServiceDeviceId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ServiceDevice>().HasMany(x => x.DeviceStatusHistories).WithOne().HasForeignKey(x => x.ServiceDeviceId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<DiagnosticQuestion>().HasIndex(x => new { x.DeviceModelId, x.SortOrder });
        modelBuilder.Entity<DiagnosticOption>().HasIndex(x => new { x.DiagnosticQuestionId, x.SortOrder });
        modelBuilder.Entity<DiagnosticProblem>().HasIndex(x => x.DeviceModelId);
        modelBuilder.Entity<DiagnosticRule>().HasIndex(x => new { x.DiagnosticProblemId, x.DiagnosticQuestionId });
        modelBuilder.Entity<DiagnosticQuestion>().HasMany(x => x.Options).WithOne().HasForeignKey(x => x.DiagnosticQuestionId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<DiagnosticProblem>().HasMany(x => x.Rules).WithOne().HasForeignKey(x => x.DiagnosticProblemId).OnDelete(DeleteBehavior.Cascade);
    }
}
