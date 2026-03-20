# Axis Content Hub — Complete Setup & Deployment Guide

**Written for complete beginners. No prior experience required.**

This guide walks you through every step needed to get Axis Content Hub running live on the internet — from creating accounts to making your first login. Follow each step in order.

---

## What You'll Set Up

| Service | Purpose | Cost |
|---------|---------|------|
| **GitHub** | Stores your code | Free |
| **Supabase** | Database + Authentication | Free tier available |
| **Cloudflare R2** | Primary file storage | Free up to 10GB/month |
| **Backblaze B2** | Backup file storage | Free up to 10GB |
| **Vercel** | Hosts the website | Free tier available |

Estimated setup time: **45–60 minutes** for a first-timer.

---

## PART 1 — GitHub Setup

GitHub stores your code and connects to Vercel for automatic deployments.

### Step 1: Create a GitHub Account

1. Go to **https://github.com**
2. Click **Sign up** in the top-right corner
3. Enter your email, create a password, and choose a username
4. Follow the verification steps (check your email)
5. You now have a GitHub account

### Step 2: Create a New Repository

1. Once logged in, click the **+** icon in the top-right corner
2. Click **New repository**
3. Fill in:
   - **Repository name**: `axis-content-hub` (or any name you like)
   - **Visibility**: Private (recommended — this is internal company code)
4. Do **NOT** tick "Add a README file" (the code already has one)
5. Click **Create repository**
6. You'll see a page with setup instructions — keep this tab open

### Step 3: Push the Code to GitHub

On your computer, open Terminal (Mac) or Command Prompt (Windows) and run these commands from inside the project folder:

```bash
git remote add origin https://github.com/YOUR-USERNAME/axis-content-hub.git
git branch -M main
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.

---

## PART 2 — Supabase Setup (Database & Auth)

Supabase handles your database and user authentication.

### Step 4: Create a Supabase Account

1. Go to **https://supabase.com**
2. Click **Start your project** (top-right)
3. Sign up with GitHub (easiest) or email
4. Complete the verification

### Step 5: Create a New Project

1. Once inside Supabase, click **New project**
2. Choose your organisation (or create one — your company name works)
3. Fill in:
   - **Project name**: `axis-content-hub`
   - **Database password**: Create a strong password and **save it somewhere safe** (you'll need it occasionally)
   - **Region**: Choose the region closest to your team (e.g. London for UK users → `eu-west-2`)
4. Click **Create new project**
5. Wait 1–2 minutes while Supabase sets up your database (you'll see a loading screen)

### Step 6: Get Your Supabase Credentials

Once the project is ready:

1. In the left sidebar, click the **gear icon** (Settings)
2. Click **API** in the settings menu
3. You'll see three values — copy each one:
   - **Project URL** → this is your `NEXT_PUBLIC_SUPABASE_URL` (looks like `https://abcdefghij.supabase.co`)
   - **anon public key** → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY` (long string starting with `eyJ...`)
   - **service_role secret key** → this is your `SUPABASE_SERVICE_ROLE_KEY` (another long string — **keep this secret, never share it**)

📸 **Where to find this**: Settings → API → "Project URL" and "Project API keys" section.

### Step 7: Run the Database Migration

This creates all the tables, relationships, and security rules your app needs.

1. In the left sidebar, click **SQL Editor** (icon looks like `</>`)
2. Click **New query** (top-left of the editor)
3. Open the file `supabase/migrations/001_initial.sql` from your project folder on your computer
4. Copy the **entire contents** of that file
5. Paste it into the SQL Editor in Supabase
6. Click the green **Run** button (or press Ctrl+Enter)
7. You should see "Success. No rows returned" at the bottom — this means everything worked
8. Click **Table Editor** in the sidebar to verify tables were created: you should see `users`, `content_items`, `tags_master`, `content_views`, `backup_logs`

---

## PART 3 — Cloudflare R2 Setup (Primary File Storage)

R2 stores all uploaded files (PDFs, images, presentations, etc.).

### Step 8: Create a Cloudflare Account

1. Go to **https://cloudflare.com**
2. Click **Sign up** (top-right)
3. Enter your email and create a password
4. Verify your email address

### Step 9: Set Up R2 Storage

1. Once logged in, look at the left sidebar and click **R2 Object Storage**
   - (If you don't see it, click the grid icon or search for "R2" in the search bar)
2. Click **Create bucket**
3. Fill in:
   - **Bucket name**: `axis-content-primary` (must match exactly)
   - **Location**: Automatic (or choose your region)
4. Click **Create bucket**

### Step 10: Enable Public Access for Your Bucket

This lets the app display uploaded files (thumbnails, images, PDFs).

1. Click on your `axis-content-primary` bucket
2. Click the **Settings** tab
3. Scroll down to **Public access**
4. Click **Allow access** and confirm
5. You'll see a public URL like `https://pub-xxxxxxxxxxxx.r2.dev` — **copy this**, you'll need it as `R2_PUBLIC_URL`

