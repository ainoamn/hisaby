# نقطة التوقف — 23 أغسطس 2026 (مساءً)

بعد `a72a9ce` ما زال `?bhd=exchange`. إصلاح `08f3235`: بذور غير حاجبة + migrate عند الإقلاع + أخطاء `provision`.

1. انتظر Render Live لـ `08f3235` (Docker يشغّل migrate)
2. `GET /api/auth/bhd/status` → `bhdSubColumn: true`
3. أعد SSO من hisaby.bhd-om.com
