# MC AFK Bot — Render + UptimeRobot Setup

## How it works
- The bot connects to your Minecraft server (offline/cracked mode)
- A tiny HTTP server runs alongside it so Render thinks it's a live web app
- UptimeRobot pings that HTTP server every 14 minutes for free, keeping Render from sleeping it
- Result: bot stays connected 24/7, your PC can be off

---

## Step 1 — Push this to GitHub

1. Go to github.com and create a free account if you don't have one
2. Create a new repository, call it `mc-afk-bot`, set it to Public
3. On your PC, install Git from git-scm.com if you don't have it
4. Open a terminal in this folder and run:
   ```
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/YOURUSERNAME/mc-afk-bot.git
   git push -u origin main
   ```
   Replace YOURUSERNAME with your actual GitHub username.

---

## Step 2 — Deploy on Render

1. Go to render.com and sign up (free, no card needed)
2. Click **New** → **Web Service**
3. Connect your GitHub account and pick the `mc-afk-bot` repo
4. Fill in these settings:
   - **Name**: mc-afk-bot (or anything)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Before clicking Deploy, click **Add Environment Variable** and add these three:
   | Key | Value |
   |-----|-------|
   | MC_USERNAME | whoishere (or your desired username) |
   | MC_HOST | your.server.ip |
   | MC_PORT | 25565 (or your server's port) |
6. Click **Create Web Service** — Render will build and start the bot

Once it says "Live", copy the URL it gives you (looks like `https://mc-afk-bot-xxxx.onrender.com`)

---

## Step 3 — Keep it alive with UptimeRobot (free)

Without this step, Render sleeps the bot after 15 minutes. UptimeRobot pings it for free.

1. Go to uptimerobot.com and create a free account
2. Click **Add New Monitor**
3. Set:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: MC Bot
   - **URL**: paste your Render URL from Step 2
   - **Monitoring Interval**: Every 14 minutes
4. Click **Create Monitor**

That's it. UptimeRobot will ping your bot every 14 minutes, Render sees activity and never sleeps it.

---

## Checking logs / seeing chat

- Go to render.com → your service → **Logs** tab
- You'll see everything printed there: connections, chat messages from other players, kicks, reconnects

## Changing username or server

- Go to Render → your service → **Environment** tab
- Edit the values and click Save — Render restarts the bot automatically

## If the bot gets kicked or disconnects

It auto-reconnects after 10 seconds. You'll see it in the logs.