namespace ARMS.Web.Models;

// A server-issued login session. The random Token (not the username) is what
// gets stored in the browser's localStorage. Knowing a username is no longer
// enough to impersonate a user: the token must match a live, unexpired row here.
public class UserSession
{
    public int Id { get; set; }
    public string Token { get; set; } = "";
    public int UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime ExpiresAt { get; set; }
}
