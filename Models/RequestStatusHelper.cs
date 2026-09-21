namespace ARMS.Web.Models;

public static class RequestStatusHelper
{
    public static string Calculate(IEnumerable<ServiceDevice>? source)
    {
        var ds = source?.ToList() ?? new List<ServiceDevice>();
        if (ds.Count == 0) return "جديد";

        bool IsCancelled(ServiceDevice d) => d.Decision == "ملغى" || d.CurrentStatus == "ملغى";
        bool IsExcluded(ServiceDevice d) => d.Decision is "مستبعد" or "مهلك" or "مستبدل" || d.CurrentStatus is "مهلك" or "مستبدل";
        bool IsDelivered(ServiceDevice d) => d.CustomerDeliveredAt.HasValue;
        bool IsTerminal(ServiceDevice d) => IsCancelled(d) || IsExcluded(d) || IsDelivered(d);

        if (ds.All(IsCancelled)) return "ملغى";
        var active = ds.Where(d => !IsTerminal(d)).ToList();
        if (active.Count == 0) return "مغلق";

        if (active.Any(d => d.MaintenancePaused || d.CurrentStatus == "معلق")) return "معلق";
        if (active.Any(d => d.CurrentStatus == "تعذر الصيانة المحلية")) return "جاهز للإرسال للصيانة";
        if (active.Any(d => (d.CurrentLocation == "في الطريق للصيانة" || d.CurrentLocation == "في الطريق إلى الصيانة"))) return "في الطريق للصيانة";
        if (active.Any(d => d.CurrentLocation == "مركز الصيانة" && d.MaintenanceReceivedAt.HasValue && !d.MaintenanceStartedAt.HasValue && !d.MaintenanceCompletedAt.HasValue)) return "بانتظار بدء الصيانة";
        if (active.Any(d => d.CurrentStatus == "جاري الصيانة محليًا")) return "قيد الصيانة محليًا";
        if (active.Any(d => d.CurrentStatus == "جاهز للصيانة" && d.MaintenanceRoute == "صيانة محلية" && d.AssignedTechnicianId.HasValue)) return "جاهز للصيانة محليًا";
        if (active.Any(d => d.AssignedTechnicianId.HasValue || (d.MaintenanceStartedAt.HasValue && !d.MaintenanceCompletedAt.HasValue) || d.CurrentStatus is "جاري الصيانة" or "فحص بدون صيانة")) return "قيد الصيانة";

        if (active.Any(d => d.CurrentLocation == "في الطريق للفرع")) return "في الطريق للفرع";
        if (active.Any(d => d.CurrentLocation == "مستودع الأجهزة الجاهزة للإرجاع" && d.CurrentStatus == "جاهز للإرسال")) return "جاهز للإرسال";
        if (active.Any(d => d.CurrentStatus == "تمت الصيانة محليًا")) return "تمت الصيانة محليًا";
        if (active.Any(d => d.CurrentLocation == "الفرع" && d.CurrentStatus == "مستلم بالفرع")) return "مستلم بالفرع";
        return "جديد";
    }
}
