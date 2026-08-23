# نقطة التوقف — استكمال العمل (محدّث 23 أغسطس 2026)

**الغرض:** تسليم نظيف بلا تعارض. على الجهاز الآخر: `git pull origin main` ثم اقرأ هذا الملف.

---

## 1) أين نحن الآن؟

| عنصر | القيمة |
|------|--------|
| المستودع | https://github.com/ainoamn/BHD-Pro (قد يُعاد توجيهه إلى `ainoamn/hisaby`) |
| الفرع | **`main`** |
| الالتزام | **`853b171`** — تحقق id_token بـ HS256 |
| API الحي | `commit: 853b171…` على `hisaby-api.onrender.com` |
| الواجهة | `hisaby.bhd-om.com` / Vercel |

### الدخول الموحّد BHD

| الحالة | التفاصيل |
|--------|----------|
| الكود | start / callback / admin-entry + `bhd_sub` منشور |
| عطل حي شائع | `?bhd=verify` → ناقص `BHD_IDENTITY_TOKEN_SECRET` على Render |
| الإصلاح التشغيلي | انسخ `IDENTITY_TOKEN_SECRET` من `one-bhd` → Render كـ `BHD_IDENTITY_TOKEN_SECRET` ثم أعد التشغيل |
| وثيقة الحادثة | [`HISABY-BHD-SSO-TOKEN-VERIFY-2026-08-23.md`](./HISABY-BHD-SSO-TOKEN-VERIFY-2026-08-23.md) |
| تثبيت SSO | [`HISABY-BHD-SSO-2026-08-20.md`](./HISABY-BHD-SSO-2026-08-20.md) |
| كتالوج ONE-BHD | حسابي ما زال `mode: browse` حتى نجاح دخول حي ثم قلب إلى `sso` |

---

## 2) مهام مفتوحة

1. [ ] ضبط `BHD_IDENTITY_TOKEN_SECRET` على Render وإعادة تشغيل  
2. [ ] دخول ناجح → `/dashboard` + صف فيه `bhd_sub`  
3. [ ] قلب `mode: "sso"` في ONE-BHD `apps.ts`  
4. [ ] واتساب Meta `#200` — Permanent Token  
5. [ ] `HARDENING_STRICT_BOOT=true` بعد TOTP + S3 (أو الإبقاء على override dataurl موثّقاً)

---

## 3) على الكمبيوتر الآخر

```powershell
git fetch origin
git switch main
git pull origin main
git rev-parse --short HEAD   # ≥ 853b171
```

لا تترك تعديلات غير مرفوعة على جهازين. الأسرار على Render/Vercel فقط — ليست في Git.
