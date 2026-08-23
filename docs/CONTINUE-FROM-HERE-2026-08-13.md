# نقطة التوقف — استكمال العمل (محدّث 23 أغسطس 2026)

**الغرض:** تسليم نظيف بلا تعارض. على الجهاز الآخر: `git pull origin main` ثم اقرأ هذا الملف.

---

## 1) أين نحن الآن؟

| عنصر | القيمة |
|------|--------|
| المستودع | https://github.com/ainoamn/BHD-Pro (قد يُعاد توجيهه إلى `ainoamn/hisaby`) |
| الفرع | **`main`** |
| الهوية | [ainoamn/ONE-BHD](https://github.com/ainoamn/ONE-BHD) · `id.bhd-om.com` · HS256 · JWKS فارغ |
| الواجهة | `hisaby.bhd-om.com` / Vercel |

### الدخول الموحّد BHD

| الحالة | التفاصيل |
|--------|----------|
| الكود | start / callback / admin-entry + `bhd_sub` + احتياطي **userinfo** بعد تبادل الكود |
| حقول الهوية | `sub`, `email`, `email_verified` (إلزامي)، `name`, `picture`, `preferred_username`, `phone_number` |
| عطل سابق | `?bhd=verify` عندما ينقص سر HS256 على Render |
| بعد النشر | يدخل عبر userinfo حتى بدون السر؛ السر ما زال مُستحسناً |
| جاهزية | `GET /api/auth/bhd/status` |
| وثيقة | [`HISABY-BHD-SSO-TOKEN-VERIFY-2026-08-23.md`](./HISABY-BHD-SSO-TOKEN-VERIFY-2026-08-23.md) |
| كتالوج ONE-BHD | `mode: browse` حتى نجاح حي ثم `sso` |

---

## 2) مهام مفتوحة

1. [ ] انتظار Deploy Live لـ Render `hisaby-api` على commit الذي فيه userinfo fallback  
2. [ ] `GET /api/health` يظهر commit الجديد · أعد دخول SSO  
3. [ ] (مُستحسن) ضبط `BHD_IDENTITY_TOKEN_SECRET` على Render  
4. [ ] قلب `mode: "sso"` في ONE-BHD بعد نجاح الدخول  
5. [ ] واتساب Meta `#200` — Permanent Token  

---

## 3) على الكمبيوتر الآخر

```powershell
git fetch origin
git switch main
git pull origin main
git rev-parse --short HEAD
```

لا تترك تعديلات غير مرفوعة على جهازين. الأسرار على Render/Vercel فقط — ليست في Git.
