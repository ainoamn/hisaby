# إصلاح SSO exchange بعد §3.3 (23 أغسطس 2026 — مساءً)

**العَرَض:** بعد نشر إنشاء المستخدم ما زال `?bhd=exchange`.

**الإصلاحات:**

1. إنشاء الشركة+المستخدم في **معاملة**؛ بذور الحسابات/مراكز التكلفة **لا توقف الدخول**.
2. عند فشل فريد/سباق: إعادة تحميل بالبريد/`bhd_sub`.
3. أخطاء الجلسة/الإنشاء → `?bhd=provision&why=…` بدل exchange الغامض.
4. تطبيع `User-Agent` (مصفوفة/طول) قبل `sessions`.
5. Dockerfile: `prisma migrate deploy` عند كل إقلاع حتى يُطبَّق عمود `bhd_sub`.
6. `/api/auth/bhd/status` يعرض `bhdSubColumn`.

**تحقق بعد Live:**

```
GET https://hisaby-api.onrender.com/api/health
GET https://hisaby-api.onrender.com/api/auth/bhd/status
```

`bhdSubColumn: true` ثم أعد SSO.
