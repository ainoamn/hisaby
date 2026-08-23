# نقطة التوقف — 23 أغسطس 2026

## الحالة

| عنصر | القيمة |
|------|--------|
| GitHub `main` | Dockerfile بدون `migrate &&` (كان يقتل Live) + `ensureBhdSubColumn` |
| Neon إنتاج | عمود `users.bhd_sub` **مطبَّق** |
| Render API | قد يبقى على commit أقدم حتى Manual Deploy — العمود في القاعدة يكفي للدخول |

## وثائق

- [`HISABY-BHD-SUB-COLUMN-APPLIED-2026-08-23.md`](./HISABY-BHD-SUB-COLUMN-APPLIED-2026-08-23.md)
- [`HISABY-BHD-SSO-2026-08-20.md`](./HISABY-BHD-SSO-2026-08-20.md) · [`BHD-PRODUCT-SSO-ADMIN.md`](./BHD-PRODUCT-SSO-ADMIN.md) §3.3

## بعد الدخول الناجح

1. Render → Manual Deploy لأحدث `main` (يلتقط ensure + migrate-on-boot)
2. ONE-BHD: قلب حسابي إلى `mode: "sso"` في `apps.ts`
3. يُفضَّل تدوير كلمة مرور Neon وتحديث Render env
