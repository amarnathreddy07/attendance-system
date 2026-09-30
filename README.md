# AttendIt — Teacher Attendance System

A local-first, offline-friendly attendance management application for teachers. All data is stored privately on your device using the browser's IndexedDB database. No account required, no cloud backend, no server.

**Deployed on GitHub Pages:** [https://amarnath1564.github.io/attendance-system/](https://amarnath1564.github.io/attendance-system/)

---

## ✨ Features

### Core Functionality
- **Teacher Profile** — Create a simple profile on first launch (name and optional email).
- **Class Management** — Create, edit, and manage multiple classes.
- **Student Management** — Add students manually or import a CSV roster.
- **Attendance Sessions** — Fast, keyboard-friendly attendance marking.
- **Attendance History** — View attendance records per class and per student.
- **Session Details** — Review, edit, and resubmit attendance sessions.

### Advanced Features
- **Presentation Mode** — Full-screen display for classroom projectors with touch/keyboard controls.
- **Keyboard Shortcuts** — Fast attendance marking with keyboard:
  - `→` or `Enter` = Mark Present
  - `←` or `Space` = Mark Absent
  - `Backspace` = Undo last mark
  - `↑` = Go to previous student
  - `Esc` = Exit Presentation Mode
- **Absent-Only Review** — Quick review of only absent students before submission.
- **Attendance Risk Indicators** — Three-tier risk classification (Safe / At Risk / Critical).
- **Class Snapshots** — Quick overview of class attendance metrics and risk summary.
- **Calendar History** — Monthly calendar view of attendance sessions.
- **Attendance Threshold** — Configurable per-class attendance threshold (default 75%).
- **Smart CSV Import** — Intelligent header detection and flexible column matching.
- **CSV Export** — Export student roster and attendance records.
- **Local Backup & Restore** — Export/import complete data as JSON files.
- **Confirmation Codes** — 4-digit randomized code required before clearing local data.
- **Auto-Backup on Deletion** — Automatic backup download before data deletion.
- **Offline Support** — PWA with service worker caching; works offline after initial load.
- **Installable** — Install as an app on desktop/mobile.

---

## 🏗️ Tech Stack

- **Frontend Framework:** React 18 with Vite 5
- **Routing:** React Router 6 (HashRouter for GitHub Pages compatibility)
- **Local Database:** Dexie (IndexedDB wrapper) with dexie-react-hooks for reactive queries
- **Styling:** Tailwind CSS 3
- **PWA:** vite-plugin-pwa with Workbox service worker
- **Build Tool:** Vite 5
- **Package Manager:** npm

---

## 💾 Data & Privacy

### How It Works
All attendance data (teacher profile, classes, students, sessions, records) is stored **locally in your browser** using IndexedDB. 

- **No cloud storage.** Data never leaves your device.
- **No analytics.** Your attendance data is not tracked or analyzed.
- **No authentication.** No account login required.
- **No backend.** The deployed application is purely a frontend SPA.

### Clearing Browser Data
If you clear browser data, local application data will be permanently deleted. **Always export and keep a backup** of your attendance records.

Use the **Local Data** section in Settings to:
- Export a backup (downloads to your computer)
- Import a previously exported backup
- Clear all local data (with automatic backup)

### Security & Backups
- Backups are JSON files downloaded to your computer.
- Backups are never uploaded anywhere.
- You have full control over backup files.
- Export backups regularly to avoid data loss.

---

## 🚀 Getting Started

### Online (Production)

Open the deployed application:

```
https://amarnath1564.github.io/attendance-system/
```

No installation required. Works in any modern browser.

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/amarnath1564/attendance-system.git
   cd attendance-system
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in your browser:**
   - Vite will print the URL (usually `http://localhost:5173`)
   - The application loads with hash-based routing

### Production Build

Build the application for production:

```bash
npm run build        # Creates optimized build in dist/
npm run preview      # Serves the production build locally
```

---

## 📖 Using the App

### 1. Onboarding
On first launch, enter your teacher name and optional email. This creates your local profile.

### 2. Create a Class
From the Dashboard, click **Add Class**:
- Enter class name
- Optionally add section/group
- Set attendance threshold (default 75%)
- Import students or create the class first

### 3. Import Students
Upload a CSV file or use the sample generator:

**CSV format (any column order):**
```
Application Number, Roll Number, Student Name, Email, Status
001, 1, Alice Johnson, alice@example.com, active
002, 2, Bob Smith, bob@example.com, active
```

Supported headers (case-insensitive):
- Application Number / App Number / ID
- Roll Number / Roll / Roll No
- Student Name / Name / First Name
- Email / Student Email
- Status (optional; defaults to active)

### 4. Take Attendance
From a class, click **Take Attendance**:
- Mark each student Present (✓) or Absent (✗)
- Use keyboard shortcuts for fast marking
- See progress bar and real-time counts
- Review attendance before submission
- Submit to save locally

### 5. Presentation Mode
During attendance, click **Presentation Mode**:
- Full-screen dark display
- Large student name and roll number
- Progress tracking
- Touch or keyboard controls
- Exit with Escape key

### 6. Review Attendance
After marking all students, review the list:
- Toggle Present/Absent for any student
- Quick "Review Absent Students" filter
- Submit to save

### 7. Attendance History
From a class, view **Attendance History**:
- Monthly calendar of attendance sessions
- Click a date to view that session
- Per-student attendance history

### 8. Export & Backup
In **Settings → Local Data**:
- **Export Local Data** — Download a JSON backup of everything
- **Import Local Data** — Restore from a previous backup
- **Clear All Local Data** — Delete everything (requires 4-digit code; auto-backs up first)

---

## 🌐 GitHub Pages Deployment

### Automatic Deployment (GitHub Actions)

Pushing to the `master` branch automatically:
1. Installs dependencies
2. Builds the production application
3. Deploys to GitHub Pages
4. Application is live at `https://amarnath1564.github.io/attendance-system/`

**GitHub Actions Workflow:**
- Located in `.github/workflows/deploy.yml`
- Runs on every push to `master` branch
- Uses Node.js 20, npm, and official GitHub Pages actions

### Enabling GitHub Pages in Your Repository

If not already enabled:

1. Go to **Settings → Pages**
2. Under "Build and deployment":
   - Source: `GitHub Actions`
3. Save
4. GitHub Actions will automatically deploy the next push to `master`

### Configuration Details

**Vite Base Path:**
- Configured in `vite.config.js`: `base: '/attendance-system/'`
- Ensures all assets load correctly from the GitHub Pages subpath

**Routing:**
- Uses HashRouter for compatibility with GitHub Pages
- All routes are prefixed with `#/` (e.g., `/#/classes/1`)
- No server-side configuration needed

**Asset Paths:**
- All relative paths in index.html and vite.config.js
- PWA manifest uses relative icon paths
- Service worker navigateFallback configured for the correct base path

---

## 📱 Installing as an App

The application is a Progressive Web App (PWA):

### On Desktop (Chrome/Edge/Opera)
1. Click the install icon (address bar or menu)
2. Click "Install"
3. App opens in a window without browser UI

### On Mobile (Android)
1. Open in Chrome
2. Tap the menu (three dots)
3. Tap "Install app" or "Add to home screen"
4. Tap "Install"
5. App is added to home screen

### On iOS/Safari
1. Open in Safari
2. Tap Share
3. Tap "Add to Home Screen"
4. Tap "Add"
5. App is added to home screen

All data remains in IndexedDB and is accessible from the installed app.

---

## 🔧 Troubleshooting

### Application won't load
- Check browser compatibility (Chrome, Edge, Firefox, Safari all supported)
- Clear browser cache and reload
- Ensure you're on the correct URL: `https://amarnath1564.github.io/attendance-system/`

### Data disappeared
- Check that you're using the same device/browser where you created your profile
- Clearing browser data deletes IndexedDB
- Use a backup to restore: Settings → Local Data → Import

### Keyboard shortcuts not working
- Make sure no input fields are focused
- Shortcuts are disabled when typing in forms
- Try clicking the main attendance card first

### CSV import failed
- Ensure column headers match expected names (case-insensitive)
- Check for duplicate student IDs (skipped automatically)
- Email field is optional; Name, Roll Number, App Number are required

### Offline mode not working
- Open the app online at least once to cache service worker
- Check browser settings for service worker support
- Some browsers limit PWA functionality in private/incognito mode

---

## 🛠️ Development

### Project Structure

```
attendance-system/
├── src/
│   ├── pages/              # Page components (Dashboard, ClassDetail, etc.)
│   ├── components/         # Reusable components (Modal, Dropdown, etc.)
│   ├── db/                 # IndexedDB setup (Dexie)
│   ├── lib/                # Utilities (CSV, backup, risk calculations)
│   ├── state/              # React Context (AppContext)
│   ├── App.jsx             # Root component with routing
│   ├── main.jsx            # Entry point
│   └── index.css           # Tailwind imports
├── public/                 # Static assets (icons, manifest)
├── index.html              # HTML template
├── vite.config.js          # Vite configuration (base path, PWA)
├── package.json            # Dependencies and scripts
├── tailwind.config.js      # Tailwind configuration
├── postcss.config.js       # PostCSS configuration
├── dist/                   # Production build (generated)
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions deployment workflow
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server on localhost:5173

# Production
npm run build            # Build production bundle
npm run preview          # Preview production build locally
```

### Database Schema

Dexie with IndexedDB (v4 schema):

```
- teachers:              Teacher profile (id, name, email)
- classes:              Classes (id, class_name, section, attendance_threshold, created_at)
- students:             Students (id, class_id, name, roll_number, application_number, email, status)
- attendance_sessions:  Sessions (id, class_id, date, status, submitted_at)
- attendance_records:   Individual marks (id, attendance_session_id, student_id, status)
- settings:             App settings (key-value store)
```

### Key Dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| react | ^18.3.1 | UI library |
| react-dom | ^18.3.1 | DOM rendering |
| react-router-dom | ^6.26.2 | Routing |
| dexie | ^4.0.8 | IndexedDB wrapper |
| dexie-react-hooks | ^1.1.7 | Reactive hooks for Dexie |
| tailwindcss | ^3.4.10 | Styling |
| vite | ^5.4.3 | Build tool |
| @vitejs/plugin-react | ^4.3.1 | React plugin for Vite |
| vite-plugin-pwa | ^1.3.0 | PWA generation |

---

## 🐛 Reporting Issues

If you encounter bugs:

1. Reproduce the issue
2. Note:
   - Browser and version
   - Steps to reproduce
   - Expected vs actual behavior
3. Open an issue on GitHub: [amarnath1564/attendance-system/issues](https://github.com/amarnath1564/attendance-system/issues)

---

## 📄 License

[Your chosen license, if any]

---

## 🙏 Contributing

Contributions are welcome! 

- Fork the repository
- Create a feature branch
- Make your changes
- Submit a pull request

Please keep the application local-first and avoid introducing cloud dependencies.

---

## 📞 Support

For questions or support:
- Check this README
- Review the Troubleshooting section
- Open an issue on GitHub

---

**Last Updated:** August 14, 2026  
**Version:** 1.2.0  
**Status:** Production Ready

