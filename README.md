# 📻 JamBox Social Content Engine

**JamBox** is an AI-powered content engine that automates the creation of social media concepts. It generates ideas using Gemini, creates visuals via FAL.ai, and integrates directly with Slack for a seamless approval workflow.

---

## 🚀 Current Status: Live & Deployed
The application is currently **fully deployed and operational**:
- **Dashboard**: Hosted on Vercel (Next.js)
- **API/Webhooks**: Serverless functions deployed on Vercel
- **Database**: Managed by Supabase
- **Pipeline**: Automated via GitHub Actions (running daily at 10 AM)

---

## ✨ Key Features
- **Deterministic Content Generation**: Brand-aligned content generation using Google Gemini.
- **High-Quality Visuals**: Dynamic image generation using FAL.ai (Flux models).
- **Slack Operations**: 
  - Automated posting of new concepts.
  - Interactive "Approve" buttons that trigger immediate variant generation.
  - Slack-to-Supabase feedback loop.
- **Analytics Dashboard**: A centralized view for managing brand variables and tracking content performance.

---

## 🏗️ Architecture
- **`/src/pipeline`**: The core logic for generating concepts and notifying Slack.
- **`/api`**: Serverless Slack interactivity handlers.
- **`/dashboard`**: Next.js management interface.
- **`/supabase`**: Database schemas and edge logic.

---

## 🛠️ Local Development & Setup

If you need to run JamBox locally or make modifications, follow these steps:

### Step 1: Install Node.js
JamBox is built on **Node.js**. Ensure you have it installed:
1. `brew install node`
2. Verify with `node -v`

### Step 2: Environment Variables
Create a `.env` file in the root directory with the following keys:
```env
# AI Models
GEMINI_API_KEY="your_gemini_key"
FAL_KEY="your_fal_key"

# Slack Bot
SLACK_BOT_TOKEN="xoxb-..."
SLACK_CHANNEL_ID="C..."

# Supabase Database
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
```

### Step 3: Run the Pipeline
To test the generation engine locally:
```bash
npm install
npm start
```

### Step 4: Local Webhook Testing
To test Slack buttons locally:
1. Run `vercel dev` in the root (port 3000).
2. Run `ngrok http 3000` to create a tunnel.
3. Update Slack Request URL to `https://<ngrok-id>.ngrok-free.app/api/slack-interactivity`.

---

## 🌎 Production Deployment Details

### GitHub Actions
The pipeline is triggered automatically via `.github/workflows/daily-generation.yml`. 
*Ensure all `.env` secrets are mirrored in **GitHub Repository Secrets**.*

### Vercel Hosting
- **Dashboard**: Deploy the `dashboard` folder.
- **Webhooks**: Deploy the root directory (excluding dashboard) to host serverless functions in `/api`.

---

## 📊 Database Schema
The database is structured to handle:
- `brand_variables`: Dynamic settings for the AI.
- `concepts`: Generated content and approval statuses.
- `feedback_logs`: Historical interactions from Slack.

*SQL migration files are located in `/supabase/schema.sql`.*