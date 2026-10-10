export type AppRole =
  | "system_admin"
  | "maintenance_manager"
  | "branch"
  | "technician"
  | "maintenance_supervisor"
  | "mobile_technician"
  /** مندوب الاستلام — courier handheld receipt forms */
  | "pickup_courier"
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
  /** 1 تم الاستلام — location: branch */
  | "received_at_branch"
  /** 2 جاري الإرسال — location: in_transit_to_service */
  | "in_transit_to_service"
  /** 3 بانتظار الصيانة — location: service_center */
  | "awaiting_maintenance"
  /** 4 جاري الصيانة — location: service_center */
  | "in_maintenance"
  /** جاري الصيانة بالفرع — location: branch (mobile technician path) */
  | "in_maintenance_at_branch"
  /** تعذر الصيانة — location: branch (mobile tech could not repair) */
  | "maintenance_failed"
  /** 5 جاهز للإرجاع — location: service_center (no return waybill yet) */
  | "ready_to_return"
  /** 6 معلق لدى المشرف — location: service_center */
  | "awaiting_manager_decision"
  /** 7 جاري الإرجاع — location: in_return_transit */
  | "in_return_transit"
  /** 8 بانتظار التسليم للعميل — location: branch */
  | "awaiting_customer"
  /** 9 منتهي — location: customer */
  | "delivered_to_customer"
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

/** Optional employee gender (for display symbol only; no default avatar). */
export type UserGender = "male" | "female";

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
  /** Effective permission keys (role template + admin overrides). */
  permissions?: string[];
  /** Optional gender: male ♂ / female ♀ */
  gender?: UserGender | null;
  /** Optional personal photo (compressed data URL). */
  photoDataUrl?: string | null;
  photoName?: string | null;
};

/** Roles an admin can assign when creating users */
export type AssignableUserRole =
  | "system_admin"
  | "maintenance_manager"
  | "maintenance_supervisor"
  | "branch"
  | "technician"
  | "mobile_technician"
  | "pickup_courier";

export type ManagedUser = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  mobile: string;
  role: AssignableUserRole;
  /** Effective permission keys (role defaults + per-user toggles). */
  permissions?: string[];
  opsBranchId: string | null;
  opsBranchName: string | null;
  password: string;
  isActive: boolean;
  /** Soft-delete: hidden from active lists, history kept */
  isArchived: boolean;
  /** Optional gender: male ♂ / female ♀ */
  gender?: UserGender | null;
  /** Optional personal photo (compressed data URL). */
  photoDataUrl?: string | null;
  photoName?: string | null;
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
  /** Canonical maintenance lifecycle (9-step display source of truth) */
  lifecycleStatus?: DeviceLifecycleStatus;
  currentLocation: string;
  qrCode: string;
  /** Compressed device photo (data URL) when available */
  imageDataUrl?: string;
  /** Parent maintenance request when device comes from ops cache */
  requestId?: string;
  requestNumber?: string;
  /** Ops branch id when device comes from maintenance requests cache */
  opsBranchId?: string;
};

export type ServiceRequestDeviceLifecycle = {
  deviceCode: string;
  status: DeviceLifecycleStatus;
};

export type ServiceRequest = {
  id: string;
  requestNumber: string;
  customerName: string;
  branchName: string;
  deviceCode: string;
  serialNumber: string;
  reportedProblem: string;
  /** Number of devices on the request (list shows count, not a single device). */
  deviceCount: number;
  priority: RequestPriority;
  status: ServiceRequestStatus;
  assignedTechnician: string | null;
  requestedAt: string;
  /**
   * Latest status-related timestamp available on the request/devices
   * (receivedAt, maintenanceStartedAt, maintenanceFinishedAt).
   */
  statusAt: string;
  /** Ops-backed rows only — used by list quick filters */
  assignmentPath?: MaintenanceAssignmentPath | null;
  hasAwaitingMaintenance?: boolean;
  hasOnHold?: boolean;
  /** Ops branch id for branch-employee list scoping */
  opsBranchId?: string;
  /** Per-device canonical lifecycle (list "الحالة" column) */
  deviceLifecycles?: ServiceRequestDeviceLifecycle[];
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
  /** Alert when quantity is at or below this threshold (default 2). */
  minimumQuantity: number;
  updatedAt: string;
};

/** Lightweight stock of replaced / swapped customer devices held at service. */
export type ReplacedDeviceStockItem = {
  id: string;
  deviceTypeName: string;
  modelName?: string;
  serialOrCode?: string;
  quantity: number;
  notes?: string;
  updatedAt: string;
  createdAt: string;
  createdById?: string;
  createdByName?: string;
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
  /**
   * Stable device identity for QR deep links (usually equals localId).
   * QR encodes a URL only — authorization happens at scan time from session.
   */
  qrToken?: string;
  /** ISO timestamp when branch staff printed (or confirmed) the device QR label */
  qrPrintedAt?: string | null;
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

/** Direction of a pickup-courier receipt form (نموذج استلام) */
export type PickupReceiptDirection = "branch_to_center" | "center_to_branch";

/**
 * Receipt form lifecycle:
 * draft → pending_courier → (partially_rejected → edit → pending_courier)* → approved
 * → pending_supervisor (outbound handover) → received_at_center
 * → received_at_branch (return confirm) | cancelled
 */
export type PickupReceiptStatus =
  | "draft"
  | "pending_courier"
  | "partially_rejected"
  | "approved"
  | "pending_supervisor"
  | "received_at_center"
  | "received_at_branch"
  | "cancelled";

export type PickupReceiptLineStatus = "included" | "rejected" | "approved";

export type PickupReceiptLine = {
  id: string;
  deviceLocalId: string;
  deviceCode: string;
  modelName: string;
  color: string;
  requestId: string;
  requestNumber: string;
  status: PickupReceiptLineStatus;
  rejectReason?: string | null;
};

export type PickupReceipt = {
  id: string;
  receiptNumber: string;
  direction: PickupReceiptDirection;
  opsBranchId: string;
  opsBranchName: string;
  createdBy: string;
  createdByName: string;
  assignedCourierId: string;
  assignedCourierName: string;
  /** When return is carried by a technician instead of pickup_courier */
  assignedCarrierRole?: AppRole | string | null;
  status: PickupReceiptStatus;
  createdAt: string;
  submittedAt?: string | null;
  courierReviewedAt?: string | null;
  courierReviewedBy?: string | null;
  courierReviewedByName?: string | null;
  notes?: string;
  /** Technician requested تسليم للصيانة */
  handoverRequestedBy?: string | null;
  handoverRequestedByName?: string | null;
  handoverRequestedAt?: string | null;
  handoverApprovedBy?: string | null;
  handoverApprovedByName?: string | null;
  handoverApprovedAt?: string | null;
  /** Branch confirmed return delivery */
  branchReceivedAt?: string | null;
  branchReceivedBy?: string | null;
  branchReceivedByName?: string | null;
  lines: PickupReceiptLine[];
};
