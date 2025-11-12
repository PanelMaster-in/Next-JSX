const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { spawn, execSync, exec } = require("child_process");
const outDir = path.join(process.cwd(), "out");
const deployBranch = "main";
const backupRoot = '/path/to/your/backup/directory/';
const REPO_URL = "https://your-username@your-server.com/path/to/repo.git";
const MAX_BACKUP_COPIES = 10;

let devServer = null;
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

function createSpinner(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frameIndex = 0;
  let interval = null;
  let isRunning = false;
  const spinner = {
    start: function () {
      isRunning = true;
      process.stdout.write(`\r${frames[frameIndex]} ${text}`);
      interval = setInterval(() => {
        frameIndex = (frameIndex + 1) % frames.length;
        if (isRunning) {
          process.stdout.write(`\r${frames[frameIndex]} ${text}`);
        }
      }, 80);
      return spinner;
    },
    succeed: function (message) {
      isRunning = false;
      if (interval) clearInterval(interval);
      process.stdout.write(`\r${colorize('✓', 'green')} ${message || text}\n`);
    },
    fail: function (message) {
      isRunning = false;
      if (interval) clearInterval(interval);
      process.stdout.write(`\r${colorize('✗', 'red')} ${message || text}\n`);
    }
  };

  return spinner;
}

async function runCommand(command, options = {}) {
  const { cwd } = options;
  return new Promise((resolve, reject) => {
    exec(command, {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout || '';
        error.stderr = stderr || '';
        reject(error);
      } else {
        resolve({ stdout: stdout || '', stderr: stderr || '' });
      }
    });
  });
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function removeDir(dirPath, maxRetries = 3) {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  let retries = 0;
  while (retries < maxRetries) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3 });
      await new Promise(resolve => setTimeout(resolve, 50));
      if (fs.existsSync(dirPath)) {
        throw new Error('Directory still exists');
      }
      return;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        try {
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              await removeDir(filePath, 1);
            } else {
              fs.unlinkSync(filePath);
            }
          }
          fs.rmdirSync(dirPath);
        } catch (finalError) {
          console.error(colorize(`⚠️  Warning: Could not fully delete ${dirPath}, continuing anyway...`, "yellow"));
        }
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

function startDevServer() {
  console.log(colorize("▶ Starting dev server...", "blue"));
  devServer = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
  });
}

function stopDevServer() {
  if (devServer) {
    console.log(colorize("▶ Stopping dev server...", "yellow"));
    devServer.kill();
    devServer = null;
  }
}

