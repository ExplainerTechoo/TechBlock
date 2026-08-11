# 🛡️ TechBlock — New UI Prompt for Google Stitch

Copy EVERYTHING below this line and paste it into Google Stitch (https://stitch.withgoogle.com) to generate the new UI.

---

## APP OVERVIEW

Design a complete new UI for **TechBlock**, a Windows desktop productivity & focus app (built with Electron). TechBlock helps people stop wasting time by blocking distracting websites and apps for a chosen time period, and rewards focus with a task/points system.

**Developer branding:** "TechBlock · by Kartik Chobdar / Explainer Techoo"

**Target:** Desktop app, window ~1280×800 (min 1000×650). Modern, premium, dark-themed dashboard. NOT a mobile app — design for desktop with a left sidebar.

## APP PAGES (sidebar navigation) — each page must be designed:

### 1. HOME (Dashboard)
- 4 stat cards in a row: **Websites Blocked**, **Apps Blocked**, **Tasks Completed**, **Total Points**
- "Quick Block a Website" panel: text input (paste any URL e.g. instagram.com) + dropdown timer (30 min / 1 hour / 2 hours / 6 hours / 24 hours) + "Block Now" button
- "Active Blocks" panel: list showing currently blocked sites/apps with remaining countdown timers
- Hint note: "Run as Administrator for full blocking power"

### 2. WEBSITE BLOCKER
- "Block a Website" panel: URL input + minutes input + "Block 🔒" button
- "Currently Blocked Sites" list: each item shows site name + unlock time + countdown + status
- Existing blocked presets to show: Instagram, Facebook, X/Twitter, YouTube Music, Spotify, Netflix, WhatsApp Web, TikTok, Telegram, Snapchat, Reddit, Discord, Pinterest, LinkedIn

### 3. APP BLOCKER
- "Installed Apps on this PC" panel with a **search bar** and **Refresh** button
- Grid of app cards — each card: app icon/emoji, app name, minutes input, toggle switch to block
- "Currently Blocked Apps" list with countdown timers

### 4. NOTES & TASKS
- Two streak/points cards at top: **🔥 Day Streak** and **⭐ Total Points**
- "Add a Task" form: task text input + time-in-minutes input + Add Task button
- Task list — each task card:
  - Circular checkbox to mark complete
  - Task text
  - Meta: date started, time set
  - Live countdown timer showing time remaining
  - Color-coded by status: GREEN (finished early +11 pts), YELLOW (on time +10 pts), RED (late, less points, down to 0)
  - Delete button
- Point system explanation hint: "finish before half the time → 11 pts (green) · on time → 10 pts (yellow) · every 10 min late −1 pt · more than 30 min late → 0 pts (red)"

### 5. TECHBLOCK AI
- Chat-style panel: AI assistant powered by opencode CLI
- Status indicator dot (online/offline) + "opencode connected · vX.X.X" text
- Chat message bubbles (user messages + AI messages + error messages)
- Text input + Send button, placeholder: "Ask me anything... e.g. Block youtube.com for 1 hour"

### 6. HISTORY
- "Everything saved locally on this device" panel with a **Clear** button
- History feed — each row: emoji icon + text + timestamp (e.g. "🌟 Blocked Instagram · for 60 min · unlocks 14:30")

### 7. GET TECHBLOCK
- QR code panel (scan to download the app) + download link button
- Brief install instructions

### 8. ABOUT
- Founder profile card: avatar (KC), name "Kartik Chobdar", role "Founder · Explainer Techoo", email explainertechoo77@gmail.com
- Social links: Instagram @_explainertechoo, YouTube @ExplainerTechoo, X @ExplainerTechoo
- Copyright: "All copyright reserved to Kartik Chobdar / Explainer Techoo"

## SIDEBAR REQUIREMENTS
- Brand area at top: 🛡️ logo + "TechBlock" + tagline "by Explainer Techoo"
- Navigation items: Home 🏠, Website Blocker 🌐, App Blocker 📱, Notes & Tasks 📝, TechBlock AI 🤖, History 🕘, Get TechBlock 📲, About ℹ️
- Bottom of sidebar: two small cards — **🔥 Day Streak** (number + "Day Streak") and **⭐ Total Points** (number + "Total Points") — these stats are always visible on every page

## DESIGN STYLE / LOOK & FEEL
- **Theme:** Dark, sleek, modern productivity app. Premium glassmorphism or subtle dark gradients. NOT flat/boring — give it character.
- **Color palette:** Deep navy/indigo background (#0f1424 range), panels slightly lighter (#1b2340 range), electric indigo→violet gradient accent (approx #4f6bff → #7d5fff), soft purple-grey text (#8b96b8 muted), white text (#e7ecff).
- **Accent semantics:** green #22c55e (success/early), yellow #eab308 (on-time/warning), red #ef4444 (blocked/late/alerts).
- **Typography:** Clean modern sans-serif (system-ui / Segoe UI / Inter vibes). Large bold numbers for stats and streak/points.
- **Controls:** Rounded buttons, pill-shaped countdown badges, iOS-style toggle switches, smooth micro-animations & hover transitions, soft shadows.
- **Icons:** Clear emoji icons (already used in the app — keep those).
- **Feel:** Calm, focused, trustworthy. A tool that feels like it's genuinely helping the user focus — satisfying to use, not intimidating.

## LAYOUT RULES
- Fixed left sidebar (approx 240-260px wide) + scrollable main content area on the right
- Each page: a big clear page title at top (e.g. "🌐 Website Blocker"), then content cards/panels
- Generous spacing, cards with rounded corners (~14px radius) and 1px subtle borders
- Overlays/modals: centered dialog with backdrop blur (e.g. "Allow Local Storage?" permission dialog with Allow / Not Now buttons)
- Countdown timers shown as pill badges on blocked items

## OUTPUT REQUEST
Generate the full UI as a single cohesive dark-theme desktop app design — all 8 pages + sidebar. Keep every existing element/feature (same IDs and interactions as a typical Electron app), just make it look dramatically better and more modern. The result will be converted to HTML/CSS/JS and wired to an Electron backend, so keep it as a real, functional layout (not just a mockup).