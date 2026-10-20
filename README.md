# CG MP Job Alert — Secure Admin + Database starter

यह starter project public job-listing website, server-side SQLite database, admin login, job add/delete और search/filter API देता है। यह production-ready hosted service नहीं है; deployment से पहले नीचे के setup और security steps पूरे करें।

## आवश्यकताएँ
- Node.js 20 या नया
- Terminal / Command Prompt
- Production hosting पर HTTPS

## Local setup
1. ZIP extract करें और इस folder में terminal खोलें।
2. `npm install` चलाएँ।
3. `.env.example` की copy बनाकर उसका नाम `.env` रखें।
4. `.env` में `SESSION_SECRET` के लिए कम-से-कम 32 characters का random secret और `ADMIN_PASSWORD` के लिए unique, strong password रखें (कम-से-कम 12 characters)।
5. `npm start` चलाएँ।
6. Website: `http://localhost:3000`
7. Admin: `http://localhost:3000/admin.html`

## Admin credentials
पहली बार start होने पर `.env` के `ADMIN_USERNAME` और `ADMIN_PASSWORD` से admin record बनता है; password database में bcrypt hash के रूप में store होता है। Existing admin database में मौजूद होने पर `.env` बदलने मात्र से password नहीं बदलेगा। Password reset के लिए सुरक्षित server-side maintenance प्रक्रिया चाहिए; database file सार्वजनिक न करें।

## मुख्य API
- `GET /api/jobs` — public jobs; optional `q`, `state`, `category` filters
- `POST /api/admin/login` — admin login
- `GET /api/admin/me` — current session
- `POST /api/admin/logout` — logout
- `POST /api/admin/jobs` — authenticated admin adds job
- `DELETE /api/admin/jobs/:id` — authenticated admin deletes job

## Deployment checklist
- Hosting में environment variables सेट करें; `.env` GitHub पर upload न करें।
- HTTPS enable करें और `NODE_ENV=production` सेट करें।
- SQLite file को persistent disk/volume पर रखें; temporary serverless filesystem पर नहीं।
- नियमित database backups और dependency updates रखें।
- Production use के लिए persistent session store (default MemoryStore production के लिए उपयुक्त नहीं), CSRF protection, audit logging, monitoring, admin password reset/rotation, and deployment-specific security review जोड़ें।
- Admin account साझा न करें। Strong unique password और server secrets सुरक्षित रखें।
- नौकरी की जानकारी आधिकारिक notification से verify करके ही प्रकाशित करें। इस starter में कोई live vacancy feed शामिल नहीं है; database शुरू में खाली है।

## Important
यह demo/starter है, professional security audit का विकल्प नहीं। इसे public internet पर deploy करने से पहले production checklist पूरी करें।
