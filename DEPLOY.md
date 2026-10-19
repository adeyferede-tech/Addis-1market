# Put the shop on the internet

## Option A: Render (free, HTTPS included, easiest)
1. Create a GitHub account and a new PRIVATE repo. Upload this folder (`.env` is excluded by .gitignore).
2. Go to render.com > New > Web Service > connect the repo.
3. Build command: `npm install`   Start command: `npm start`
4. Environment tab: add GMAIL_USER, GMAIL_APP_PASSWORD, TELEGRAM_BOT_TOKEN,
   TELEGRAM_CHAT_ID, CHAPA_SECRET_KEY.
5. Deploy. Copy your URL (https://addis-market.onrender.com).
6. Add PUBLIC_URL = that URL, then redeploy.
Note: the free plan sleeps after 15 min idle (first visit takes ~30s). Paid plan stays awake.

## Option B: VPS (Ubuntu) with your own domain
    sudo apt update && sudo apt install -y nodejs npm caddy
    sudo npm i -g pm2
    cd /opt/shop && npm install && cp .env.example .env && nano .env
    pm2 start server.js --name shop && pm2 save && pm2 startup
Caddy (`/etc/caddy/Caddyfile`) gives automatic HTTPS:
    yourdomain.com {
        reverse_proxy localhost:3000
    }
    sudo systemctl reload caddy
Point your domain's A record to the server IP first.

## Before real customers
- Set CHAPA_SECRET_KEY to the LIVE key (not TEST).
- Put your real Telebirr/CBE numbers in public/index.html (search `0911 000 000`).
- Edit PRODUCTS in server.js.
- Open /health in the browser to confirm it is running.
