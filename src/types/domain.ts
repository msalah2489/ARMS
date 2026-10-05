export type AppRole =
  | "system_admin"
  | "maintenance_manager"
  | "branch"
  | "technician"
  | "maintenance_supervisor"
  | "mobile_technician"
  // legacy roles still present in older data
  | "manager"
  | "supervisor"
  | "branch_employee"
  | "service_center_employee";

export type BranchPriority = "normal" | "urgent";

export type ExternalCondition =
  | "intact"
  | "broken"
  | "scratched"
  | "leak_marks"
  | "other";

export type DeviceLifecycleStatus =
  | "received_at_branch"
  | "awaiting_branch_handover"
  | "handed_to_carrier"
  | "in_transit_to_service"
  | "received_at_warehouse"
  | "at_service_center"
  | "awaiting_maintenance"
  | "in_maintenance"
  | "ready_to_return"
  | "in_return_transit"
  | "received_at_destination"
  | "excluded_from_shipment"
  | "ready_to_send"
  | "excluded"
  // legacy aliases kept for older local data
  | "ready_to_ship"
  | "in_shipping"
  | "under_maintenance"
  | "returning_from_service"
  | "delivered_to_customer";

export type ShipmentDirection = "inbound" | "to_service" | "return";
export type ShippingBatchStatus = "draft" | "ready" | "handed_to_carrier" | "received" | "cancelled";
export type ShippingItemStatus = "active" | "removed";

export type ShippingBatchItem = {
  id: string;
  requestDeviceId: string;
  deviceCode: string;
  modelName: string;
  color: string;
  status: ShippingItemStatus;
  removedAt?: string | null;
  removedBy?: string | null;
  removalReason?: string | null;
};

export type ShippingBatch = {
  id: string;
  batchNumber: string;
  shipmentNumber: string;
  carrier: string;
  direction: ShipmentDirection;
  sourceType: string;
  sourceName: string;
  opsBranchId: string;
  destinationType: string;
  destinationName: string;
  status: ShippingBatchStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  handedToCarrierAt?: string | null;
  handedToCarrierBy?: string | null;
  receivedAt?: string | null;
  receivedBy?: string | null;
  receivedByName?: string | null;
  notes?: string;
  items: ShippingBatchItem[];
};

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
  opsBranchId?: string | null;
  opsBranchName?: string | null;
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

export type CatalogItem = { id: string; name: string };
export type ModelItem = CatalogItem & {
  deviceTypeId: string;
  brandId: string;
  accessories: CatalogItem[];
};

export type DraftRequestDevice = {
  localId: string;
  deviceCode: string;
  deviceTypeId: string;
  deviceTypeName: string;
  brandId: string;
  brandName: string;
  modelId: string;
  modelName: string;
  serialNumber: string;
  fault: string;
  externalCondition: ExternalCondition;
  accessoryIds: string[];
  accessoryNames: string[];
  extraDetails: string;
  devicePhotoNames: string[];
  receiptNumber: string;
  receiptPhotoName: string;
  color?: string;
  currentLocation?: string;
  lockedAfterShip?: boolean;
  lifecycleStatus?: DeviceLifecycleStatus;
  assignedTechnicianId?: string | null;
  assignedTechnicianName?: string | null;
};

export type TechnicianExternalCheck = "damaged" | "intact";
export type TechnicianDeviceState = "works_fine" | "start_maintenance";
export type DamageOption = "break" | "scratches" | "leak" | "missing_part" | "other";
export type MaintenanceOutcome =
  | "repaired"
  | "no_repair_needed"
  | "issue_persists"
  | "not_repairable";
export type HoldReason =
  | "no_spare_parts"
  | "unrepairable_fault"
  | "fully_damaged"
  | "other";

export type TechnicianWorkRecord = {
  id: string;
  requestId: string;
  requestNumber: string;
  deviceLocalId: string;
  deviceCode: string;
  technicianId: string;
  technicianName: string;
  startedAt: string;
  finishedAt?: string;
  status: "in_progress" | "completed" | "held";
  externalCheck?: TechnicianExternalCheck;
  damageOptions?: DamageOption[];
  damageOtherNote?: string;
  deviceState?: TechnicianDeviceState;
  tests?: Record<"power" | "pump" | "light" | "sound" | "programming", boolean | null>;
  faultCause?: string;
  actionTaken?: string;
  actionOther?: string;
  sparePartsUsed?: Array<{ partId: string; partName: string; qty: number }>;
  returnedAccessories?: Array<{ accessoryId: string; accessoryName: string; returned: boolean; notReturnedReason?: string }>;
  outcome?: MaintenanceOutcome;
  holdReason?: HoldReason;
  holdOtherNote?: string;
};

export type MaintenanceRequestRecord = {
  id: string;
  requestNumber: string;
  receivedAt: string;
  opsBranchId: string;
  opsBranchName: string;
  branchStaffId: string;
  branchStaffName: string;
  priority: BranchPriority;
  customerMobile: string;
  contactName: string;
  purchaseInvoice: string;
  generalNotes: string;
  devices: DraftRequestDevice[];
};

/** @deprecated use ShippingBatch — kept for older local keys */
export type WaybillRecord = {
  id: string;
  waybillNumber: string;
  courierCompany: string;
  opsBranchId: string;
  deviceCodes: string[];
  removedDeviceCodes: Array<{ deviceCode: string; note: string }>;
};
