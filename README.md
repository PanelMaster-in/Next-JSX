# Next.js Project

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

### Standard Development Server

Run the development server directly:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

### Using Build Script (Recommended)

This project includes a custom `build.js` script that provides an enhanced development workflow with automated building, deployment, and backup capabilities.

#### Running the Build Script

```bash
npm run out
```

This will:
- Automatically install dependencies if `node_modules` doesn't exist
- Start the Next.js development server
- Provide an interactive CLI for building and deploying

## Build Script Configuration

Before using the build script, you need to configure two important settings in `build.js`:

### 1. Git Repository URL

Edit `build.js` and update the `REPO_URL` constant (around line 8):

```javascript
const REPO_URL = "https://your-username@your-server.com/path/to/repo.git";
```

**Example:**
```javascript
const REPO_URL = "https://user@example.com/git/myproject.git";
```

This URL is used when deploying the built `out` folder to your remote repository.

### 2. Backup Directory Path

Edit `build.js` and update the `backupRoot` constant (around line 7):

```javascript
const backupRoot = '/path/to/your/backup/directory/';
```

**Example:**
```javascript
const backupRoot = '/Users/username/Documents/Backups/';
```

The script will create timestamped ZIP backups of your project and the `out` folder in this directory. If the backup location is unavailable, backups will be saved locally in a `backups` folder within your project directory.

**Note:** The script automatically keeps only the 10 most recent backups (configurable via `MAX_BACKUP_COPIES`).

## Build Script Commands

Once the build script is running, you can use these interactive commands:

### **G** → Build + Deploy + Restart Dev Server
- Stops the dev server
- Cleans `.next` and `out` directories
- Installs dependencies (if needed)
- Builds the Next.js project
- Deploys the `out` folder to git (force push)
- Creates backups (project + out folder)
- Restarts the dev server

**Usage:** Type `G` and press Enter

### **B** → Build Only (No Git Push) + Restart Dev Server
- Stops the dev server
- Cleans `.next` and `out` directories
- Installs dependencies (if needed)
- Builds the Next.js project
- Creates backups (project + out folder)
- Restarts the dev server

**Usage:** Type `B` and press Enter

### **C** → Clear Terminal
- Clears the terminal screen
- Keeps the script running

**Usage:** Type `C` and press Enter

### **Ctrl+C** → Exit
- Stops the dev server
- Exits the build script

**Usage:** Press `Ctrl+C`

## Build Script Features

- **Automatic Dependency Management**: Installs npm packages if `node_modules` is missing
- **Smart Cleanup**: Removes old build artifacts before building
- **Automated Backups**: Creates timestamped ZIP files of your project and build output
- **Git Integration**: Automatically initializes git in the `out` folder and pushes to your configured repository
- **Error Handling**: Gracefully handles errors and restarts the dev server even if build/deploy fails
- **Visual Feedback**: Uses colored output and spinners to show progress

## Requirements

- Node.js and npm installed
- Git configured (for deployment feature)
- `zip` command available (for backup feature - usually pre-installed on macOS/Linux)
- Next.js configured with `output: "export"` in `next.config.js` or `next.config.mjs` for static export

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
