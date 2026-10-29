# ربط hisaby بهوية BHD الحية

> تاريخ التحديث: 29 أكتوبر 2026  
> المصدر: https://id.bhd-om.com — الأيقونات: /admin#apps — الربط: /admin#connect

## ما طُبِّق (2026-10-29)

| البند | التفاصيل |
|--------|-----------|
| سكربت + CSP | `frontend/src/app/layout.tsx` + `frontend/next.config.js` (script/connect/img لـ `id.bhd-om.com`) |
| مدة الجلسة | `backend/src/auth/bhd-runtime.ts` ← `GET /api/bhd/runtime`؛ `setAuthCookies` / roster |
| rebind | `POST /api/auth/bhd/rebind` (Nest) ← proxy `frontend/src/app/api/auth/bhd/rebind`؛ Bearer → `loginWithBhdIdentity` |
| عميل الهوية | `frontend/src/lib/identity/client.ts` — rebind قبل `/start`؛ `switchWindowAccount` في `accounts.ts` |
| كتالوج حي | `frontend/src/lib/bhd/catalog.ts` + `useBhdCatalog` في `BhdAppSwitcher` |
| الرأس | `BhdSessionMenu` يعرض جلسة المنتج (`/api/auth/me`)؛ قائمة الحسابات من الهوية بالـ Bearer |
| Silent SSO | `BhdSilentSso.tsx` — rebind عند عدم التطابق |

## تحقق

1. كتالوج الأيقونات من `/api/bhd/catalog` في مبدّل التطبيقات.
2. تبديل حساب → `POST /api/auth/bhd/rebind` → بيانات الحساب الجديد فقط.
3. مدة الجلسة من `/api/bhd/runtime`.

## مراجع

- `BHD-CURSOR-PRODUCT-WIRE.md` — أمر الربط الكامل
- `BHD-ACCOUNT-ISOLATION.md` — عزل التبديل (rebind بالـ Bearer)
- `BHD-IDENTITY-RUNTIME.md` — runtime + سكربت

## تحديث §95 (29 أكتوبر 2026)

إصلاح جذر العزل على الهوية: `POST /api/auth/switch` يكتب `bhd_id` دائماً. هذا المنتج يعتمد `rebind` محلياً بعد التبديل. التفاصيل: `BHD-ACCOUNT-ISOLATION.md`.