### Step 11: Create R2 API Credentials

1. In the R2 section, click **Manage R2 API tokens** (top-right of the R2 page)
2. Click **Create API token**
3. Fill in:
   - **Token name**: `axis-content-hub`
   - **Permissions**: Object Read & Write
   - **Specify bucket**: Select `axis-content-primary`
4. Click **Create API token**
5. You'll see:
   - **Access Key ID** → this is your `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → this is your `R2_SECRET_ACCESS_KEY` (**copy this now** — it won't be shown again)

📸 **Your Account ID** is shown at the top of any Cloudflare page in the right sidebar, or go to the R2 overview page — it appears as "Account ID". This is your `R2_ACCOUNT_ID`.

---

## PART 4 — Backblaze B2 Setup (Backup Storage)

B2 stores automatic backups of all uploaded files.

### Step 12: Create a Backblaze Account

1. Go to **https://backblaze.com**
2. Click **Sign up for free** → choose **B2 Cloud Storage**
3. Enter your details and create an account
4. Verify your email

### Step 13: Create a B2 Bucket

1. Once logged in, click **Buckets** in the left menu (under Cloud Storage)
2. Click **Create a Bucket**
3. Fill in:
   - **Bucket unique name**: `axis-content-backup` (or add a unique suffix if taken, e.g. `axis-content-backup-2024`)
   - **Files in Bucket are**: Private
4. Click **Create a Bucket**
5. After creation, note the **Endpoint** shown in the bucket details — it looks like `s3.us-west-004.backblazeb2.com`

### Step 14: Create B2 Application Keys

1. In the left menu, click **App Keys** (under Account)
2. Click **Add a New Application Key**
3. Fill in:
   - **Name of Key**: `axis-content-hub`
   - **Allow access to Bucket(s)**: Select your `axis-content-backup` bucket
   - **Type of Access**: Read and Write
4. Click **Create New Key**
5. You'll see:
   - **keyID** → this is your `B2_ACCESS_KEY_ID`
   - **applicationKey** → this is your `B2_SECRET_ACCESS_KEY` (**copy this now** — it won't be shown again)

Your `B2_ENDPOINT` is the S3-compatible endpoint, formatted as `https://s3.us-west-004.backblazeb2.com` (use the region shown in your bucket details).

---

## PART 5 — Vercel Setup (Hosting & Deployment)

Vercel hosts the website and automatically deploys when you push code to GitHub.

### Step 15: Create a Vercel Account

1. Go to **https://vercel.com**
2. Click **Sign up** (top-right)
3. Click **Continue with GitHub** (easiest option — links your accounts)
4. Authorise Vercel to access your GitHub

### Step 16: Import Your Project

1. Once logged into Vercel, click **Add New...** → **Project**
2. Under "Import Git Repository", find `axis-content-hub` and click **Import**
3. Vercel will detect it's a Next.js project automatically
4. **Do not click Deploy yet** — you need to add environment variables first

### Step 17: Add Environment Variables

This is where you enter all the credentials from the previous steps.

1. On the project configuration page, find the **Environment Variables** section
2. Add each variable below by typing the name in the "Key" box and the value in the "Value" box, then clicking **Add**

| Variable Name | Where to get it |
|--------------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `R2_ACCOUNT_ID` | Cloudflare → right sidebar → Account ID |
| `R2_ACCESS_KEY_ID` | Cloudflare → R2 → Manage API Tokens → your token |
| `R2_SECRET_ACCESS_KEY` | Cloudflare → R2 → Manage API Tokens → your token |
| `R2_BUCKET_NAME` | `axis-content-primary` |
| `R2_PUBLIC_URL` | Cloudflare → R2 → bucket → Settings → Public URL |
| `B2_ENDPOINT` | `https://s3.us-west-004.backblazeb2.com` (check your region) |
| `B2_ACCESS_KEY_ID` | Backblaze → App Keys → keyID |
| `B2_SECRET_ACCESS_KEY` | Backblaze → App Keys → applicationKey |
| `B2_BUCKET_NAME` | `axis-content-backup` (or your exact bucket name) |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL (add this AFTER first deploy — see below) |

