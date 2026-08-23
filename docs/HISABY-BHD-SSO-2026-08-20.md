# حسابي — تثبيت دخول BHD الموحّد (20 أغسطس 2026)

**المرجع:** [`BHD-UNIFIED-LOGIN-AND-APPS.md`](./BHD-UNIFIED-LOGIN-AND-APPS.md) §0.7 و§4 و§4.9 · [`BHD-PRODUCT-SSO-ADMIN.md`](./BHD-PRODUCT-SSO-ADMIN.md)  
**Issuer:** `https://id.bhd-om.com` · **client_id:** `bhd-hisaby`

---

## ماذا طُبّق

| عنصر | التفاصيل |
|------|----------|
| عمود | `users.bhd_sub` (unique) — هجرة `20260820120000_bhd_identity_sub` |
| Nest | `GET /api/auth/bhd/start` · `callback` · `logout` · `GET /api/auth/admin-entry` |
| ربط مستخدم | **حرفياً §3.3:** (1) `bhd_sub` (2) بريد موثّق + إبقاء الدور + مسح كلمة المرور (3) وإلا إنشاء مستخدم بلا كلمة مرور + شركة STARTER (أدمن تلك الشركة فقط — ليس أدمن منصة من الهوية) |
| واجهة | مسارات Next `app/api/auth/bhd/*` و`admin-entry` تبروكسي Nest وتعيد `Set-Cookie` على منشأ الواجهة (لا تعتمد على rewrite وحده) |
| `/login` | غلاف → SSO؛ `?local=1` طوارئ فقط؛ `/admin` → `admin-entry` |
| `/register` | تحويل إلى `id.bhd-om.com/login` |
| بعد الدخول | `returnTo=/` من البوابة → `/dashboard` |
| جلسة | refresh/session 48 ساعة · كوكي `bhd_access` / `bhd_refresh` Host-only |

---

## أسرار Render / Vercel

```env
BHD_IDENTITY_ISSUER=https://id.bhd-om.com
BHD_OAUTH_CLIENT_ID=bhd-hisaby
BHD_OAUTH_CLIENT_SECRET=
# مُستحسن: نفس IDENTITY_TOKEN_SECRET (احتياطي userinfo يغطي غياب السر)
BHD_IDENTITY_TOKEN_SECRET=
FRONTEND_URL=https://hisaby.bhd-om.com
CORS_ORIGIN=https://hisaby.bhd-om.com,https://bhd-pro.vercel.app,https://www.hisaby.pro
JWT_REFRESH_EXPIRATION=48h
```

---

## تحقق قبل قلب `mode=sso` في ONE-BHD

1. `GET {origin}/api/auth/bhd/start` → **302** إلى `id.bhd-om.com`
2. مستخدم هوية جديد → callback → صف `bhd_sub` + شركة STARTER → `/dashboard`
3. أدمن قديم بنفس البريد → يبقى `ADMIN` محلياً
4. `/api/auth/admin-entry` → SSO → `/admin`
5. جلسة `bhd_id` → منتج ثانٍ بلا كلمة مرور

ثم في ONE-BHD: `apps.ts` حسابي `mode: "sso"`.

---

## نشر

1. `npx prisma migrate deploy` على API  
2. Deploy Render API + Vercel Frontend  
3. ضبط env  
4. إبلاغ ONE-BHD لقلب الكتالوج

---

## أعطال

**`?bhd=verify`:** JWKS فارغ / سر HS256 — احتياطي userinfo بعد تبادل الكود.  
**`?bhd=exchange` (قبل 23 أغسطس مساءً):** كان يرفض إنشاء المستخدم خلافاً لـ §3.3 — أُصلح بإنشاء صف المنتج.
**السبب:** اكتشاف الهوية يعلن `HS256` و`/oauth/jwks.json` يعيد `{"keys":[]}` بينما حسابي كان يتحقق عبر JWKS فقط.

**الإصلاح:** التحقق بـ HS256 عبر `BHD_IDENTITY_TOKEN_SECRET` (نسخة من `IDENTITY_TOKEN_SECRET` على ONE-BHD) مع الإبقاء على JWKS عند تفعيل RS256 لاحقاً.
