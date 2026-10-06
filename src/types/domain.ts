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

/** How the branch routes devices after registering a maintenance request */
export type MaintenanceAssignmentPath = "mobile_technician" | "service_center";

export type ExternalCondition =
  | "intact"
  | "broken"
  | "scratched"
  | "leak_marks"
  | "other";

export type DeviceLifecycleStatus =
  /** مستلم بالفرع — location: branch */
  | "received_at_branch"
  /** جاري الشحن — location: in_transit_to_service */
  | "in_transit_to_service"
  /** بانتظار الصيانة — location: service_center */
  | "awaiting_maintenance"
  /** جاري الصيانة — location: service_center */
  | "in_maintenance"
  /** جاري الصيانة بالفرع — location: branch (mobile technician path) */
  | "in_maintenance_at_branch"
  /** تعذر الصيانة — location: branch (mobile tech could not repair) */
  | "maintenance_failed"
  /** فى الطريق الى الفرع — location: in_return_transit */
  | "in_return_transit"
  /** بانتظار العميل — location: branch */
  | "awaiting_customer"
  /** معلق — location: service_center */
  | "awaiting_manager_decision"
  /** Internal: repaired / approved, waiting for return waybill */
  | "ready_to_return"
  | "excluded_from_shipment"
  | "ready_to_send"
  | "excluded"
  // legacy aliases kept for older local data / migration
  | "awaiting_branch_handover"
  | "handed_to_carrier"
  | "received_at_warehouse"
  | "at_service_center"
  | "received_at_destination"
  | "received_damaged"
  | "ready_to_ship"
  | "in_shipping"
  | "under_maintenance"
  | "returning_from_service"
  | "delivered_to_customer"
  | "closed";

/** Maintenance manager decision for held / failed / missing-return devices */
export type ManagerDeviceDecision =
  | "requeue_technician"
  | "approve_return"
  | "close_case";

export type ShipmentDirection = "inbound" | "to_service" | "return";
export type ShippingBatchStatus = "draft" | "ready" | "handed_to_carrier" | "received" | "cancelled";
export type ShippingItemStatus = "active" | "removed";
export type BranchReturnReceiveOutcome = "intact" | "damaged" | "not_received";

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
  branchReceiveOutcome?: BranchReturnReceiveOutcome | null;
  branchReceiveReason?: string | null;
  branchReceivedAt?: string | null;
  branchReceivedBy?: string | null;
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
  username?: string | null;
  role: AppRole;
  email: string;
  mobile?: string | null;
  opsBranchId?: string | null;
  opsBranchName?: string | null;
  isActive?: boolean;
};

/** Roles an admin can assign when creating users */
export type AssignableUserRole =
  | "system_admin"
  | "maintenance_manager"
  | "maintenance_supervisor"
  | "branch"
  | "technician"
  | "mobile_technician";

export type ManagedUser = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  mobile: string;
  role: AssignableUserRole;
  opsBranchId: string | null;
  opsBranchName: string | null;
  password: string;
  isActive: boolean;
  /** Soft-delete: hidden from active lists, history kept */
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OpsBranchRecord = {
  id: string;
  name: string;
  city: string;
  code: string;
  isServiceCenter: boolean;
  /** Soft-disable: kept for history, filtered from active pickers */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  /** Compressed device photo (data URL) when available */
  imageDataUrl?: string;
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

/** Inventory balance keyed by device model + catalog spare part */
export type SpareInventoryBalance = {
  id: string;
  modelId: string;
  modelName: string;
  partId: string;
  partName: string;
  color?: string;
  quantity: number;
  updatedAt: string;
};

export type SpareReceiveLine = {
  modelId: string;
  modelName: string;
  partId: string;
  partName: string;
  color?: string;
  quantity: number;
};

export type SpareReceiveReceipt = {
  id: string;
  receiptNumber: string;
  receiptDate: string;
  supplier: string;
  receiptPhotoName: string;
  receiptPhotoDataUrl: string;
  lines: SpareReceiveLine[];
  /** @deprecated legacy single-line receipts */
  modelId?: string;
  modelName?: string;
  partId?: string;
  partName?: string;
  color?: string;
  quantity?: number;
  receivedById: string;
  receivedByName: string;
  createdAt: string;
};

export type SpareStockMovement = {
  id: string;
  type: "receive" | "consume";
  balanceId: string;
  modelId: string;
  modelName: string;
  partId: string;
  partName: string;
  color?: string;
  quantity: number;
  reference?: string;
  actorId: string;
  actorName: string;
  createdAt: string;
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
export type SparePartItem = CatalogItem & {
  /** Optional color for the spare part */
  color?: string;
  /** Optional compressed image (data URL) */
  imageDataUrl?: string;
};
export type AccessoryItem = CatalogItem & {
  /** Optional color for the accessory */
  color?: string;
};
export type ModelItem = CatalogItem & {
  deviceTypeId: string;
  brandId: string;
  /** Required catalog/model photo (compressed data URL) */
  imageDataUrl?: string;
  accessories: AccessoryItem[];
  spareParts: SparePartItem[];
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
  /** @deprecated prefer deviceImageDataUrl — kept for older local data */
  devicePhotoNames: string[];
  /** Required compressed device photo (data URL) */
  deviceImageDataUrl?: string;
  deviceImageName?: string;
  receiptNumber: string;
  receiptPhotoName: string;
  /** Compressed receipt photo (data URL) */
  receiptPhotoDataUrl?: string;
  color?: string;
  currentLocation?: string;
  lockedAfterShip?: boolean;
  lifecycleStatus?: DeviceLifecycleStatus;
  /** mobile_technician | service_center — copied from the parent request */
  assignmentPath?: MaintenanceAssignmentPath | null;
  assignedTechnicianId?: string | null;
  assignedTechnicianName?: string | null;
  /** ISO timestamp when a technician claimed/started work on this device */
  maintenanceStartedAt?: string | null;
  /** ISO timestamp when maintenance work ended (complete / hold / failed) */
  maintenanceFinishedAt?: string | null;
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
  sparePartsUsed?: Array<{ partId: string; partName: string; qty: number; color?: string }>;
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
  /** Required: assign to mobile tech at branch OR ship to service center */
  assignmentPath?: MaintenanceAssignmentPath;
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
