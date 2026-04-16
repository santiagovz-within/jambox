# JamBox Setup Guide

Welcome to the JamBox AI Social Content Engine! This guide will walk you through the step-by-step process of going from the raw code to a fully functioning local environment that generates concepts, posts them to Slack, and listens to team feedback.

---

## Step 1: Install Node.js
JamBox is built on **Node.js**. Since it's not currently installed on your Mac, you'll need it to run the backend and the dashboard.

1. Open a terminal.
2. Install **Homebrew** (a package manager for Mac) if you haven't already by pasting this command:
   \`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"\`
3. Once Homebrew is installed, run: 
   \`brew install node\`
4. Verify the installation worked by typing \`node -v\` and \`npm -v\`. You should see version numbers printed out.

---

## Step 2: Set Up Supabase (Database)
Supabase provides the PostgreSQL database where we store brand variables, concepts, and feedback logs.

1. Go to [Supabase.com](https://supabase.com/) and create a free account.
2. Click **"New Project"**. Give it a name (like `JamBox`) and a strong database password.
3. Once the project finishes provisioning, look at your project dashboard.
4. Go to **Settings (gear icon) > API**.
   - Copy the **Project URL**.
   - Copy the **`service_role` secret**. *(Do not share this publicly!)*
5. Go to the **SQL Editor** on the left menu (looks like a terminal `>_` icon).
6. Click **"New query"**.
7. Open the \`JamBox/supabase/schema.sql\` file on your computer, copy EVERYTHING inside it, paste it into the Supabase SQL Editor, and click **Run**. This constructs your database tables.

---

## Step 3: Integrate API Keys (.env file)
Now we need to let the code talk to the different AI and Slack services.

1. In the root \`/JamBox\` directory on your computer, create a new file named exactly \`.env\`
2. Copy and paste the following template into the file:

\`\`\`env
# AI Models
GEMINI_API_KEY=""
FAL_KEY=""

# Slack Bot
SLACK_BOT_TOKEN=""
SLACK_CHANNEL_ID=""

# Supabase Database
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
\`\`\`

3. **Fill in Supabase**: Paste the URL and `service_role` key from Step 2.
4. **Fill in Gemini**: Go to [Google AI Studio](https://aistudio.google.com/), sign in, and click **"Get API key"**. Paste it into `GEMINI_API_KEY`.
5. **Fill in FAL.ai**: Go to [FAL.ai](https://fal.ai/), create an account, go to your dashboard settings, generate an API key, and paste it into `FAL_KEY`.

---

## Step 4: Set Up Slack Integration
This is the trickiest part, but essential for the pipeline to work.

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click **"Create New App"** -> **"From scratch"**. Name it `Taco Brain` (or JamBox) and pick your Slack workspace.
2. Under exactly **"OAuth & Permissions"** on the left:
   - Scroll down to **Scopes > Bot Token Scopes**. Add: `chat:write`, `channels:read`, `users:read`, `commands`.
   - Scroll up and click **"Install to Workspace"**.
   - Copy the **"Bot User OAuth Token"** (starts with `xoxb-`). Paste this into your `.env` file as `SLACK_BOT_TOKEN`.
3. Open your Slack app, create a new channel (e.g., `#jambox-creative`).
   - Right-click the channel name, click "View channel details," scroll to the bottom, and copy the **Channel ID** (usually starts with a C). Paste this into your `.env` file as `SLACK_CHANNEL_ID`.
   - **Important**: You must add the app to this channel. In the Slack channel, type `@Taco Brain` (or whatever you named the app). Slack will say it's not in the channel and ask if you want to invite it. Say yes!

---

## Step 5: Test the Core Pipeline
You are ready for the magic!

1. Open your terminal and navigate to the JamBox folder:
   \`cd \path\to\JamBox\`
2. Install the code dependencies:
   \`npm install\`
3. Run the daily script:
   \`npm start\`
4. **Watch Slack:** If everything works, you will see a console log of the generations, and seconds later, Slack interactive cards will pop up in the channel you configured!

---

## Step 6: Test Slack Interactivity (Buttons & Webhook)
Right now, you can see the buttons in Slack, but clicking them gives an error. Slack needs a public URL to send the button-click signal to your local computer.

1. Install **Ngrok** on your Mac. In a terminal, run: `brew install ngrok/ngrok/ngrok`
2. Create a free Ngrok account, get your auth token, and run the command they give you (e.g., `ngrok config add-authtoken YOUR_TOKEN`).
3. We need to run a local server to receive Slack's message. We placed the code in `api/slack-interactivity.ts`. Because Vercel expects this format, the easiest local test is using the Vercel CLI:
   - Run \`npm install -g vercel\`
   - Run \`vercel dev\` in the `JamBox` root. (It will ask you to log in to Vercel and link a project. You can skip linking to a real project, just accept the defaults to run it locally on port 3000).
4. In a *new* terminal window, run: 
   \`ngrok http 3000\`
   Ngrok will show you a green "Forwarding" secure HTTPS URL (e.g., `https://1234-abcd.ngrok-free.app`). Copy this URL.
