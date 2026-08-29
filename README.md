# DK-AI — Setup Guide (Step by Step, Beginner Friendly)

DK-AI is your own AI web app with two modes:
- **Chat** — talk to it / ask it to write code (like ChatGPT, Claude, Copilot)
- **Search** — it searches the live internet and answers with sources (like Perplexity)

It costs ₹0. You only need free accounts (no credit card).

---

## STEP 1 — Install Node.js (one time only)

1. Go to https://nodejs.org
2. Download the **LTS version** and install it (click Next, Next, Finish).
3. To check it worked, open Command Prompt (Windows) or Terminal (Mac) and type:
   ```
   node -v
   ```
   You should see a version number like `v20.x.x`.

## STEP 2 — Get your free Gemini API key (the "brain")

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with any Google account.
3. Click **Create API key**.
4. Copy the key (looks like `AIzaSy...`). Keep it safe.

## STEP 3 — Get your free Tavily API key (the "search")

1. Go to https://tavily.com
2. Click **Sign Up** (email or Google/GitHub login).
3. Go to your dashboard — your API key is shown there (starts with `tvly-`).
4. Copy it.

## STEP 4 — Set up the project folder on your computer

1. Copy the whole `dk-ai` folder I made onto your computer (Desktop is fine).
2. Open that folder in Command Prompt / Terminal. Easiest way:
   - Windows: open the folder, click the address bar, type `cmd`, press Enter.
   - Mac: right-click the folder → "New Terminal at Folder" (or open Terminal and `cd` into it).
3. Rename the file `.env.example` to `.env`
4. Open `.env` in Notepad and paste your two keys like this:
   ```
   GEMINI_API_KEY=AIzaSy_your_real_key_here
   TAVILY_API_KEY=tvly_your_real_key_here
   ```
   Save the file.

## STEP 5 — Install and run

In the same terminal, type:
```
npm install
```
Wait for it to finish (downloads the small libraries the app needs). Then type:
```
npm start
```
You should see:
```
DK-AI server running at http://localhost:3000
```
Open your browser and go to **http://localhost:3000** — DK-AI is now running on your computer! 🎉

Try:
- Chat mode: "Write a Python function to check if a number is prime"
- Search mode: "Who won the latest ICC match" (it will search the web live)

---

## STEP 6 — Put your code on GitHub (free, needed for hosting + your resume)

1. Create a free account at https://github.com
2. Create a new repository called `dk-ai` (keep it Public).
3. Follow GitHub's "upload existing folder" option (there's a button "uploading an existing file" on the empty repo page) and upload all your project files EXCEPT the `.env` file and `node_modules` folder (never upload your `.env` — it has your secret keys).

## STEP 7 — Put DK-AI live on the internet for free (Render.com)

1. Go to https://render.com and sign up free (you can use your GitHub account to sign in).
2. Click **New +** → **Web Service**.
3. Connect your GitHub and select your `dk-ai` repository.
4. Fill in:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Scroll to **Environment Variables** and add:
   - `GEMINI_API_KEY` = your key
   - `TAVILY_API_KEY` = your key
6. Click **Create Web Service**. Wait 2–3 minutes.
7. Render gives you a live link like `https://dk-ai.onrender.com` — this is your app, live on the internet, for free! Share this link with your placement panel.

Note: Render's free tier "sleeps" after 15 minutes of no visitors and takes ~30 seconds to wake up on the next visit. That's normal for free hosting — mention it if asked, it's not a bug.

---

## STEP 8 — (Later) Turning this into a mobile app

Once this web version works, you can wrap it into an app using free tools like **Median.co** or **Capacitor** — they turn a website into an installable Android/iOS app without rewriting your code. Ask me when you're ready and I'll walk you through it.

---

## How to explain this project in your placement interview

- **What it does:** A unified AI assistant — chat, code help, and web-grounded search with citations, in one interface.
- **Tech stack:** Node.js + Express backend, vanilla JS frontend, Google Gemini API (LLM), Tavily API (real-time web search/RAG).
- **Key concept to mention:** RAG (Retrieval-Augmented Generation) — in Search mode, the app first fetches live web results, then feeds them to the AI model so it answers using current facts with sources, instead of relying only on the model's training data.
- **Why backend matters:** API keys are kept on the server (never exposed in the browser) — this is a real security practice, good to mention.

## If something breaks

- "Missing GEMINI_API_KEY" → check your `.env` file has the correct key and you restarted `npm start`.
- "npm install" errors → make sure you're inside the `dk-ai` folder in the terminal (check with `dir` on Windows or `ls` on Mac).
- Page loads but nothing happens when you send a message → open browser DevTools (F12) → Console tab → tell me the red error text.
