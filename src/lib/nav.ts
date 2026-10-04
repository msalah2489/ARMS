import type { AppRole } from "@/types/domain";
import {
  ClipboardList,
  Cpu,
  LayoutDashboard,
  Package,
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
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [
      "manager",
      "supervisor",
      "technician",
      "branch_employee",
      "service_center_employee",
    ],
  },
  {
    href: "/service-requests",
    label: "Service requests",
    icon: ClipboardList,
    roles: [
      "manager",
      "supervisor",
      "technician",
      "branch_employee",
      "service_center_employee",
    ],
  },
  {
    href: "/devices",
    label: "Devices",
    icon: Cpu,
    roles: [
      "manager",
      "supervisor",
      "technician",
      "branch_employee",
      "service_center_employee",
    ],
  },
  {
    href: "/scan",
    label: "Scan device",
    icon: QrCode,
    roles: ["technician", "branch_employee", "service_center_employee"],
  },
  {
    href: "/customers",
    label: "Customers",
    icon: Users,
    roles: ["manager", "supervisor", "branch_employee"],
  },
  {
    href: "/branches",
    label: "Branches",
    icon: Store,
    roles: ["manager", "supervisor", "branch_employee"],
  },
  {
    href: "/movements",
    label: "Device movements",
    icon: Truck,
    roles: ["manager", "supervisor", "technician", "service_center_employee"],
  },
  {
    href: "/spare-parts",
    label: "Spare parts",
    icon: Package,
    roles: ["manager", "supervisor", "technician"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: Wrench,
    roles: ["manager", "supervisor"],
  },
  {
    href: "/settings",
    label: "Configuration",
    icon: Settings,
    roles: ["manager"],
  },
];

export function navForRole(role: AppRole) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