3. Make sure **all environments** are selected (Production, Preview, Development) for each variable
4. Now click **Deploy**

### Step 18: Get Your Live URL

1. After deployment (takes 1–3 minutes), Vercel shows a success screen
2. Your app URL will be something like `https://axis-content-hub.vercel.app`
3. Go back to **Settings → Environment Variables**
4. Add one more variable:
   - **Key**: `NEXT_PUBLIC_APP_URL`
   - **Value**: `https://your-actual-url.vercel.app` (replace with your real URL)
5. Click **Save**
6. Go to **Deployments** and click **Redeploy** on the latest deployment to apply this last variable

---

## PART 6 — Create Your First Admin User

This is how you become the administrator of the application.

### Step 19: Configure Supabase Auth Redirect URLs

**This step is required for sign-in to work.** Supabase only sends magic links to whitelisted callback URLs.

1. Go to **Supabase** → your project → **Authentication** → **URL Configuration**
2. Under **Site URL**, enter your app URL:
   ```
   https://your-actual-url.vercel.app
   ```
3. Under **Redirect URLs**, click **Add URL** and add:
   ```
   https://your-actual-url.vercel.app/auth/callback
   ```
4. Click **Save**

> **Why is this needed?** When a user clicks the magic link in their email, Supabase redirects them to `/auth/callback` on your app. Supabase requires this URL to be whitelisted for security — without it, sign-in links will fail.

### Step 20: Sign In for the First Time

1. Go to your live app URL (e.g. `https://axis-content-hub.vercel.app`)
2. You'll see the sign-in screen
3. Enter **your email address** and click **Send sign-in link**
4. Check your email — you should receive a magic link from Supabase
   - If no email arrives within 2 minutes, check your spam folder
   - If still nothing, check Supabase → Authentication → Email Templates to verify email sending is enabled
5. Click the link in the email — you'll be signed in automatically

### Step 21: Promote Yourself to Admin

When you first sign in, your account is created with the `viewer` role (the most limited role). You need to manually promote yourself to Admin.

1. Go to **Supabase** → your project → **Table Editor**
2. Click on the **users** table
3. Find your row (look for your email in the `id` column — hover over IDs to see if they match your user UUID)
   - Alternatively: go to Supabase → **Authentication → Users** to find your UUID
4. Click your row to edit it
5. Change the **role** column from `viewer` to `admin`
6. Click **Save**
7. Reload the app — you now have Admin access and will see all menu items

**Alternative method using SQL Editor:**
```sql
-- First find your user ID
select id from auth.users where email = 'your-email@company.com';

-- Then set admin role (replace the UUID)
update public.users
set role = 'admin'
where id = 'paste-your-uuid-here';
```

---

## PART 7 — Inviting Your Team

### Step 22: Invite Team Members

Now that you're an Admin:

1. Go to **Administration → User Management** in the sidebar
2. Click **Invite User**
3. Enter their email address and select their role:
   - **Marketing**: Can upload and edit content
   - **Sales**: Can browse and download published content
   - **Distributor**: Can see distributor-tagged content (for Phase 2)
   - **Viewer**: Public content only (for Phase 2 embeds)
4. Click **Send Invitation**
5. They'll receive a magic link email and can sign in immediately

---

## PART 8 — Setting Up Tags

Before your team starts uploading, set up your product and topic tags.

### Step 23: Create Your First Tags

1. Go to **Administration → Tag Management**
2. Click **New Tag**
3. Add your product names (e.g. "Variable Speed Drives", "Servo Motors")
   - Type: **Product**
   - Colour: Choose a colour that matches the product
4. Add topic tags (e.g. "Installation Guide", "Product Brochure", "Case Study")
   - Type: **Topic**
5. Repeat for all your products and topic categories

---

## PART 9 — Uploading Your First Piece of Content

### Step 24: Your First Upload

1. Click **Upload Content** in the sidebar
2. Select a content type (e.g. PDF)
3. Drag a file into the upload area
4. Fill in the title and description
5. Select the relevant product and topic tags
6. Choose audience: **Internal** (for team only) or **Sales** (for sales team visibility)
7. Click **Publish** to make it visible, or **Save as Draft** to review first

