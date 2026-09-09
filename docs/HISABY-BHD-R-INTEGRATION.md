# كيف أربط برنامج العقارات BHD R بحسابي

**تاريخ:** 2026-09-09  
**منشور على `main`:** Hisaby [`8bfe709`](https://github.com/ainoamn/hisaby/commit/8bfe709) · عقارات [`1478983`](https://github.com/ainoamn/BHD-R/commit/1478983)  
**محاسبة:** https://hisaby.bhd-om.com  
**عقارات:** https://r.bhd-om.com  
**واجهة العقارات API:** https://api.r.bhd-om.com  
**مرجع BHD-R:** `docs/implementation/HISABY-API-KEYS-AR.md`

لا يُنسخ كود BHD-R داخل Hisaby. الربط عبر API + SSO فقط.

**نقطة الاستقبال العامة (حيّة على نطاق حسابي):**  
`POST https://hisaby.bhd-om.com/api/integrations/bhd-r/events`  
(يُعاد توجيهها من الواجهة إلى API؛ الـ Worker يقبل فقط هذا المضيف.)

بعد حفظ مفتاح القراءة تتم **المزامنة تلقائياً كل 15 دقيقة بدون تدخل بشري**: العقارات، العناوين، الجهات، الفواتير، الحسابات الواردة والصادرة، التواريخ، والمدفوعات/المصروفات. السحب يفضّل `GET /v1/integrations/hisaby/export` ثم المسارات المفصّلة. أجسام Worker تُسطَّح تلقائياً؛ المواضيع الإعلامية (قيود/شيكات) تُتجاهل بـ 200 حتى لا تفشل الدفعة.

---

## من ينشئ أي مفتاح؟

| الغرض | من ينشئه؟ | أين؟ |
| --- | --- | --- |
| استقبال أحداث العقارات داخل المحاسبة | **Hisaby** | إعدادات الشركة → تكامل BHD R، أو `/bhd-r` |
| سحب كل التفاصيل ومزامنتها تلقائياً | موقع العقارات (أنت) | https://r.bhd-om.com/ar/owner/api-keys — زر **صلاحيات حسابي الكاملة** |
| دخول المستخدم اليومي | لا مفتاح | SSO إلى https://hisaby.bhd-om.com |

الربط يعمل باتجاهين بعد اللصق:

1. **دفع فوري:** BHD-R → `POST /api/integrations/bhd-r/events` برمز Hisaby الوارد.
2. **سحب تلقائي:** Hisaby → API العقارات بمفتاح القراءة (`x-api-key`) كل 15 دقيقة، وفوراً بعد حفظ المفتاح.

---

## صلاحيات مفتاح قراءة العقارات (لحسابي)

من صفحة المفاتيح في BHD-R استخدم «تعبئة صلاحيات حسابي الكاملة». يشمل ذلك على الأقل:

`property.read` · `unit.read` · `party.read` · `party.sensitive.read` · `organization.read` · `contract.read` · `lease.read` · `reservation.read` · `invoice.read` · `payment.read` · `receipt.read` · `cheque.read` · `accounting.read` · `billing.schedule.read` · `stay.booking.read` · `sale.read` · `vendor.read` · `maintenance.read` · `work_order.read` · `legal.read` · `request.read` · `report.read` · `media.read` · `webhook.read`

Hisaby يسحب:

| مسار BHD-R | ماذا يُحفظ في حسابي |
| --- | --- |
| `GET /v1/integrations/hisaby/export` | لقطة كاملة (مفضّلة) حسب صلاحيات المفتاح |
| `GET /v1/portfolio/properties` | عقار + عنوان + وحدات → مركز تكلفة لكل عقار |
| `GET /v1/parties` | جهات اتصال (اسم، بريد، هاتف، عنوان) |
| `GET /v1/leasing/leases` | ربط الوحدة/العقار بالفاتورة |
| `GET /v1/finance/invoices` | فواتير إيجار واردة + تاريخ الإصدار والاستحقاق |
| `GET /v1/finance/payments` | تحصيلات واردة |
| `GET /v1/accounting/expenses` | مصروفات صادرة |
| `GET /v1/operations/vendors` | مورد المصروف |

المفاتيح: `bhd-r:pull:invoice:{id}` و`bhd-r:pull:payment:{id}` و`bhd-r:pull:expense:{id}` — **idempotent** مع أحداث الدفع حتى لا تُكرَّر المستندات.

متغير البيئة: `BHD_R_API_URL` (افتراضي `https://api.r.bhd-om.com`). لإيقاف الكرون: `BHD_R_SYNC_DISABLED=1`.

---

## مسار الاستقبال النهائي (ثابت لـ BHD-R)

الصق هذا الرابط في نموذج الربط على `/ar/owner/api-keys`:

```
POST https://hisaby.bhd-om.com/api/integrations/bhd-r/events
Authorization: Bearer qk_bhdr_<secret>
Content-Type: application/json
```

يُقبل أيضاً `X-API-Key: qk_bhdr_<secret>`.

السلوك: **idempotent** حسب `idempotencyKey` لكل شركة. التكرار يعيد نفس `invoiceId` / `paymentId` مع `"duplicate": true`.

يُحفظ مع كل مستند: اتجاه وارد/صادر، عنوان العقار، الوحدة، تاريخ العملية، تاريخ الاستحقاق، تسمية الحساب، وبيانات الجهة.

### جسم الحدث

| الحقل | إلزامي | ملاحظات |
| --- | --- | --- |
| `idempotencyKey` | نعم | 8–180 حرفاً |
| `type` | نعم | انظر الجدول أدناه |
| `occurredOn` | نعم | ISO-8601 |
| `dueOn` | لا | تاريخ الاستحقاق |
| `amountMinor` | نعم | عدد صحيح كنص (للريال العماني: 3 خانات، `150000` = 150.000 ر.ع) |
| `currency` | نعم | ISO-4217 مثل `OMR` |
| `direction` | لا | `inbound` وارد أو `outbound` صادر |
| `accountLabel` | لا | تسمية الحساب الوارد/الصادر |
| `organizationExternalId` | لا | أو `organizationId` |
| `propertyId` / `unitId` | لا | مع كائن `property` / `unit` |
| `property.name` / `property.address` | لا | عنوان العقار (خط، مدينة، ولاية، محافظة) |
| `counterparty.name` | لا | يُنشأ/يُطابق جهة اتصال |
| `counterparty.externalId` / `email` / `phone` / `address` / `taxId` | لا | تفاصيل الجهة |
| `memo` | لا | بيان |
| `sourceRefs.bookingId` / `invoiceId` / `paymentId` / `expenseId` / `leaseId` | لا | ربط مستندات المصدر |

### أنواع الأحداث

| `type` | مستند Hisaby |
| --- | --- |
| `stay.payment.succeeded` | فاتورة مبيعات + تحصيل فوري (ONLINE) |
| `lease.invoice.issued` | فاتورة مبيعات مُرسَلة (ترحيل GL) |
| `lease.payment.received` | تحصيل على فاتورة الإيجار إن وُجدت عبر `sourceRefs.invoiceId`، وإلا فاتورة + تحصيل |
| `expense.paid` | فاتورة مشتريات + دفع فوري |
| `expense.approved` | فاتورة مشتريات مُرسَلة (غير مدفوعة) |
| `deposit.held` | فاتورة مبيعات مسودة (أمانات — يراجعها المحاسب) |
| `deposit.released` | فاتورة مبيعات + تحصيل فوري |

المبلغ يُرحَّل كسطر واحد **بدون تقسيم VAT تلقائي** حتى يطابق مبلغ الحدث حرفياً. العقار يُربط **بمركز تكلفة** (`BR-…`).

### مثال

```json
{
  "idempotencyKey": "bhd-r:stay-pay:abc123",
  "type": "stay.payment.succeeded",
  "occurredOn": "2026-09-09T10:00:00.000Z",
  "dueOn": "2026-09-09T10:00:00.000Z",
  "amountMinor": "150000",
  "currency": "OMR",
  "direction": "inbound",
  "accountLabel": "حساب التحصيل — وارد",
  "organizationExternalId": "bhd-r-org-uuid",
  "propertyId": "prop-uuid",
  "unitId": "unit-uuid",
  "property": {
    "id": "prop-uuid",
    "name": "برج النور",
    "address": { "line": "القرم", "city": "مسقط", "governorate": "مسقط", "countryCode": "OM" }
  },
  "unit": { "id": "unit-uuid", "name": "شقة 12", "code": "A-12" },
  "source": "bhd-r",
  "counterparty": {
    "name": "أحمد الكندي",
    "externalId": "pty_123",
    "email": "ahmed@example.com",
    "phone": "96890000000",
    "address": { "city": "مسقط", "wilayat": "بوشر" }
  },
  "memo": "إقامة ليلتين",
  "sourceRefs": { "bookingId": "stay_1", "paymentId": "pay_1" }
}
```

### رد النجاح

```json
{
  "duplicate": false,
  "eventId": "uuid",
  "idempotencyKey": "bhd-r:stay-pay:abc123",
  "type": "stay.payment.succeeded",
  "status": "processed",
  "invoiceId": "uuid",
  "paymentId": "uuid"
}
```

---

## واجهات إدارة الرمز (JWT مدير الشركة)

| Method | Path | وصف |
| --- | --- | --- |
| GET | `/api/integrations/bhd-r` | الحالة (بدون أسرار) + آخر مزامنة |
| GET | `/api/integrations/bhd-r/readme` | دليل عربي |
| POST | `/api/integrations/bhd-r/inbound-token` | إنشاء الرمز — السر مرة واحدة |
| POST | `/api/integrations/bhd-r/inbound-token/revoke` | إلغاء الرمز |
| PATCH | `/api/integrations/bhd-r` | لصق مفتاح قراءة BHD-R + معرّف المؤسسة — يبدأ السحب فوراً |
| POST | `/api/integrations/bhd-r/sync` | مزامنة فورية (نفس السحب التلقائي) |

واجهة المنتج: `/bhd-r` و`/settings#bhd-r`.

بعد النشر على Render يجب تشغيل `prisma migrate deploy` لترحيل `20260909120000_bhd_r_integration` و`20260909140000_bhd_r_auto_sync`.
