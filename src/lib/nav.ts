import type { AppRole } from "@/types/domain";
import { normalizeRole } from "@/lib/auth";
import {
  ClipboardList,
  Cpu,
  FilePlus2,
  LayoutDashboard,
  Package,
  PackageCheck,
  QrCode,
  Settings,
  Store,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: AppRole[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "الرئيسية",
    icon: LayoutDashboard,
    roles: [
      "branch",
      "branch_employee",
      "system_admin",
      "manager",
      "maintenance_manager",
      "maintenance_supervisor",
      "supervisor",
      "technician",
      "mobile_technician",
    ],
  },
  {
    href: "/technician/work",
    label: "عمل الفني",
    icon: Wrench,
    roles: ["technician", "mobile_technician", "system_admin", "manager"],
  },
  {
    href: "/scan",
    label: "سكان الجهاز",
    icon: QrCode,
    roles: [
      "branch",
      "branch_employee",
      "technician",
      "mobile_technician",
      "maintenance_supervisor",
      "supervisor",
      "system_admin",
      "manager",
    ],
  },
  {
    href: "/service-requests/new",
    label: "إنشاء طلب",
    icon: FilePlus2,
    roles: ["branch", "branch_employee", "system_admin", "manager"],
  },
  {
    href: "/branch/receiving",
    label: "استلام الصيانة",
    icon: PackageCheck,
    roles: ["branch", "branch_employee", "system_admin", "manager"],
  },
  {
    href: "/branch/shipping",
    label: "شحن الصيانة",
    icon: Truck,
    roles: ["branch", "branch_employee", "maintenance_manager", "system_admin", "manager"],
  },
  {
    href: "/reports",
    label: "التقارير",
    icon: ClipboardList,
    roles: [
      "branch",
      "branch_employee",
      "system_admin",
      "manager",
      "maintenance_manager",
      "maintenance_supervisor",
      "supervisor",
    ],
  },
  {
    href: "/service-requests",
    label: "طلبات الصيانة",
    icon: ClipboardList,
    roles: [
      "system_admin",
      "manager",
      "maintenance_manager",
      "maintenance_supervisor",
      "supervisor",
    ],
  },
  {
    href: "/devices",
    label: "الأجهزة",
    icon: Cpu,
    roles: [
      "system_admin",
      "manager",
      "maintenance_manager",
      "maintenance_supervisor",
      "supervisor",
    ],
  },
  {
    href: "/customers",
    label: "العملاء",
    icon: Users,
    roles: ["system_admin", "manager", "maintenance_manager"],
  },
  {
    href: "/branches",
    label: "الفروع",
    icon: Store,
    roles: ["system_admin", "manager", "maintenance_manager"],
  },
  {
    href: "/spare-parts",
    label: "قطع الغيار",
    icon: Package,
    roles: ["system_admin", "manager", "maintenance_manager"],
  },
  {
    href: "/settings",
    label: "إعدادات النظام",
    icon: Settings,
    roles: ["system_admin", "manager"],
  },
];

export function navForRole(role: AppRole) {
  const normalized = normalizeRole(role);
  return NAV_ITEMS.filter((item) => item.roles.includes(role) || item.roles.includes(normalized));
}