---

## Troubleshooting

### "Missing credentials" error on upload
Check that `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, and `R2_PUBLIC_URL` are all set in Vercel → Settings → Environment Variables. After adding/changing variables, you must redeploy.

### Magic link emails not arriving
1. Check spam folder
2. Go to Supabase → Authentication → Settings
3. Make sure **Email** is enabled as a provider
4. For production use, set up a custom SMTP server: Supabase → Settings → Auth → SMTP Settings

### Backup always showing "Failed"
Check B2 credentials. Common issues:
- `B2_ENDPOINT` must include the region (check your Backblaze bucket page for the exact endpoint)
- The application key must have Read & Write access to the correct bucket

### "profile_missing" error at login
This happens if the auto-create trigger didn't fire. Fix it by running in Supabase SQL Editor:
```sql
insert into public.users (id, role)
select id, 'viewer'
from auth.users
where id not in (select id from public.users);
```

### App shows old version after deploy
The service worker handles this automatically. If it's not working, try:
1. Open your browser's DevTools (F12)
2. Go to Application → Service Workers
3. Click "Unregister" then refresh the page

---

## Custom Domain (Optional)

To use your own domain (e.g. `content.axiscontrols.com`):

1. Go to Vercel → your project → **Settings → Domains**
2. Click **Add Domain**
3. Enter your domain name
4. Follow Vercel's instructions to add a DNS record at your domain registrar
5. Update `NEXT_PUBLIC_APP_URL` in Vercel environment variables to your custom domain

---

## Summary of All Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Cloudflare R2
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=axis-content-primary
R2_PUBLIC_URL=https://pub-xxxx.r2.dev

# Backblaze B2
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_ACCESS_KEY_ID=your-b2-key-id
B2_SECRET_ACCESS_KEY=your-b2-application-key
B2_BUCKET_NAME=axis-content-backup

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## Phase 2 Addendum — Analytics Setup

### Phase 2 new environment variables

Add these to your Vercel project environment variables (Settings → Environment Variables):

```
# Google (used for GA4, Search Console, YouTube Analytics)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# GA4 Property IDs (the number after "properties/" in your GA4 URL)
GA4_PROPERTY_ID_MAIN=123456789
GA4_PROPERTY_ID_ES=987654321

# Search Console site URLs (must match exactly as verified in GSC)
GSC_SITE_URL_MAIN=https://your-main-site.com/
GSC_SITE_URL_ES=https://your-main-site.com/es/

# YouTube
YOUTUBE_API_KEY=AIza...
YOUTUBE_CHANNEL_ID=UC...

# Brevo
BREVO_API_KEY=xkeysib-...

# Anthropic (for AI Highlights)
ANTHROPIC_API_KEY=sk-ant-...

# Cron security (generate any random string, e.g. openssl rand -hex 32)
CRON_SECRET=your-random-secret-here
```

---

### Step A — Create a Google Service Account

A Service Account is like a robot user that can read your analytics data without needing a human to log in.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable these three APIs for your project:
   - **Google Analytics Data API** (for GA4)
   - **Google Search Console API**
   - **YouTube Analytics API**

   To enable each: search for the API name in the search bar → click it → click **Enable**

4. In the left menu go to **IAM & Admin → Service Accounts**
5. Click **Create Service Account**
6. Name it `axis-content-hub` and click **Create and Continue**
7. Skip the optional role step — click **Done**
8. Click on the service account you just created
9. Go to the **Keys** tab → **Add Key → Create new key → JSON** → **Create**
10. A JSON file downloads. Open it and copy:
    - `client_email` → this is your `GOOGLE_SERVICE_ACCOUNT_EMAIL`
    - `private_key` → this is your `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (include the full string with `\n` newlines)

> **Important for Vercel**: When pasting the private key into Vercel's environment variables, paste it exactly as it appears in the JSON file — including the literal `\n` characters. Do NOT replace them with real newlines in the Vercel UI.

---

### Step B — Grant the Service Account access to GA4

