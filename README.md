# TechBlock - Focus & Productivity

A Windows desktop application for website/app blocking, task management, and productivity tracking.

## Features

- 🔒 **Website Blocker** - Block distracting websites via HOSTS file & firewall
- 📱 **App Blocker** - Block desktop applications by executable
- ✅ **Task Manager** - Time-based tasks with streaks & points
- 📝 **Notes** - Quick notes with completion rewards
- 📊 **Stats & Streaks** - Track productivity over time
- 💬 **Community** - Comments and feedback
- 👑 **Admin Dashboard** - User analytics (for authorized admins)
- 🔐 **Supabase Auth** - Secure email/password authentication
- 🔄 **Auto-Updater** - Automatic updates from GitHub Releases

## Tech Stack

- **Electron** - Desktop framework
- **Supabase** - Authentication & database
- **Node.js** - Backend logic
- **Vanilla JS/HTML/CSS** - Frontend

## Installation

### For Users
1. Download latest `TechBlock Setup X.X.X.exe` from [Releases](https://github.com/ExplainerTechoo/TechBlock/releases)
2. Run installer (requires Administrator for full features)
3. Launch TechBlock

### For Developers
```bash
# Clone repo
git clone https://github.com/ExplainerTechoo/TechBlock.git
cd TechBlock

# Install dependencies
npm install

# Create .env from template
copy .env.example .env
# Edit .env with your Supabase credentials

# Run in dev mode
npm start

# Build installer
npm run dist
```

## Configuration

Create a `.env` file (see `.env.example`):

```env
# Supabase (required for auth)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Admin access (optional)
ADMIN_EMAILS=admin@example.com
ADMIN_MASTER_PASSWORD=your-password

# Skip admin elevation for testing
TECHBLOCK_NO_ELEVATE=1
```

## Admin Access

Configure in `.env`:
- `ADMIN_EMAILS` - Comma-separated list of authorized admin emails
- `ADMIN_MASTER_PASSWORD` - Password for admin dashboard

## Build & Release

```bash
npm run dist
# Creates dist/TechBlock Setup X.X.X.exe
# Upload to GitHub Releases for auto-updater
```

## Project Structure

```
src/
├── main.js          # Main process (blocking, IPC, auto-updater)
├── renderer.js      # UI logic, state management
├── preload.js       # Secure IPC bridge
├── index.html       # App UI
├── style.css        # iOS light theme
└── supabaseClient.js # Supabase authentication
```

## License

Copyright © Kartik Chobdar / Explainer Techoo. All rights reserved.