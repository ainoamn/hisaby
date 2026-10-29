# عزل بيانات الحساب بعد التبديل (خصوصية — نموذج جوجل)

> **Issuer:** https://id.bhd-om.com  
> **النموذج:** `?au=<sub>` + rebind JSON صامت — بلا رسائل «جاري عزل».

---

## القاعدة

1. **تبويب:** `bhd_account_tokens` + `bhd_active_au` + `?au=` (يُزال `_bhd` بعد التحميل).
2. **تبديل من القائمة:** `paintPrivacyVeil()` → `switchWindowAccount` (`X-BHD-Persist-Cookie:1`) → form rebind.
3. **انحراف:** `silentRebind` عبر proxy `frontend/.../rebind` → Nest `POST /api/auth/bhd/rebind` JSON.
4. **لوحة التحكم:** `BhdPrivacyGateDashboard` في `(dashboard)/layout.tsx`.
5. **خلفية:** `BhdSilentSso` ~20s.

مرجع: `frontend/src/lib/identity/client.ts` · `BhdPrivacyGate` · `BhdSilentSso`.