1. Go to [analytics.google.com](https://analytics.google.com)
2. Click the gear icon (⚙) at the bottom left → **Account Access Management**
3. Click the **+** button to add a user
4. Enter the service account email (e.g. `axis-content-hub@your-project.iam.gserviceaccount.com`)
5. Set role to **Viewer** → **Add**
6. Repeat for each GA4 property you want to track

**Finding your GA4 Property ID:**
1. In GA4, go to Admin (gear icon) → Property Settings
2. Your Property ID is shown at the top (e.g. `123456789`)
3. Copy this number into `GA4_PROPERTY_ID_MAIN` (and `GA4_PROPERTY_ID_ES` for the Spanish site)

---

### Step C — Grant the Service Account access to Search Console

1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Select your property (website)
3. In the left menu click **Settings → Users and permissions**
4. Click **Add User**
5. Enter the service account email
6. Set permission to **Full** → **Add**

**Finding your GSC site URL:**
- The exact URL is shown in the top-left property dropdown in Search Console
- Common formats: `https://yourdomain.com/` (with trailing slash) or `sc-domain:yourdomain.com`
- Copy it exactly — even a missing trailing slash will cause errors
- Set this as `GSC_SITE_URL_MAIN`

---

### Step D — Set up YouTube Analytics API

The YouTube Analytics API uses the same Google Service Account you already created, but it needs to be linked to your YouTube channel.

**Getting your YouTube Channel ID:**
1. Go to [youtube.com](https://youtube.com) and sign in as your channel
2. Click your profile → **YouTube Studio**
3. In the left menu click **Settings → Channel → Advanced settings**
4. Your **Channel ID** starts with `UC...` — copy it into `YOUTUBE_CHANNEL_ID`

**YouTube API Key:**
1. Go back to [console.cloud.google.com](https://console.cloud.google.com)
2. Go to **APIs & Services → Credentials**
3. Click **Create Credentials → API Key**
4. Copy the key into `YOUTUBE_API_KEY`
5. (Optional but recommended) Click **Edit** on the key → restrict it to the YouTube Data API v3

**Note:** YouTube Analytics API requires the service account to be linked as a channel manager. Go to [studio.youtube.com](https://studio.youtube.com) → **Settings → Permissions → Invite** and add the service account email as a Manager.

---

### Step E — Get your Brevo API Key

1. Log in to [app.brevo.com](https://app.brevo.com)
2. Click your name in the top right → **SMTP & API**
3. Go to the **API Keys** tab
4. Click **Create a new API key** → name it `Axis Content Hub`
5. Copy the key that appears (it starts with `xkeysib-`) into `BREVO_API_KEY`

---

### Step F — Set up Vercel Cron Jobs

The `vercel.json` file in the project root already configures the cron schedules. When you deploy to Vercel, these run automatically:

| Cron | Schedule | What it does |
|------|----------|-------------|
| Weekly | Every Monday 6:00 AM IST | Pulls last week's data |
| Monthly | 1st of month 6:00 AM IST | Pulls last month's data |
| Quarterly | 1st of Jan/Apr/Jul/Oct 6:00 AM IST | Pulls last quarter's data |
| Annual | 1st of January 6:00 AM IST | Pulls last year's data |

> Note: Vercel Cron Jobs require a Pro plan ($20/month) or higher. On the free Hobby plan, crons are not available — you can use the **Pull data now** button in the dashboard instead.

**Setting the CRON_SECRET:**
1. Generate a random string: run `openssl rand -hex 32` in your terminal (or use any password generator)
2. Add it as `CRON_SECRET` in Vercel environment variables
3. Vercel automatically sends this as an `Authorization: Bearer {secret}` header with cron requests

---

### Step G — Run the database migration

After deploying the new code, run migration `006_analytics.sql` in your Supabase SQL editor:

1. Open [supabase.com](https://supabase.com) → your project → **SQL Editor**
2. Click **New query**
3. Copy the contents of `supabase/migrations/006_analytics.sql` and paste them
4. Click **Run**

This creates the new tables: `mis_snapshots`, `mis_pull_logs`, `mis_highlights`, `content_targets`, and `dashboard_configs`.

---

### Step H — Verify everything works

1. Deploy your updated code to Vercel
2. Log in as an admin user
3. Navigate to **Analytics → MIS Dashboard**
4. Click **Pull data now** to run a manual pull
5. Watch the toast notification — it should say "Data pull complete — X sources updated"
6. Refresh the page to see your data

If the pull fails:
- Check Vercel function logs (Vercel dashboard → Deployments → Functions tab)
- Verify all environment variables are set correctly
- Make sure the service account has been granted access to each property

---

*Document version: v0.2.0 | Last updated: 2026-03-20*
