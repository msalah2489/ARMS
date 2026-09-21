using System.Security.Cryptography;
using ARMS.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace ARMS.Web.Data;

// Central place for turning a session token (the string stored in the browser)
// into a real, verified UserAccount. Every page in the app should resolve the
// current user through this helper instead of trusting a plain username coming
// back from JavaScript/localStorage.
public static class ArmsAuth
{
    public const int SessionLifetimeHours = 12;

    public const string SystemAdminRole = "مدير عام ARMS";
    public const string LegacySystemAdminRole = "مدير رئيسي";

    // مدير عام ARMS هو مدير IT / Super Admin، مع إبقاء مدير رئيسي للتوافق مع البيانات القديمة.
    public static bool IsSystemAdminRole(string? role) =>
        role is SystemAdminRole or LegacySystemAdminRole;


    // 256-bit random token, unguessable and unrelated to the username.
    public static string GenerateToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    public static async Task<UserAccount?> ResolveUserAsync(ArmsDbContext db, string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;

        var session = await db.UserSessions.FirstOrDefaultAsync(s => s.Token == token);
        if (session is null || session.ExpiresAt < DateTime.Now) return null;

        var user = await db.UserAccounts.FindAsync(session.UserId);
        return (user is not null && user.IsActive) ? user : null;
    }

    public static async Task<string> CreateSessionAsync(ArmsDbContext db, int userId)
    {
        var token = GenerateToken();
        db.UserSessions.Add(new UserSession
        {
            Token = token,
            UserId = userId,
            CreatedAt = DateTime.Now,
            ExpiresAt = DateTime.Now.AddHours(SessionLifetimeHours)
        });
        await db.SaveChangesAsync();
        return token;
    }

    public static async Task InvalidateSessionAsync(ArmsDbContext db, string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return;
        var session = await db.UserSessions.FirstOrDefaultAsync(s => s.Token == token);
        if (session is not null)
        {
            db.UserSessions.Remove(session);
            await db.SaveChangesAsync();
        }
    }
}
