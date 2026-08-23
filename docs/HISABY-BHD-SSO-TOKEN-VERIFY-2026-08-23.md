# حادثة دخول BHD — تعذر التحقق من الرمز (23 أغسطس 2026)

**العَرَض (حي):**  
`https://hisaby.bhd-om.com/login?bhd=verify`  
رسالة عن تعذّر التحقق من رمز الهوية / `BHD_IDENTITY_TOKEN_SECRET`.

---

## مرجع الهوية ([ainoamn/ONE-BHD](https://github.com/ainoamn/ONE-BHD))

| البند | القيمة الحية |
|--------|----------------|
| Issuer | `https://id.bhd-om.com` |
| اكتشاف | `https://id.bhd-om.com/.well-known/openid-configuration` |
| خوارزمية | `id_token_signing_alg_values_supported: ["HS256"]` |
| JWKS | `{"keys":[]}` — لا مفاتيح عامة بعد |
| توقيع التوكن | `IDENTITY_TOKEN_SECRET` وإلا `AUTH_SECRET` (`app/lib/identity/issuer.ts`) |
| `client_id` حسابي | `bhd-hisaby` |
| سر العميل (إن وُجد) | `BHD_OAUTH_CLIENT_SECRET_HISABY` على الهوية · `BHD_OAUTH_CLIENT_SECRET` على Render |

### حقول المستخدم بعد التحقق (إلزامي للمنتج)

من `signIdToken` / `GET /oauth/userinfo` في ONE-BHD:

| الحقل | مطلوب للدخول في حسابي |
|--------|-------------------------|
| `sub` | نعم → يُحفظ في `users.bhd_sub` |
| `email` | نعم |
| `email_verified` | يجب `true` وإلا `?bhd=email` |
| `name` | اختياري (يحدّث الاسم) |
| `picture` | اختياري (avatar) |
| `preferred_username` | اختياري |
| `phone_number` | اختياري |

### ربط المستخدم المحلي (§0.7)

1. إن وُجد `bhd_sub = sub` → افتح الجلسة واحتفظ بالدور.  
2. وإلا بريد موثّق مطابق و`bhd_sub` فارغ → اربط واحتفظ بالدور.  
3. وإلا → **لا إنشاء شركة/مستخدم جديد من الهوية** (`BHD_NO_LOCAL_USER` / `?bhd=no_user`) — دعوة من أدمن الشركة أولاً.

---

## السبب الأصلي

مع JWKS فارغ، التحقق التشفيري من `id_token` يحتاج نفس سر الهوية على Render باسم `BHD_IDENTITY_TOKEN_SECRET`.  
إن نُقص أو اختلفت القيمة عن `IDENTITY_TOKEN_SECRET` (أو عن `AUTH_SECRET` إن كان الهوية تستخدمه كاحتياطي) يظهر `?bhd=verify`.

الكود وحده لا يضبط أسرار Render.

---

## الإصلاح في الكود (حسابي — بعد هذا المستند)

بعد تبادل `authorization_code` + PKCE بنجاح:

1. حاول تحقق `id_token` (HS256 بالسر أو JWKS).  
2. إن فشل → `GET {issuer}/oauth/userinfo` بـ `Authorization: Bearer {access_token}`، مع فحص `nonce` من حمولة `id_token` دون الاعتماد على السر المشترك.

بهذا يعمل الدخول الموحّد **حتى بدون** `BHD_IDENTITY_TOKEN_SECRET` على Render، طالما تبادل الكود نجح والهوية ترد على userinfo.

فحص الجاهزية (بدون كشف أسرار):

`GET https://hisaby-api.onrender.com/api/auth/bhd/status`

---

## إصلاح تشغيلي مُستحسن (ما زال)

1. Vercel → `one-bhd` → انسخ `IDENTITY_TOKEN_SECRET` (إن فاضي: جرّب نفس قيمة `AUTH_SECRET` لأن الهوية تسقط إليه).  
2. Render → `hisaby-api` → Environment:

```env
BHD_IDENTITY_TOKEN_SECRET=<نفس القيمة حرفياً>
BHD_IDENTITY_ISSUER=https://id.bhd-om.com
BHD_OAUTH_CLIENT_ID=bhd-hisaby
```

3. Manual Deploy / Restart حتى يظهر `commit` الجديد في `/api/health`.  
4. أعد: `https://hisaby.bhd-om.com/api/auth/bhd/start?returnTo=/dashboard`

---

## عَرَض لاحق: `?bhd=exchange` (نفس اليوم)

بعد نشر احتياطي userinfo، إن ظهر `exchange` فالمصادقة مع الهوية نجحت غالباً ثم فشل **ربط المستخدم المحلي** أو جلسة المنتج، وكان رمز الخطأ غير مُستخرَج.

الأسباب الشائعة:

| السبب | رمز أوضح بعد الإصلاح |
|--------|----------------------|
| لا مستخدم حسابي بنفس البريد | `?bhd=no_user` |
| البريد مربوط بـ `bhd_sub` آخر | `?bhd=linked` |
| حساب/شركة غير نشط | `?bhd=inactive` |
| عمود `bhd_sub` غير مُرحَّل | `?bhd=schema` |

**ماذا تفعل:** تأكد أن بريدك على `id.bhd-om.com` يطابق مستخدماً موجوداً في حسابي (دعوة)، أو ادخل طارئاً بـ `/login?local=1` كأدمن وأنشئ/ادعُ المستخدم ثم أعد SSO.

---

## بعد نجاح الدخول

1. تأكد `bhd_sub` للمستخدم.  
2. في ONE-BHD اقلب حسابي إلى `mode: "sso"` في `apps.ts`.  
3. اختبار منتج ثانٍ بلا إعادة كلمة مرور.

## مراجع

- [`HISABY-BHD-SSO-2026-08-20.md`](./HISABY-BHD-SSO-2026-08-20.md)  
- [`BHD-UNIFIED-LOGIN-AND-APPS.md`](./BHD-UNIFIED-LOGIN-AND-APPS.md) §0.7 / §4 / §12.3  
- [`BHD-IDENTITY-SSO.md`](./BHD-IDENTITY-SSO.md)  
- ONE-BHD: `app/lib/identity/tokens.ts`, `clients.ts`, `issuer.ts`
