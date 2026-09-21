using Microsoft.AspNetCore.Components.Forms;

namespace ARMS.Web.Data;

// Every receipt/device photo the user uploads goes through here first.
// Without this, the app would happily save any file type (including
// executable or script files) into a publicly-servable folder.
public static class UploadGuard
{
    static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp"
    };

    public const long MaxFileSizeBytes = 8_000_000;

    // Returns null when the file is acceptable, or an Arabic error message to show the user.
    public static string? Validate(IBrowserFile? file)
    {
        if (file is null) return null; // required-ness is checked separately by each caller
        var ext = Path.GetExtension(file.Name);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
            return "خطأ: نوع الملف غير مسموح. الأنواع المسموحة: JPG, JPEG, PNG, WEBP فقط.";
        if (!AllowedContentTypes.Contains(file.ContentType))
            return "خطأ: نوع الملف غير مسموح. الأنواع المسموحة: JPG, JPEG, PNG, WEBP فقط.";
        if (file.Size <= 0 || file.Size > MaxFileSizeBytes)
            return "خطأ: حجم الملف غير صالح أو يتجاوز الحد المسموح (8 ميجابايت).";
        return null;
    }

    // Always use this instead of the file's own extension to build the safe filename,
    // so a malicious name like "x.jpg.exe" can never sneak an executable extension through.
    public static string SafeExtension(IBrowserFile file)
    {
        var ext = Path.GetExtension(file.Name).ToLowerInvariant();
        return AllowedExtensions.Contains(ext) ? ext : ".jpg";
    }
}
