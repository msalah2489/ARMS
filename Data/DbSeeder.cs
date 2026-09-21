using ARMS.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace ARMS.Web.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IDbContextFactory<ArmsDbContext> factory)
    {
        await using var db = await factory.CreateDbContextAsync();
        await db.Database.EnsureCreatedAsync();
        // Intentionally no demo requests or devices are seeded.
        // New test installations start with clean operational data.
    }
}
