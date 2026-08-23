# نقطة التوقف — استكمال العمل (محدّث 23 أغسطس 2026)

**الغرض:** تسليم نظيف. على الجهاز الآخر: `git pull origin main`.

## أين نحن

| عنصر | القيمة |
|------|--------|
| المستودع | `ainoamn/hisaby` (عبر BHD-Pro) · الفرع `main` |
| المرجع | [`BHD-PRODUCT-SSO-ADMIN.md`](./BHD-PRODUCT-SSO-ADMIN.md) §3.3 · UNIFIED §0.7 / §4.5 |
| callback | `bhd_sub` → بريد موثّق → **إنشاء مستخدم + شركة STARTER** (كان ناقصاً ويسبب `?bhd=exchange`) |

## بعد نشر Render

1. تأكد `/api/health` commit ≥ هذا الإصلاح  
2. أعد SSO من `hisaby.bhd-om.com`  
3. مستخدم هوية جديد يجب أن يدخل `/dashboard` مع `bhd_sub` مملوء  
4. أبلغ ONE-BHD لقلب حسابي إلى `mode: "sso"`