5. Go back to your [Slack App Dashboard](https://api.slack.com/apps).
6. Click **"Interactivity & Shortcuts"** on the left menu.
7. Toggle Interactivity to **ON**.
8. In the **Request URL** box, paste the Ngrok URL you copied, and append \`/api/slack-interactivity\`. 
   *(Example: `https://1234-abcd.ngrok-free.app/api/slack-interactivity`)*
9. Click **Save Changes** at the bottom.

**BOOM.** Go to Slack and click "APPROVE" on one of the concepts you generated earlier. Your terminal running `vercel dev` will receive the signal, trigger the Python/FAL.ai image generator, and post variations directly back as a thread reply! 

*(Note: When you deploy this to production, you'll simply update that Slack Request URL to your live Vercel domain!)*

---

## Step 7: Push to GitHub & Deploy to Vercel (Production)
To run this 24/7 without keeping your laptop open, we use a hybrid deployment architecture: GitHub natively handles the pipeline "cron" schedule, and Vercel hosts the web UI + Slack webhooks.

### 1: Push your Code to GitHub
1. Go to [GitHub.com](https://github.com/), log in, and click the **`+`** icon at the top right to create a **"New repository"**.
2. Name it something like `jambox-engine`. Scroll down and click **Create repository**.
3. *Leave the browser open.* Open the terminal on your Mac, make sure you are inside your `JamBox` folder, and run these three commands EXACTLY (replacing the `<YOUR_USERNAME>` part with the URL GitHub gives you):
   ```bash
   git remote add origin https://github.com/<YOUR_USERNAME>/jambox-engine.git
   git branch -M main
   git push -u origin main
   ```
4. Refresh the GitHub page. You should now see all your code files!

### 2: Add Secrets to GitHub
GitHub needs your API keys to run the daily morning generation engine.
1. On your new GitHub repository page, click **Settings** (top right tab).
2. On the left sidebar, scroll down to **Secrets and variables** -> **Actions**.
3. Click the green **New repository secret** button.
4. You need to add exactly 5 secrets. Open your local `.env` file, and create a GitHub Secret for each one (Name: `GEMINI_API_KEY`, Secret: `your_actual_key`). Do this for `GEMINI_API_KEY`, `FAL_KEY`, `SLACK_BOT_TOKEN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.

### 3: Deploy the Dashboard to Vercel
1. Go to [Vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **Add New** -> **Project**.
3. Find your `jambox-engine` GitHub repository and click **Import**.
4. In the "Configure Project" menu that pops up:
   - Expand the **Root Directory** section.
   - Click **Edit**, and select the **`dashboard`** folder. Click Save.
   - Expand the **Environment Variables** tab and paste your `.env` keys here too so the Next.js UI can reach Supabase.
   - Click **Deploy**. Wait for the confetti! Wait for it! 

### 4: Deploy the Webhook to Vercel
Now you have to deploy the webhook folder separately so Slack can reach it.
1. Go back to your main Vercel dashboard. Click **Add New** -> **Project** again.
2. Import the *exact same* `jambox-engine` GitHub repository.
3. This time, **LEAVE THE ROOT DIRECTORY BLANK**. (Do NOT select `dashboard`).
4. Click deploy. Vercel will safely deploy the `api/slack-interactivity.ts` file as a serverless function!
5. Once complete, copy the domain Vercel gives you (e.g., `https://jambox-engine-webhooks.vercel.app`).
6. Go back to your Slack App Dashboard -> **Interactivity & Shortcuts** -> update the **Request URL** from your Ngrok link to your new Vercel link! *(e.g., `https://jambox-engine-webhooks.vercel.app/api/slack-interactivity`)*

**You are done!** The dashboard is live, the webhooks listen 24/7, and GitHub Actions is permanently scheduled to run your database pipeline every single morning at 10 AM.
