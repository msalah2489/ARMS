# تفعيل إشعارات المتصفح (Web Push) — ARMS

الموقع على GitHub Pages ثابت (بدون سيرفر إرسال). لذلك:

- المتصفح يشترك ويحفظ الاشتراك في جدول Supabase.
- الإرسال يتم عبر **Supabase Edge Function** بمفتاح VAPID الخاص (سرّ).
- مفتاح VAPID العام فقط يظهر في بناء Pages.

## ماذا يصل كـ Push؟

أي إشعار يُنشأ داخل النظام عبر `notifications-store`، ومنه:

- رسائل المدير (صفحة الرسائل والإشعارات).
- تنبيهات نقص المخزون.
- تنبيهات النظام الأخرى (مثل تعليق صيانة يحتاج استبدال).

الإشعار داخل التطبيق (الجرس) يبقى كما هو؛ الـ Push إضافة له على الأجهزة المشتركة.

## مرة واحدة — خطوات M

### 1) تشغيل SQL

في Supabase → **SQL Editor** الصق وشغّل الملف:

`supabase/migrations/026_web_push_subscriptions_RUN_ME.sql`

ينشئ جدول `app_push_subscriptions`.

### 2) توليد مفاتيح VAPID

على جهازك (مرة واحدة):

```bash
npx web-push generate-vapid-keys
```

ستحصل على **Public Key** و **Private Key**.

### 3) أسرار Edge Function (المفتاح الخاص هنا فقط)

في Supabase → **Project Settings → Edge Functions → Secrets** (أو CLI):

| السر | القيمة |
| --- | --- |
| `VAPID_PUBLIC_KEY` | المفتاح العام |
| `VAPID_PRIVATE_KEY` | المفتاح الخاص |
| `VAPID_SUBJECT` | مثلاً `mailto:you@example.com` |

ثم انشر الدالة من مجلد المشروع:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy send-web-push
```

مصدر الدالة: `supabase/functions/send-web-push/index.ts`

### 4) المفتاح العام في بناء GitHub Pages

أضف **المفتاح العام فقط** كـ Actions Secret أو Variable:

- الاسم: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- القيمة: نفس Public Key

أو ضعه في `.env.production` / `.env.local` محلياً:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxxxxxxxx...
```

**لا تضع** `VAPID_PRIVATE_KEY` في GitHub أو في ملفات Next.

بعد الدفع إلى `main` ينتظر اكتمال **Deploy GitHub Pages** ثم **Ctrl+F5**.

### 5) تفعيل الإشعار على جهاز الموظف (مرة لكل متصفح)

1. سجّل الدخول إلى ARMS.
2. تظهر رسالة أسفل الشاشة: **تفعيل إشعارات المتصفح** → اضغط **تفعيل الإشعارات**.
3. وافق على إذن المتصفح.
4. أو من قائمة الجرس: **تفعيل إشعارات هذا الجهاز**.

بعدها يصل الـ Push حتى لو كانت النافذة في الخلفية (حسب دعم المتصفح).

## ملاحظات سريعة

- يحتاج HTTPS (GitHub Pages يدعمه).
- iPhone: غالباً يتطلب إضافة الموقع للشاشة الرئيسية وإصدار iOS حديث.
- إذا رفض المستخدم الإذن من المتصفح، يجب تفعيله يدوياً من إعدادات الموقع في المتصفح.
- بدون نشر Edge Function أو بدون أسرار VAPID: الإشعارات داخل التطبيق تعمل، والـ Push لن يُرسل.

## تحقق سريع

1. بعد التفعيل: جدول `app_push_subscriptions` فيه صف للمستخدم.
2. أرسل رسالة تجريبية من المدير لدورك/حسابك.
3. يجب أن يظهر إشعار نظام التشغيل + رسالة في الجرس.
