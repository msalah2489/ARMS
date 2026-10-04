export type AppRole =
  | "manager"
  | "supervisor"
  | "technician"
  | "branch_employee"
  | "service_center_employee";

export type DeviceStatus =
  | "new"
  | "installed"
  | "active"
  | "under_maintenance"
  | "waiting_for_spare_parts"
  | "sent_to_service_center"
  | "under_service_center_maintenance"
  | "ready"
  | "returned"
  | "damaged"
  | "non_repairable"
  | "retired";

export type ServiceRequestStatus =
  | "new"
  | "in_review"
  | "assigned"
  | "in_progress"
  | "waiting_parts"
  | "dispatched"
  | "at_service_center"
  | "testing"
  | "completed"
  | "closed"
  | "cancelled";

export type RequestPriority = "low" | "normal" | "high" | "urgent";

export type Profile = {
  id: string;
  fullName: string;
  role: AppRole;
  email: string;
};

export type Customer = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  branchCount: number;
  deviceCount: number;
};

export type Branch = {
  id: string;
  customerId: string;
  customerName: string;
  name: string;
  code: string;
  address: string;
  phone: string;
};

export type Device = {
  id: string;
  deviceCode: string;
  serialNumber: string;
  modelName: string;
  brand: string;
  color: string;
  customerName: string;
  branchName: string;
  status: DeviceStatus;
  currentLocation: string;
  qrCode: string;
};

export type ServiceRequest = {
  id: string;
  requestNumber: string;
  customerName: string;
  branchName: string;
  deviceCode: string;
  serialNumber: string;
  reportedProblem: string;
  priority: RequestPriority;
  status: ServiceRequestStatus;
  assignedTechnician: string | null;
  requestedAt: string;
};

export type SparePart = {
  id: string;
  partCode: string;
  name: string;
  brand: string;
  stockQuantity: number;
  minimumStock: number;
  unit: string;
};

export type DashboardStats = {
  openRequests: number;
  devicesUnderMaintenance: number;
  dispatchedDevices: number;
  lowStockParts: number;
  activeDevices: number;
  completedThisMonth: number;
};
