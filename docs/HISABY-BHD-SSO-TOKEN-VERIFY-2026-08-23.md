# حادثة دخول BHD — تعذر التحقق من الرمز (23 أغسطس 2026)

**العَرَض (حي):**  
`https://hisaby.bhd-om.com/login?bhd=verify`  
«تعذر الدخول الموحد — تعذّر التحقق من رمز الهوية… على Render يجب ضبط `BHD_IDENTITY_TOKEN_SECRET` … التوقيع HS256 وJWKS فارغ.»

**الحالة عند التدوين:**

| مكوّن | القيمة |
|--------|--------|
| GitHub `main` | `853b171` — يشمل تحقق HS256 |
| API الحي | `commit: 853b171…` |
| JWKS الهوية | `{"keys":[]}` · `id_token_signing_alg_values_supported: ["HS256"]` |

---

## السبب

الكود صحيح. الفشل تشغيلي: متغير **`BHD_IDENTITY_TOKEN_SECRET`** على Render غير مضبوط أو لا يطابق **`IDENTITY_TOKEN_SECRET`** في مشروع الهوية (`one-bhd` / `id.bhd-om.com`).

لا يمكن إكمال الدخول الموحّد بدون هذا السر ما دام JWKS فارغاً.

---

## الإصلاح (Render — إلزامي)

1. Vercel → مشروع الهوية (`one-bhd`) → Environment → انسخ `IDENTITY_TOKEN_SECRET`.
2. Render → `hisaby-api` → Environment:

```env
BHD_IDENTITY_TOKEN_SECRET=<نفس القيمة حرفياً بدون مسافات>
BHD_IDENTITY_ISSUER=https://id.bhd-om.com
BHD_OAUTH_CLIENT_ID=bhd-hisaby
```

3. Save → **Manual Deploy / Restart**.
4. أعد الدخول:  
   `https://hisaby.bhd-om.com/api/auth/bhd/start?returnTo=/dashboard`

---

## بعد نجاح الدخول

1. تأكد `bhd_sub` مملوء للمستخدم (أو رُبط بالبريد مع الإبقاء على الدور).
2. في ONE-BHD اقلب حسابي إلى `mode: "sso"` في `apps.ts` إن لم يُقلَب بعد.
3. اختبار: فتح منتج ثانٍ بلا إعادة كلمة مرور.

---

## مراجع

- [`HISABY-BHD-SSO-2026-08-20.md`](./HISABY-BHD-SSO-2026-08-20.md) — عَرَض 3  
- [`BHD-UNIFIED-LOGIN-AND-APPS.md`](./BHD-UNIFIED-LOGIN-AND-APPS.md) §0.7 / §4  
- [`BHD-IDENTITY-SSO.md`](./BHD-IDENTITY-SSO.md) — HS256 مؤقت حتى JWKS RS256
