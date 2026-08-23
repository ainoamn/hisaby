# إصلاح عمود bhd_sub على الإنتاج (23 أغسطس 2026)

## السبب
Render لم ينشر commits الهجرات؛ قاعدة Neon بلا `users.bhd_sub` → `?bhd=schema`.

## الحل الفوري
طُبّق SQL مباشرة على Neon الإنتاج (مثل هجرة `20260820120000_bhd_identity_sub`):

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bhd_sub" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_bhd_sub_key" ON "users"("bhd_sub");
CREATE INDEX IF NOT EXISTS "users_bhd_sub_idx" ON "users"("bhd_sub");
```

## نمط المنتجات الأخرى (نَسَب)
`ensureBhdSubColumn()` قبل أي ربط SSO — حُمّل إلى حسابي في:
- `backend/src/auth/ensure-bhd-sub.ts`
- استدعاء عند إقلاع Prisma + قبل `loginWithBhdIdentity`

## أمان
كلمة مرور Neon ظهرت سابقاً في محادثة إعداد — يُفضَّل **Reset password** في Neon وتحديث `DATABASE_URL` / `DIRECT_URL` على Render بعد نجاح الدخول.
