using ARMS.Web.Components;
using ARMS.Web.Data;
using ARMS.Web.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddRazorComponents().AddInteractiveServerComponents();
builder.Services.AddDbContextFactory<ArmsDbContext>(options => options.UseSqlite("Data Source=App_Data/arms.db"));

var app = builder.Build();
Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "App_Data"));
app.UseStaticFiles();
app.UseAntiforgery();

using (var scope = app.Services.CreateScope())
{
    var factory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<ArmsDbContext>>();
    await DbSeeder.SeedAsync(factory);
    await using var db = await factory.CreateDbContextAsync();

    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS UserAccounts (Id INTEGER NOT NULL CONSTRAINT PK_UserAccounts PRIMARY KEY AUTOINCREMENT, Username TEXT NOT NULL, FullName TEXT NOT NULL, Role TEXT NOT NULL, Branch TEXT NOT NULL, PasswordHash TEXT NOT NULL, PasswordChangedAt TEXT NULL, Email TEXT NOT NULL DEFAULT '', Phone TEXT NOT NULL DEFAULT '', Theme TEXT NOT NULL DEFAULT 'light', CanReturnDevices INTEGER NOT NULL DEFAULT 1);");
    await AddColumnIfMissing(db, "UserAccounts", "Email", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "UserAccounts", "Phone", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "UserAccounts", "Theme", "TEXT NOT NULL DEFAULT 'light'");
    await AddColumnIfMissing(db, "UserAccounts", "CanReturnDevices", "INTEGER NOT NULL DEFAULT 1");
    await AddColumnIfMissing(db, "UserAccounts", "BranchId", "INTEGER NULL");
    await AddColumnIfMissing(db, "UserAccounts", "IsActive", "INTEGER NOT NULL DEFAULT 1");
    await AddColumnIfMissing(db, "UserAccounts", "MaintenanceCenterId", "INTEGER NULL");

    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS Branches (Id INTEGER NOT NULL CONSTRAINT PK_Branches PRIMARY KEY AUTOINCREMENT, Code TEXT NOT NULL, Name TEXT NOT NULL, City TEXT NOT NULL, IsActive INTEGER NOT NULL DEFAULT 1, IsMaintenanceCenter INTEGER NOT NULL DEFAULT 0);");
    await AddColumnIfMissing(db, "Branches", "IsMaintenanceCenter", "INTEGER NOT NULL DEFAULT 0");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS Notifications (Id INTEGER NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY AUTOINCREMENT, Message TEXT NOT NULL, TargetUrl TEXT NOT NULL, Type TEXT NOT NULL DEFAULT 'info', IsRead INTEGER NOT NULL DEFAULT 0, CreatedAt TEXT NOT NULL);");
    // Secure login sessions: the browser only ever stores this random Token, never a username or password.
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS UserSessions (Id INTEGER NOT NULL CONSTRAINT PK_UserSessions PRIMARY KEY AUTOINCREMENT, Token TEXT NOT NULL, UserId INTEGER NOT NULL, CreatedAt TEXT NOT NULL, ExpiresAt TEXT NOT NULL);");
    await db.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX IF NOT EXISTS IX_UserSessions_Token ON UserSessions (Token);");
    await db.Database.ExecuteSqlRawAsync("DELETE FROM UserSessions WHERE ExpiresAt < datetime('now');");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS DeviceComments (Id INTEGER NOT NULL CONSTRAINT PK_DeviceComments PRIMARY KEY AUTOINCREMENT, ServiceDeviceId INTEGER NOT NULL, Text TEXT NOT NULL, CreatedBy TEXT NOT NULL, CreatedByRole TEXT NOT NULL, CreatedAt TEXT NOT NULL);");
    await AddColumnIfMissing(db, "ServiceDevices", "Color", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "CurrentLocation", "TEXT NOT NULL DEFAULT 'الفرع'");
    await AddColumnIfMissing(db, "ServiceDevices", "CurrentStatus", "TEXT NOT NULL DEFAULT 'مستلم بالفرع'" );
    await AddColumnIfMissing(db, "ServiceDevices", "MaintenanceRoute", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "LocalMaintenanceFailureReason", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "LocalMaintenanceCompletedAt", "TEXT NULL");

    if (!await db.Branches.AnyAsync())
    {
        db.Branches.AddRange(new Branch { Code="RYD-01", Name="فرع الرياض", City="الرياض" }, new Branch { Code="JED-01", Name="فرع جدة", City="جدة" }, new Branch { Code="DMM-01", Name="فرع الدمام", City="الدمام" });
        await db.SaveChangesAsync();
    }



    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS Customers (Id INTEGER NOT NULL CONSTRAINT PK_Customers PRIMARY KEY AUTOINCREMENT, Name TEXT NOT NULL, Phone TEXT NOT NULL, Email TEXT NOT NULL DEFAULT '', Branch TEXT NOT NULL DEFAULT 'الرياض', Notes TEXT NOT NULL DEFAULT '');");
    await db.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX IF NOT EXISTS IX_Customers_Phone ON Customers (Phone);");

    await AddColumnIfMissing(db, "ServiceRequests", "ServiceType", "TEXT NOT NULL DEFAULT 'صيانة أجهزة التعطير'");
    await AddColumnIfMissing(db, "ServiceRequests", "IntakeSource", "TEXT NOT NULL DEFAULT 'فرع'");
    await AddColumnIfMissing(db, "ServiceRequests", "OriginName", "TEXT NOT NULL DEFAULT ''");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS ShippingBatches (Id INTEGER NOT NULL CONSTRAINT PK_ShippingBatches PRIMARY KEY AUTOINCREMENT, BatchNumber TEXT NOT NULL, ShipmentNumber TEXT NOT NULL DEFAULT '', Carrier TEXT NOT NULL DEFAULT '', Direction TEXT NOT NULL DEFAULT 'وارد', SourceType TEXT NOT NULL DEFAULT '', SourceName TEXT NOT NULL DEFAULT '', DestinationType TEXT NOT NULL DEFAULT '', DestinationName TEXT NOT NULL DEFAULT '', Status TEXT NOT NULL DEFAULT 'مسودة', CreatedAt TEXT NOT NULL, CreatedBy TEXT NOT NULL DEFAULT '', HandedToCarrierAt TEXT NULL, HandedToCarrierBy TEXT NOT NULL DEFAULT '', ReceivedAt TEXT NULL, ReceivedBy TEXT NOT NULL DEFAULT '', ParentBatchId INTEGER NULL, Notes TEXT NOT NULL DEFAULT '');");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS ShippingBatchItems (Id INTEGER NOT NULL CONSTRAINT PK_ShippingBatchItems PRIMARY KEY AUTOINCREMENT, ShippingBatchId INTEGER NOT NULL, ServiceDeviceId INTEGER NOT NULL, DeviceCodeSnapshot TEXT NOT NULL DEFAULT '', ModelSnapshot TEXT NOT NULL DEFAULT '', ColorSnapshot TEXT NOT NULL DEFAULT '', Status TEXT NOT NULL DEFAULT 'ضمن الشحنة', RemovedAt TEXT NULL, RemovedBy TEXT NOT NULL DEFAULT '', RemovalReason TEXT NOT NULL DEFAULT '');");
    await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS IX_ShippingBatchItems_Batch ON ShippingBatchItems (ShippingBatchId);");
    await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS IX_ShippingBatchItems_Device ON ShippingBatchItems (ServiceDeviceId);");
    // V2.4.24 workflow integrity: serial/device codes and manual customer receipts must not duplicate.
    // Empty serials are allowed (e.g. fragrance-service devices before a technician assigns a QR/serial).
    try { await db.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX IF NOT EXISTS IX_ServiceDevices_DeviceCode_Unique ON ServiceDevices(DeviceCode) WHERE trim(DeviceCode) <> '';"); } catch (Microsoft.Data.Sqlite.SqliteException) { }
    try
    {
        await db.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX IF NOT EXISTS IX_ServiceDevices_Serial_Unique ON ServiceDevices(SerialNumber) WHERE trim(SerialNumber) <> '';");
    }
    catch (Microsoft.Data.Sqlite.SqliteException)
    {
        // Keep startup working if an old database already contains duplicate serials; the application
        // validation still blocks new duplicates until the legacy data is cleaned up.
    }
    await AddColumnIfMissing(db, "ServiceRequests", "DispatchReportPrintedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceRequests", "SentAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "ReturnedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "ReturnReason", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "ReturnedBy", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "AssignedTechnicianId", "INTEGER NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "AssignedTechnicianName", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "MaintenanceStartedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "MaintenanceCompletedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "MaintenancePaused", "INTEGER NOT NULL DEFAULT 0");
    await AddColumnIfMissing(db, "ServiceDevices", "MaintenanceNotes", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "MaintenanceTestsJson", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "DispatchBatchCode", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "MaintenanceReceivedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "BranchReceivedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "BranchReceivedBy", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "CustomerDeliveredAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "CustomerDeliveredBy", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "MaintenanceReceivedBy", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "MaintenancePauseReason", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "TechnicianReceivedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "TechnicianExternalCondition", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "TechnicianDamageTypes", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "TechnicianDecision", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "FaultCause", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "RepairAction", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "ConsumedParts", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "MaintenanceResult", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "ReplacementReason", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "ReplacementNotes", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "ReplacementDeviceId", "INTEGER NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "ReplacedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "ReplacedBy", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "ScrapReason", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "ScrapNotes", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "ScrappedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "ScrappedBy", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "ReplacementSource", "TEXT NOT NULL DEFAULT 'خارجي'");
    await AddColumnIfMissing(db, "ServiceDevices", "ReplacementCondition", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "ReplacementBarcodePrintedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "ReturnedAccessories", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "CustomerReceiptNumber", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "CustomerReceiptImagePath", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "CustomerReceiptReceivedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "CustomerDeliveryReceiptNumber", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "CustomerDeliveryReceiptImagePath", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "CustomerDeliveryReceiptAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ServiceDevices", "AccessoryReturnReasons", "TEXT NOT NULL DEFAULT ''");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS DiagnosticQuestions (Id INTEGER NOT NULL CONSTRAINT PK_DiagnosticQuestions PRIMARY KEY AUTOINCREMENT, DeviceModelId INTEGER NOT NULL, QuestionText TEXT NOT NULL, AnswerType TEXT NOT NULL DEFAULT 'نعم/لا', SortOrder INTEGER NOT NULL DEFAULT 0, IsActive INTEGER NOT NULL DEFAULT 1);");
    await AddColumnIfMissing(db, "DiagnosticQuestions", "YesNextQuestionId", "INTEGER NULL");
    await AddColumnIfMissing(db, "DiagnosticQuestions", "NoNextQuestionId", "INTEGER NULL");
    await AddColumnIfMissing(db, "DiagnosticQuestions", "YesResultText", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "DiagnosticQuestions", "NoResultText", "TEXT NOT NULL DEFAULT ''");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS DiagnosticOptions (Id INTEGER NOT NULL CONSTRAINT PK_DiagnosticOptions PRIMARY KEY AUTOINCREMENT, DiagnosticQuestionId INTEGER NOT NULL, OptionText TEXT NOT NULL, SortOrder INTEGER NOT NULL DEFAULT 0, IsActive INTEGER NOT NULL DEFAULT 1);");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS DiagnosticProblems (Id INTEGER NOT NULL CONSTRAINT PK_DiagnosticProblems PRIMARY KEY AUTOINCREMENT, DeviceModelId INTEGER NOT NULL, ProblemName TEXT NOT NULL, Cause TEXT NOT NULL DEFAULT '', Solution TEXT NOT NULL DEFAULT '', IsActive INTEGER NOT NULL DEFAULT 1);");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS DiagnosticRules (Id INTEGER NOT NULL CONSTRAINT PK_DiagnosticRules PRIMARY KEY AUTOINCREMENT, DiagnosticProblemId INTEGER NOT NULL, DiagnosticQuestionId INTEGER NOT NULL, ExpectedAnswer TEXT NOT NULL, Classification TEXT NOT NULL DEFAULT 'محتملة جدًا', IsActive INTEGER NOT NULL DEFAULT 1);");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS DeviceStatusHistories (Id INTEGER NOT NULL CONSTRAINT PK_DeviceStatusHistories PRIMARY KEY AUTOINCREMENT, ServiceDeviceId INTEGER NOT NULL, ServiceRequestId INTEGER NULL, Status TEXT NOT NULL, Location TEXT NOT NULL, StartedAt TEXT NOT NULL, EndedAt TEXT NULL, ChangedBy TEXT NOT NULL DEFAULT '', Notes TEXT NOT NULL DEFAULT '');");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS DeviceReceipts (Id INTEGER NOT NULL CONSTRAINT PK_DeviceReceipts PRIMARY KEY AUTOINCREMENT, ServiceDeviceId INTEGER NOT NULL, ReceiptType TEXT NOT NULL, ReceiptNumber TEXT NOT NULL, ImagePath TEXT NOT NULL, ReceiptDate TEXT NOT NULL, RecordedBy TEXT NOT NULL DEFAULT '');");
    try
    {
        await db.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX IF NOT EXISTS IX_DeviceReceipts_Number_Unique ON DeviceReceipts(ReceiptNumber) WHERE trim(ReceiptNumber) <> '';");
    }
    catch (Microsoft.Data.Sqlite.SqliteException)
    {
        // Keep startup working if legacy data already contains duplicate receipt numbers.
    }
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS ReplacementInventory (Id INTEGER NOT NULL CONSTRAINT PK_ReplacementInventory PRIMARY KEY AUTOINCREMENT, DeviceCode TEXT NOT NULL, DeviceType TEXT NOT NULL DEFAULT 'Diffuser', Brand TEXT NOT NULL DEFAULT 'Aromatic', Model TEXT NOT NULL DEFAULT '', SerialNumber TEXT NOT NULL DEFAULT '', Status TEXT NOT NULL DEFAULT 'متاح', Location TEXT NOT NULL DEFAULT 'مستودع المستبدل', ServiceRequestId INTEGER NULL, AssignedServiceDeviceId INTEGER NULL);");
    await AddColumnIfMissing(db, "ReplacementInventory", "DeviceCondition", "TEXT NOT NULL DEFAULT 'جديد'");
    await AddColumnIfMissing(db, "ReplacementInventory", "Color", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ReplacementInventory", "ScrappedAt", "TEXT NULL");
    await AddColumnIfMissing(db, "ReplacementInventory", "ScrapReason", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ReplacementInventory", "ScrapNotes", "TEXT NOT NULL DEFAULT ''");
    // V28: manager-maintained device model and accessory catalogs.
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS DeviceModels (Id INTEGER NOT NULL CONSTRAINT PK_DeviceModels PRIMARY KEY AUTOINCREMENT, Name TEXT NOT NULL, DeviceType TEXT NOT NULL DEFAULT 'Diffuser', Brand TEXT NOT NULL DEFAULT 'Aromatic', IsActive INTEGER NOT NULL DEFAULT 1);");
    await AddColumnIfMissing(db, "DeviceModels", "UserGuideUrl", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "DeviceModels", "MediaGuideUrl", "TEXT NOT NULL DEFAULT ''");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS Accessories (Id INTEGER NOT NULL CONSTRAINT PK_Accessories PRIMARY KEY AUTOINCREMENT, Name TEXT NOT NULL, IsActive INTEGER NOT NULL DEFAULT 1);");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS SpareParts (Id INTEGER NOT NULL CONSTRAINT PK_SpareParts PRIMARY KEY AUTOINCREMENT, Name TEXT NOT NULL, Code TEXT NOT NULL DEFAULT '', Color TEXT NOT NULL DEFAULT '', CompatibleDeviceModel TEXT NOT NULL DEFAULT '', StockQuantity INTEGER NOT NULL DEFAULT 0, IsActive INTEGER NOT NULL DEFAULT 1);");
    await AddColumnIfMissing(db, "SpareParts", "Code", "TEXT NOT NULL DEFAULT ''");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS SparePartMovements (Id INTEGER NOT NULL CONSTRAINT PK_SparePartMovements PRIMARY KEY AUTOINCREMENT, SparePartId INTEGER NOT NULL, MovementType TEXT NOT NULL, Quantity INTEGER NOT NULL, MovementDate TEXT NOT NULL, ReferenceNumber TEXT NOT NULL DEFAULT '', ReferenceImagePath TEXT NOT NULL DEFAULT '', Location TEXT NOT NULL DEFAULT 'فرع الصيانة', TechnicianName TEXT NOT NULL DEFAULT '', ServiceDeviceId INTEGER NULL, DeviceModel TEXT NOT NULL DEFAULT '', DeviceCode TEXT NOT NULL DEFAULT '', Notes TEXT NOT NULL DEFAULT '');");
    // Backfill movement history for existing technician consumption records.
    await db.Database.ExecuteSqlRawAsync("INSERT INTO SparePartMovements (SparePartId,MovementType,Quantity,MovementDate,ReferenceNumber,ReferenceImagePath,Location,TechnicianName,ServiceDeviceId,DeviceModel,DeviceCode,Notes) SELECT u.SparePartId,'استهلاك',u.Quantity,u.UsedAt,'','',COALESCE((SELECT Branch FROM ServiceRequests WHERE Id=u.ServiceRequestId),'مركز الصيانة'),u.TechnicianName,u.ServiceDeviceId,COALESCE((SELECT Model FROM ServiceDevices WHERE Id=u.ServiceDeviceId),''),COALESCE((SELECT DeviceCode FROM ServiceDevices WHERE Id=u.ServiceDeviceId),''),'ترحيل تلقائي من سجل الاستهلاك السابق' FROM SparePartUsages u WHERE NOT EXISTS (SELECT 1 FROM SparePartMovements m WHERE m.MovementType='استهلاك' AND m.SparePartId=u.SparePartId AND m.ServiceDeviceId=u.ServiceDeviceId AND m.Quantity=u.Quantity AND m.MovementDate=u.UsedAt);");
    await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS SparePartUsages (Id INTEGER NOT NULL CONSTRAINT PK_SparePartUsages PRIMARY KEY AUTOINCREMENT, ServiceDeviceId INTEGER NOT NULL, ServiceRequestId INTEGER NOT NULL, SparePartId INTEGER NOT NULL, Quantity INTEGER NOT NULL, TechnicianName TEXT NOT NULL DEFAULT '', UsedAt TEXT NOT NULL);");
    await AddColumnIfMissing(db, "ServiceDevices", "MaintenanceTechnicianName", "TEXT NOT NULL DEFAULT ''");
    await AddColumnIfMissing(db, "ServiceDevices", "SparePartsDeducted", "INTEGER NOT NULL DEFAULT 0");
    if (!await db.DeviceModels.AnyAsync())
    {
        db.DeviceModels.AddRange(
            new DeviceModel { Name="AF300", DeviceType="Diffuser", Brand="Aromatic", IsActive=true },
            new DeviceModel { Name="AF300 Smart", DeviceType="Diffuser", Brand="Aromatic", IsActive=true },
            new DeviceModel { Name="AF300 Plug", DeviceType="Diffuser", Brand="Aromatic", IsActive=true });
        await db.SaveChangesAsync();
    }
    if (!await db.Accessories.AnyAsync())
    {
        db.Accessories.AddRange(
            new Accessory { Name="ريموت", IsActive=true },
            new Accessory { Name="شاحن", IsActive=true },
            new Accessory { Name="عبوة فارغة", IsActive=true },
            new Accessory { Name="عبوة بها زيت عطري", IsActive=true },
            new Accessory { Name="كرت الضمان", IsActive=true },
            new Accessory { Name="الحامل / القاعدة", IsActive=true },
            new Accessory { Name="أخرى", IsActive=true });
        await db.SaveChangesAsync();
    }
    // V25: the device itself is not an accessory. Remove it from legacy accessory records.
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET Accessories = trim(replace(replace(replace(Accessories, 'الجهاز;', ''), ';الجهاز', ''), 'الجهاز', ''), '; ') WHERE instr(Accessories, 'الجهاز') > 0;");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET Accessories = trim(Accessories, '; ') WHERE Accessories IS NOT NULL;");

    // V15: normalize legacy state data using a strict state precedence.
    // IMPORTANT: never downgrade a device that has already reached a later state.
    // The source of truth is the current location/status plus the maintenance timestamps.
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentStatus = 'مستبعد', CurrentLocation = 'الفرع', AssignedTechnicianId = NULL, AssignedTechnicianName = '' WHERE Decision = 'مستبعد';");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentStatus = 'مهلك', CurrentLocation = 'مركز الصيانة', AssignedTechnicianId = NULL, AssignedTechnicianName = '' WHERE Decision = 'مهلك';");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentStatus = 'مستبدل', CurrentLocation = 'مستودع الأجهزة المستبدلة', AssignedTechnicianId = NULL, AssignedTechnicianName = '' WHERE Decision = 'مستبدل' OR ReplacedAt IS NOT NULL;");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentLocation = 'الفرع', CurrentStatus = 'تم الاستلام' WHERE CurrentLocation = 'الفرع' AND ReturnedAt IS NOT NULL AND Decision = 'مرتجع';");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentLocation = 'في الطريق إلى الصيانة', CurrentStatus = 'مع مندوب التوصيل' WHERE CurrentLocation = 'في الطريق إلى الصيانة' AND ReturnedAt IS NOT NULL AND Decision = 'مرتجع';");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentLocation = 'في الطريق للفرع', CurrentStatus = 'مع مندوب التوصيل' WHERE CurrentLocation = 'في الطريق للفرع' AND Decision <> 'مستبعد' AND Decision <> 'مهلك' AND Decision <> 'مستبدل';");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentLocation = 'مستودع الأجهزة الجاهزة للإرجاع', CurrentStatus = 'جاهز للإرسال', AssignedTechnicianId = NULL, AssignedTechnicianName = '' WHERE (MaintenanceCompletedAt IS NOT NULL OR (MaintenanceResult <> '' AND AssignedTechnicianId IS NULL AND MaintenanceStartedAt IS NOT NULL)) AND MaintenancePaused = 0 AND CurrentLocation NOT IN ('في الطريق للفرع','في الطريق للصيانة','الفرع') AND Decision <> 'مستبعد' AND Decision <> 'مهلك' AND Decision <> 'مستبدل' AND CustomerDeliveredAt IS NULL AND (MaintenanceRoute IS NULL OR MaintenanceRoute <> 'صيانة محلية');");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentLocation = 'مركز الصيانة', CurrentStatus = 'معلق', AssignedTechnicianId = NULL, AssignedTechnicianName = '' WHERE MaintenancePaused = 1 AND MaintenanceCompletedAt IS NULL AND CurrentLocation <> 'في الطريق للفرع' AND (MaintenanceRoute IS NULL OR MaintenanceRoute <> 'صيانة محلية') AND Decision <> 'مستبعد' AND Decision <> 'مهلك' AND Decision <> 'مستبدل';");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentLocation = 'مركز الصيانة', CurrentStatus = 'جاري الصيانة' WHERE MaintenanceStartedAt IS NOT NULL AND MaintenanceCompletedAt IS NULL AND MaintenancePaused = 0 AND CurrentLocation <> 'في الطريق للفرع' AND (MaintenanceRoute IS NULL OR MaintenanceRoute <> 'صيانة محلية') AND Decision <> 'مستبعد' AND Decision <> 'مهلك' AND Decision <> 'مستبدل';");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentLocation = 'مركز الصيانة', CurrentStatus = 'انتظار' WHERE MaintenanceReceivedAt IS NOT NULL AND MaintenanceStartedAt IS NULL AND MaintenanceCompletedAt IS NULL AND MaintenancePaused = 0 AND CurrentLocation <> 'في الطريق للفرع' AND (MaintenanceRoute IS NULL OR MaintenanceRoute <> 'صيانة محلية') AND Decision <> 'مستبعد' AND Decision <> 'مهلك' AND Decision <> 'مستبدل';");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentLocation = 'في الطريق إلى الصيانة', CurrentStatus = 'مع مندوب التوصيل' WHERE SentAt IS NOT NULL AND MaintenanceReceivedAt IS NULL AND MaintenanceStartedAt IS NULL AND MaintenanceCompletedAt IS NULL AND MaintenancePaused = 0 AND CurrentLocation NOT IN ('في الطريق للفرع','مركز الصيانة') AND Decision <> 'مستبعد' AND Decision <> 'مهلك' AND Decision <> 'مستبدل';");

    // V27: local maintenance never changes the physical location away from the branch.
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentLocation = (SELECT Branch FROM ServiceRequests WHERE ServiceRequests.Id = ServiceDevices.ServiceRequestId), CurrentStatus = 'تمت الصيانة محليًا', AssignedTechnicianId = NULL, AssignedTechnicianName = '' WHERE MaintenanceRoute = 'صيانة محلية' AND LocalMaintenanceCompletedAt IS NOT NULL AND CustomerDeliveredAt IS NULL AND LocalMaintenanceFailureReason = ''; ");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceDevices SET CurrentLocation = (SELECT Branch FROM ServiceRequests WHERE ServiceRequests.Id = ServiceDevices.ServiceRequestId), CurrentStatus = 'تعذر الصيانة المحلية', AssignedTechnicianId = NULL, AssignedTechnicianName = '', Decision = 'جاهز للإرسال' WHERE MaintenanceRoute = 'صيانة محلية' AND LocalMaintenanceFailureReason <> '' AND CustomerDeliveredAt IS NULL; ");

    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceRequests SET IntakeSource = CASE WHEN ServiceType = 'خدمة التعطير' THEN 'خدمة التعطير' ELSE 'فرع' END WHERE IntakeSource IS NULL OR trim(IntakeSource)='';");
    await db.Database.ExecuteSqlRawAsync("UPDATE ServiceRequests SET OriginName = CASE WHEN ServiceType = 'خدمة التعطير' THEN 'خدمة التعطير' ELSE Branch END WHERE OriginName IS NULL OR trim(OriginName)='';");

    // V25: recalculate request status from the actual current states of all devices.
    var allRequestsForStatus = await db.ServiceRequests.Include(x => x.Devices).ToListAsync();
    foreach (var statusRequest in allRequestsForStatus)
        statusRequest.Status = RequestStatusHelper.Calculate(statusRequest.Devices);
    await db.SaveChangesAsync();

    if (!await db.SpareParts.AnyAsync())
    {
        db.SpareParts.AddRange(
            new SparePart { Name = "موتور", StockQuantity = 0, IsActive = true },
            new SparePart { Name = "كابل كهرباء", StockQuantity = 0, IsActive = true });
        await db.SaveChangesAsync();
    }

    if (!await db.UserAccounts.AnyAsync())
    {
        db.UserAccounts.Add(new UserAccount
        {
            Username = "ahmed.mohamed",
            FullName = "أحمد محمد",
            Role = "مستخدم فرع",
            Branch = "الرياض",
            Email = "ahmed@example.com",
            Phone = "0500000000",
            Theme = "light",
            CanReturnDevices = true,
            PasswordHash = Hash("123456")
        });
        await db.SaveChangesAsync();
    }
    else
    {
        var u = await db.UserAccounts.FirstOrDefaultAsync(x => x.Username == "ahmed.mohamed");
        if (u is not null) { if (string.IsNullOrWhiteSpace(u.Email)) u.Email = "ahmed@example.com"; if (string.IsNullOrWhiteSpace(u.Phone)) u.Phone = "0500000000"; u.CanReturnDevices = true; if (!u.BranchId.HasValue) u.BranchId = await db.Branches.Where(x=>x.City==u.Branch).Select(x=>(int?)x.Id).FirstOrDefaultAsync(); await db.SaveChangesAsync(); }
    }

    if (!await db.UserAccounts.AnyAsync(x => x.Username == "ahmed.tech"))
    {
        db.UserAccounts.Add(new UserAccount { Username="ahmed.tech", FullName="أحمد الفني", Role="فني صيانة", Branch="الصيانة", Email="tech@example.com", Phone="0500000010", Theme="light", CanReturnDevices=false, PasswordHash=Hash("123456") });
        await db.SaveChangesAsync();
    }
    // Note: once this demo account exists, its name/role/branch are left alone on later
    // startups. Earlier versions of this file reset them on every restart, which silently
    // undid any changes a real admin made to this account from the /admin page.
    if (!await db.UserAccounts.AnyAsync(x => x.Username == "maintenance.manager"))
    {
        db.UserAccounts.Add(new UserAccount { Username="maintenance.manager", FullName="مشرف الصيانة", Role="مشرف صيانة", Branch="الصيانة", Email="maintenance@example.com", Phone="0500000020", Theme="light", CanReturnDevices=true, PasswordHash=Hash("123456") });
        await db.SaveChangesAsync();
    }

    if (!await db.UserAccounts.AnyAsync(x => x.Username == "maintenance.director"))
    {
        db.UserAccounts.Add(new UserAccount { Username="maintenance.director", FullName="مدير الصيانة", Role="مدير صيانة", Branch="الإدارة", Email="director@example.com", Phone="0500000025", Theme="light", CanReturnDevices=true, IsActive=true, PasswordHash=Hash("123456") });
        await db.SaveChangesAsync();
    }

    // Administrator and mobile technician demo accounts.
    if (!await db.UserAccounts.AnyAsync(x => x.Username == "system.admin"))
    {
        db.UserAccounts.Add(new UserAccount { Username="system.admin", FullName="مدير عام ARMS", Role="مدير عام ARMS", Branch="الإدارة", Email="admin@example.com", Phone="0500000030", Theme="light", CanReturnDevices=true, IsActive=true, PasswordHash=Hash("123456") });
        await db.SaveChangesAsync();
    }
    var existingGeneral = await db.UserAccounts.FirstOrDefaultAsync(x => x.Username == "system.admin");
    if (existingGeneral is not null && existingGeneral.Role == "مدير رئيسي")
    {
        existingGeneral.Role = "مدير عام ARMS";
        existingGeneral.FullName = "مدير عام ARMS";
        await db.SaveChangesAsync();
    }

    if (!await db.UserAccounts.AnyAsync(x => x.Username == "mobile.tech"))
    {
        db.UserAccounts.Add(new UserAccount { Username="mobile.tech", FullName="خالد الفني المتنقل", Role="فني متنقل", Branch="متنقل", Email="mobile@example.com", Phone="0500000040", Theme="light", CanReturnDevices=false, IsActive=true, PasswordHash=Hash("123456") });
        await db.SaveChangesAsync();
    }
    if (!await db.UserAccounts.AnyAsync(x => x.Username == "customer.service"))
    {
        db.UserAccounts.Add(new UserAccount { Username="customer.service", FullName="موظف خدمة العملاء", Role="خدمة العملاء", Branch="الإدارة", Email="customer.service@example.com", Phone="0500000050", Theme="light", CanReturnDevices=false, IsActive=true, PasswordHash=Hash("123456") });
        await db.SaveChangesAsync();
    }


}

app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
app.Run();

static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

static async Task AddColumnIfMissing(ArmsDbContext db, string table, string column, string definition)
{
    var exists = await db.Database.SqlQueryRaw<int>($"SELECT COUNT(*) AS Value FROM pragma_table_info('{table}') WHERE name='{column}'").FirstAsync();
    if (exists == 0)
        await db.Database.ExecuteSqlRawAsync($"ALTER TABLE {table} ADD COLUMN {column} {definition};");
}
