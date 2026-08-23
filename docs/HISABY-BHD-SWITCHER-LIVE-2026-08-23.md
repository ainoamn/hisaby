# حسابي — مشغّل BHD حي + صورة الهوية (23 أغسطس 2026)

## الخلاصة
الدخول الموحّد **يعمل** على الإنتاج. مشغّل التطبيقات (تسع نقاط + أفاتار) في هيدر لوحة التحكم. كتالوج حسابي في ONE-BHD أصبح `mode: "sso"`.

## النشر

| طبقة | أين | ملاحظة |
|------|-----|--------|
| GitHub | `ainoamn/hisaby` (`main`) | يشمل SSO، ensure `bhd_sub`، المشغّل، إصلاح RTL/الصورة |
| API | Render `hisaby-api` | Live؛ `bhdSubColumn: true`؛ لا `migrate &&` في Docker CMD |
| Frontend | Vercel → `hisaby.bhd-om.com` | Auto-deploy من `main` |
| كتالوج | ONE-BHD `apps.ts` | حسابي `mode: "sso"` |

## الملفات (حسابي)

| مسار | دور |
|------|-----|
| `frontend/src/lib/bhd/apps.ts` | كتالوج مجمّد (نسخة من ONE-BHD) |
| `frontend/src/components/bhd/BhdAppSwitcher.tsx` | تسع نقاط + أفاتار + لوحات apps/account |
| `frontend/src/components/bhd/BhdAppIcon.tsx` | أيقونات المنتجات |
| `frontend/src/components/layout/topbar.tsx` | تركيب المشغّل بعد الجلسة |
| `frontend/src/lib/api.ts` | `restoreSession` يمرّر `avatar` من `/auth/me` |
| `frontend/src/app/globals.css` | أنماط `.bhd-switcher-*` / `.bhd-app-icon` |
| `backend/src/prisma/ensure-bhd-sub.ts` | ضمان العمود عند الإقلاع (نمط نَسَب) |

## إصلاحات واجهة (نفس اليوم)

1. **لوحة خارج الصفحة (RTL):** اللوحة `position: fixed` مع قصّ الإحداثيات داخل نافذة العرض.
2. **صورة مكسورة:** صور Google تحتاج `referrerPolicy="no-referrer"`؛ و`restoreSession` كان يحذف `avatar`.

## التحقق

```text
GET https://hisaby-api.onrender.com/api/auth/bhd/status
→ configured: true, bhdSubColumn: true, clientId: bhd-hisaby

GET https://hisaby.bhd-om.com/api/auth/bhd/start?returnTo=/
→ 302 إلى https://id.bhd-om.com/oauth/authorize
```

بعد الدخول: هيدر ← تسع نقاط (كتالوج BHD) + صورة الحساب ← «الحساب» على `id.bhd-om.com/account` ← «خروج» عبر `/api/auth/bhd/logout`.

## متبقٍ اختياري

- ضبط `BHD_IDENTITY_TOKEN_SECRET` على Render إن أردت تحقق HS256 دون الاعتماد على userinfo.
- تدوير كلمة مرور Neon وتحديث `DATABASE_URL` / `DIRECT_URL` على Render.
- Meta واتساب `#200` (منفصل عن SSO).