async function createProjectZip(outputPath, projectDir) {
  return new Promise((resolve, reject) => {
    const command = `find . -type f ! -path "*/node_modules/*" ! -path "*/.next/*" ! -path "*/out/*" ! -path "*/.git/*" ! -path "*/.vscode/*" | zip -q -@ "${outputPath}"`;
    exec(command, { cwd: projectDir }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function createOutZip(outputPath, outDir) {
  return new Promise((resolve, reject) => {
    exec(`cd "${outDir}" && zip -q -r "${outputPath}" .`, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function createBackup() {
  try {
    const projectDir = process.cwd();
    const folderName = path.basename(projectDir);
    const projectBackupDir = path.join(backupRoot, folderName);
    ensureDir(projectBackupDir);
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .split("Z")[0];
    const zipFileName = `${folderName}_${timestamp}.zip`;
    const zipFilePath = path.join(projectDir, zipFileName);
    await createProjectZip(zipFilePath, projectDir);
    try {
      const destPath = path.join(projectBackupDir, zipFileName);
      fs.renameSync(zipFilePath, destPath);
    } catch (backupError) {
      const localBackupDir = path.join(projectDir, "backups");
      ensureDir(localBackupDir);
      const localDestPath = path.join(localBackupDir, zipFileName);
      fs.renameSync(zipFilePath, localDestPath);
    }
    if (fs.existsSync(outDir)) {
      const outZipFileName = `${folderName}_out_${timestamp}.zip`;
      const outZipFilePath = path.join(projectDir, outZipFileName);
      await createOutZip(outZipFilePath, outDir);
      try {
        const outDestPath = path.join(projectBackupDir, outZipFileName);
        fs.renameSync(outZipFilePath, outDestPath);
      } catch (err) {
        const localBackupDir = path.join(projectDir, "backups");
        ensureDir(localBackupDir);
        const localOutDestPath = path.join(localBackupDir, outZipFileName);
        fs.renameSync(outZipFilePath, localOutDestPath);
      }
    }

    const cleanupDirs = [projectBackupDir, path.join(projectDir, "backups")];
    for (const cleanupDir of cleanupDirs) {
      if (fs.existsSync(cleanupDir)) {
        try {
          const fullBackupPattern = new RegExp(`^${folderName}_\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}-\\d{3}\\.zip$`);
          const fullBackups = fs
            .readdirSync(cleanupDir)
            .filter((file) => fullBackupPattern.test(file))
            .map((file) => ({
              name: file,
              time: fs.statSync(path.join(cleanupDir, file)).mtime.getTime(),
            }))
            .sort((a, b) => b.time - a.time);
          const oldFullBackups = fullBackups.slice(MAX_BACKUP_COPIES);
          for (const f of oldFullBackups) {
            fs.unlinkSync(path.join(cleanupDir, f.name));
          }
          const outBackupPattern = new RegExp(`^${folderName}_out_\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}-\\d{3}\\.zip$`);
          const outBackups = fs
            .readdirSync(cleanupDir)
            .filter((file) => outBackupPattern.test(file))
            .map((file) => ({
              name: file,
              time: fs.statSync(path.join(cleanupDir, file)).mtime.getTime(),
            }))
            .sort((a, b) => b.time - a.time);
          const oldOutBackups = outBackups.slice(MAX_BACKUP_COPIES);
          for (const f of oldOutBackups) {
            fs.unlinkSync(path.join(cleanupDir, f.name));
          }
        } catch (err) {
        }
      }
    }
  } catch (err) {
    console.error(colorize(`❌ Backup failed: ${err.message}`, "red"));
  }
}

async function deployOutFolder() {
  if (!fs.existsSync(outDir)) {
    console.error(colorize("❌ 'out' folder not found!", "red"));
    return false;
  }
  try {
    if (!fs.existsSync(path.join(outDir, ".git"))) {
      await runCommand("git init", { cwd: outDir });
    }
    try {
      await runCommand(`git branch -M ${deployBranch}`, { cwd: outDir });
    } catch {
    }
    await runCommand("git add .", { cwd: outDir });
    try {
      await runCommand('git commit -m "Deploy: updated build"', { cwd: outDir });
    } catch {
    }
    try {
      const { stdout } = await runCommand("git remote get-url origin", { cwd: outDir });
      const remote = stdout.trim();
      if (remote !== REPO_URL) {
        await runCommand("git remote remove origin", { cwd: outDir });
        await runCommand(`git remote add origin ${REPO_URL}`, { cwd: outDir });
      }
    } catch {
      await runCommand(`git remote add origin ${REPO_URL}`, { cwd: outDir });
    }
    const pushSpinner = createSpinner("Pushing to server");
    pushSpinner.start();
    try {
      await runCommand(`git push --force --set-upstream origin ${deployBranch}`, {
        cwd: outDir
      });
      pushSpinner.succeed("Pushing to server");
    } catch (error) {
      if (pushSpinner && typeof pushSpinner.fail === 'function') {
        pushSpinner.fail("Pushing to server");
      }
      console.error(colorize("❌ Git push failed:", "red"));
      if (error.stderr) {
        console.error(colorize(error.stderr.toString().trim(), "red"));
      } else if (error.message) {
        console.error(colorize(error.message, "red"));
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error(colorize(`❌ Deployment error: ${err.message}`, "red"));
    return false;
  }
}

async function buildOnly() {
  try {
    await removeDir(".next");
    await removeDir("out");
    if (!fs.existsSync("node_modules")) {
      const spinner = createSpinner("Installing dependencies");
      spinner.start();
      try {
        await runCommand("npm install --silent");
        spinner.succeed("Installing dependencies");
      } catch (error) {
        spinner.fail("Installing dependencies");
        console.error(colorize("❌ npm install failed:", "red"));
        console.error(colorize(error.message, "red"));
        if (error.stdout) console.error(colorize(error.stdout.toString(), "red"));
        if (error.stderr) console.error(colorize(error.stderr.toString(), "red"));
        throw error;
      }
    }
    const buildSpinner = createSpinner("Building project");
    buildSpinner.start();
    try {
      await runCommand("npx next build");
      buildSpinner.succeed("Building project");
    } catch (error) {
      if (buildSpinner && typeof buildSpinner.fail === 'function') {
        buildSpinner.fail("Building project");
      }
      console.error(colorize("❌ Build command failed:", "red"));
      console.error(colorize(error.message, "red"));
      if (error.stdout) console.error(colorize(error.stdout.toString(), "red"));
      if (error.stderr) console.error(colorize(error.stderr.toString(), "red"));
      throw error;
    }
    if (!fs.existsSync(outDir)) {
      throw new Error('"out" folder missing. Make sure output: "export" in next.config.js');
    }
    const backupSpinner = createSpinner("Creating backup");
    backupSpinner.start();
    try {
      await createBackup();
      backupSpinner.succeed("Creating backup");
    } catch (err) {
      backupSpinner.fail("Creating backup");
      console.error(colorize(`❌ Build failed: ${err.message}`, "red"));
      throw err;
    }
  } catch (err) {
    console.error(colorize(`❌ Build failed: ${err.message}`, "red"));
    throw err;
  }
}

async function buildAndDeploy() {
  try {
    await removeDir(".next");
    await removeDir("out");
    if (!fs.existsSync("node_modules")) {
      const spinner = createSpinner("Installing dependencies");
      spinner.start();
      try {
        await runCommand("npm install --silent");
        spinner.succeed("Installing dependencies");
      } catch (error) {
        spinner.fail("Installing dependencies");
        console.error(colorize("❌ npm install failed:", "red"));
        console.error(colorize(error.message, "red"));
        if (error.stdout) console.error(colorize(error.stdout.toString(), "red"));
        if (error.stderr) console.error(colorize(error.stderr.toString(), "red"));
        throw error;
      }
    }
    const buildSpinner = createSpinner("Building project");
    buildSpinner.start();
    try {
      await runCommand("npx next build");
      buildSpinner.succeed("Building project");
    } catch (error) {
      if (buildSpinner && typeof buildSpinner.fail === 'function') {
        buildSpinner.fail("Building project");
      }
      console.error(colorize("❌ Build command failed:", "red"));
      console.error(colorize(error.message, "red"));
      if (error.stdout) console.error(colorize(error.stdout.toString(), "red"));
      if (error.stderr) console.error(colorize(error.stderr.toString(), "red"));
      throw error;
    }
    if (!fs.existsSync(outDir)) {
      throw new Error('"out" folder missing. Make sure output: "export" in next.config.js');
    }
    const deploySuccess = await deployOutFolder();
    if (!deploySuccess) {
      console.error(colorize("⚠️  Deployment failed, but continuing with backup...", "yellow"));
    }
    const backupSpinner = createSpinner("Creating backup");
    backupSpinner.start();
    try {
      await createBackup();
      backupSpinner.succeed("Creating backup");
    } catch (err) {
      backupSpinner.fail("Creating backup");
      console.error(colorize(`❌ Backup failed: ${err.message}`, "red"));
      throw err;
    }
    if (!deploySuccess) {
      throw new Error("Deployment failed (backup completed)");
    }
  } catch (err) {
    if (!err.message.includes("Deployment failed")) {
      console.error(colorize(`❌ Build/Deploy failed: ${err.message}`, "red"));
    }
    throw err;
  }
}

process.on("SIGINT", () => {
  console.log(colorize("\n▶ Received Ctrl+C. Stopping dev server...", "yellow"));
  stopDevServer();
  process.exit(0);
});

if (!fs.existsSync("node_modules")) {
  const spinner = createSpinner("Installing dependencies").start();
  try {
    execSync("npm install --silent", { stdio: "pipe" });
    spinner.succeed("Installing dependencies");
  } catch (err) {
    spinner.fail("Installing dependencies");
  }
}

startDevServer();

function setupCLI() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(colorize("ℹ Commands:", "cyan"));
  console.log(colorize("  G → Build + Deploy + Restart dev server", "cyan"));
  console.log(colorize("  B → Build only (no git push) + Restart dev server", "cyan"));
  console.log(colorize("  C → Clear terminal", "cyan"));
  console.log(colorize("  Ctrl+C → Exit\n", "cyan"));
  rl.on("line", async (input) => {
    const cmd = input.trim().toUpperCase();
    if (cmd === "G") {
      stopDevServer();
      try {
        await buildAndDeploy();
        console.log(colorize("\n✅ Build and deploy completed successfully!", "green"));
        startDevServer();
      } catch (err) {
        console.error(colorize("\n❌ Build/Deploy failed. Restarting dev server...", "red"));
        startDevServer();
      }
    } else if (cmd === "B") {
      stopDevServer();
      try {
        await buildOnly();
        console.log(colorize("\n✅ Build completed successfully!", "green"));
        startDevServer();
      } catch (err) {
        console.error(colorize("\n❌ Build failed. Restarting dev server...", "red"));
        startDevServer();
      }
    } else if (cmd === "C") {
      process.stdout.write("\x1Bc");
      console.log(colorize("🧹 Terminal cleared.", "green"));
      console.log(colorize("ℹ Press 'G' to deploy, 'B' to build only, or Ctrl+C to exit.", "cyan"));
    } else {
      console.log(colorize("ℹ Unknown command. Use 'G', 'B', or 'C'.", "yellow"));
    }
  });
}

setupCLI();
