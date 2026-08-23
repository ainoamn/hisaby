# إصلاح عمود bhd_sub على الإنتاج (23 أغسطس 2026)

## السبب
1. قاعدة Neon بلا `users.bhd_sub` → `?bhd=schema`.
2. Auto-Deploy لـ `08f3235` / `f84acdb` فشل لأن Docker CMD كان:
   `prisma migrate deploy && node …` — أي فشل migrate = **Exit 1** ولا Live.

## الحل
- طُبّق SQL على Neon مباشرة (هجرة `20260820120000_bhd_identity_sub`).
- `ensureBhdSubColumn()` عند إقلاع Prisma وقبل SSO (نمط نَسَب) في:
  - `backend/src/prisma/ensure-bhd-sub.ts`
- إرجاع Dockerfile CMD إلى `node dist/main` فقط حتى لا يقتل النشر migrate.

## بعد Live
أعد SSO. إن لزم لاحقاً: Render Shell → `npx prisma migrate deploy --schema src/prisma/schema.prisma`

## أمان
كلمة مرور Neon ظهرت سابقاً في محادثة إعداد — يُفضَّل **Reset password** في Neon وتحديث `DATABASE_URL` / `DIRECT_URL` على Render بعد نجاح الدخول.
