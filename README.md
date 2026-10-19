# ShopEasy - Backend (Express + SQLite)

This repository folder contains a lightweight backend for the ShopEasy storefront. It provides basic APIs for products, orders and a small admin area protected via JWT.

This is a starter MVP: suitable for local testing and small demos. For production you should use a managed database (Postgres), HTTPS, secure cookies or other hardened auth, and a persistent server[...]

Files added
- package.json
- server.js
- .env.example

Quickstart (local)
1. Install dependencies

   npm install

2. Copy environment file

   cp .env.example .env
   # Edit .env as required (JWT_SECRET, ADMIN_PASSWORD, etc.)

3. Run in development

   npm run dev

4. Open

   - API health: http://localhost:4000/api/health
   - Products: http://localhost:4000/api/products

Pre-seeded admin
If you set ADMIN_USERNAME and ADMIN_PASSWORD in .env (or .env.example), the server will seed that admin user on first run.

Frontend integration (example)
- GET products: GET /api/products
- Submit order: POST /api/orders (body: product, price, name, phone, address, method, txnid)
- Admin login: POST /api/admin/login (body: username, password) -> returns token
- Admin orders: GET /api/admin/orders (Authorization: Bearer <token>)
- Admin add product: POST /api/admin/products (Authorization: Bearer <token>)

Deploy guide (short)

Option A — Render.com (quick)
1. Create a new Web Service and connect your GitHub repo and the branch `feature/backend-express`.
2. Set the Build Command to: `npm install`
3. Set the Start Command to: `npm start` (or `node server.js`)
4. In the Render dashboard, add environment variables:
   - JWT_SECRET (strong secret)
   - ADMIN_USERNAME and ADMIN_PASSWORD (initial admin)
   - DB_FILE (optional, default ./shopeasy.db)
   - CLIENT_ORIGIN (set your frontend URL, e.g. https://yourfrontend.example)
5. Deploy. Render will provide a public URL, copy it to your frontend's `API_BASE`.

Notes: SQLite file on Render will be stored in the container's disk — for production use a proper DB (Postgres) or provide a persistent disk.

Option B — Railway / Vercel (Serverless) / Other
- Same story: push repo, set env vars, set start command. For production use Postgres.

Docker (optional)
- You can containerize the backend with a simple Dockerfile and deploy to any container provider.

Security notes
- Do NOT store sensitive JWT secrets in code. Use platform environment variables.
- Use HTTPS & secure cookies for real production. Consider storing JWT in HTTP-only cookie.
- Validate and sanitize inputs server-side (express-validator is added).
- Add rate-limiting and CAPTCHAs for order endpoints if public.
- Set CLIENT_ORIGIN to your frontend domain in production. If you set CLIENT_ORIGIN to "*" it will allow requests from any origin which is NOT recommended in production.

Next steps (MVP -> production)
1. Replace SQLite with Postgres or managed DB.
2. Use HTTPS and secure cookie-based JWTs.
3. Add payment verification (bKash/Nagad/Stripe) server-side.
4. Add logging and monitoring (Sentry / Datadog).
