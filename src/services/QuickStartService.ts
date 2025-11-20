/**
 * Service for quick start automation - All logic consolidated here
 */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { PrerequisitesChecker } from "./PrerequisitesChecker";
import { ServerManager } from "./ServerManager";
import { ExecUtils } from "../utils/ExecUtils";
import { CodeWrapperChecker } from "../utils/CodeWrapperChecker";
import { SSHConfigManager } from "./SSHConfigManager";
import { HostnameGenerator } from "../utils/HostnameGenerator";

export class QuickStartService {
  /**
   * Quick Start: Automates the entire SageMaker connection process
   * This includes: prerequisites check, setup, fixes, server start, and connection
   */
  static async quickStart(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("SageMaker Remote");
    outputChannel.show();
    const log = (message: string) => {
      const timestamp = new Date().toISOString();
      outputChannel.appendLine(`[${timestamp}] ${message}`);
    };
    const logStep = (step: string, message: string) =>
      log(`Step ${step} - ${message}`);

    log("========================================");
    log("🚀 Quick Start: SageMaker Connection");
    log("========================================");
    log("");

    try {
      // Step 1: Check prerequisites
      logStep("1", "Checking prerequisites...");
      const checks = await PrerequisitesChecker.checkAll();

      // Check AWS CLI
      if (!checks.awsCli) {
        logStep("1", "❌ AWS CLI not found");
        log("   Please install AWS CLI from: https://aws.amazon.com/cli/");
        log("   Or run: winget install Amazon.AWSCLI");
        vscode.window.showErrorMessage(
          "AWS CLI not found. Please install it first."
        );
        return;
      }
      log("   ✅ AWS CLI installed");

      // Check and install Session Manager Plugin
      if (!checks.sessionManagerPlugin) {
        logStep("1", "Installing Session Manager Plugin...");
        try {
          await this.installSessionManagerPlugin(log);
          log("   ✅ Session Manager Plugin installed");
        } catch (error: any) {
          log(
            `   ⚠️  Failed to install Session Manager Plugin: ${error.message}`
          );
          log("   Please install manually from:");
          log(
            "   https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe"
          );
          vscode.window.showWarningMessage(
            "Session Manager Plugin installation failed. Please install manually."
          );
        }
      } else {
        log("   ✅ Session Manager Plugin installed");
      }

      // Check Remote-SSH extension
      const remoteSSH = await PrerequisitesChecker.checkRemoteSSHExtension();
      if (!remoteSSH.installed) {
        logStep("1", "❌ Remote-SSH extension not found");
        log("   Please install Remote-SSH extension:");
        log("   - VS Code: ms-vscode-remote.remote-ssh");
        log("   - Cursor: anysphere.remote-ssh");
        vscode.window.showErrorMessage(
          "Remote-SSH extension not found. Please install it first."
        );
        return;
      }
      log(`   ✅ Remote-SSH extension installed (${remoteSSH.type})`);

      // Check AWS Toolkit
      if (!checks.awsToolkit) {
        logStep("1", "⚠️  AWS Toolkit extension not found");
        log("   Please install: amazonwebservices.aws-toolkit-vscode");
        log("   This is required to start the local server.");
        const installAction = await vscode.window.showWarningMessage(
          "AWS Toolkit extension not found. Install it now?",
          "Install",
          "Continue Anyway"
        );
        if (installAction === "Install") {
          await vscode.commands.executeCommand(
            "workbench.extensions.installExtension",
            "amazonwebservices.aws-toolkit-vscode"
          );
          log(
            "   ⏳ Installing AWS Toolkit... Please wait and then run Quick Start again."
          );
          vscode.window.showInformationMessage(
            "AWS Toolkit is being installed. Please wait for it to finish, then run Quick Start again."
          );
          return;
        }
      } else {
        log("   ✅ AWS Toolkit extension installed");
      }

      logStep("1", "✅ Prerequisites check passed");

      // Step 2: Setup SSH config if needed
      log("");
      logStep("2", "Checking SSH config...");
      if (!checks.sshConfig) {
        log("   SSH config not found. Setting up...");
        const spaceArn = await vscode.window.showInputBox({
          prompt: "Enter SageMaker Space ARN",
          placeHolder:
            "arn:aws:sagemaker:us-east-1:123456789012:space/d-xxx/space-name",
        });

        if (!spaceArn) {
          log("   ❌ Space ARN is required");
          vscode.window.showErrorMessage(
            "Space ARN is required to setup SSH config."
          );
          return;
        }

        try {
          await SSHConfigManager.setupSSHConfig(spaceArn);
          log("   ✅ SSH config setup complete");
        } catch (error: any) {
          log(`   ❌ Failed to setup SSH config: ${error.message}`);
          vscode.window.showErrorMessage(
            `SSH config setup failed: ${error.message}`
          );
          return;
        }
      } else {
        log("   ✅ SSH config already configured");
      }

      // Step 3: Fix Code Wrapper (from PowerShell Step 1)
      log("");
      logStep("3", "Fixing code wrapper...");
      try {
        await this.fixCodeWrapperInternal(log, true);
        logStep("3", "✅ Code wrapper fixed");
      } catch (error: any) {
        logStep("3", `⚠️  Failed to fix code wrapper: ${error.message}`);
        log("   (You can run 'SageMaker: Fix Code Wrapper' manually later)");
      }

      // Step 4: Fix PATH (from PowerShell Step 2)
      log("");
      logStep("4", "Fixing PATH...");
      try {
        await this.fixPathInternal(log);
        logStep("4", "✅ PATH fixed");
      } catch (error: any) {
        logStep("4", `⚠️  Failed to fix PATH: ${error.message}`);
        log("   (You can add %USERPROFILE% to PATH manually)");
      }

      // Step 5: Fix SSH Config (from PowerShell Step 3)
      log("");
      logStep("5", "Fixing SSH config...");
      try {
        await this.fixSSHConfigInternal(log);
        logStep("5", "✅ SSH config fixed");
      } catch (error: any) {
        logStep("5", `⚠️  Failed to fix SSH config: ${error.message}`);
        log("   (You can run 'SageMaker: Fix SSH Config' manually later)");
      }

      // Step 6: Fix ARN Conversion (from PowerShell Step 4)
      log("");
      logStep("6", "Fixing ARN conversion...");
      try {
        await this.fixArnConversionInternal(log);
        logStep("6", "✅ ARN conversion fixed");
      } catch (error: any) {
        logStep(
          "6",
          `⚠️  Connection script not found yet (will fix after server starts)`
        );
      }

      // Step 7: Ensure storage directory exists (from PowerShell Step 5)
      log("");
      logStep("7", "Ensuring storage directory exists...");
      try {
        ServerManager.ensureStorageDirExists();
        log("   ✅ Storage directory ready");
      } catch (error: any) {
        log(`   ⚠️  Storage directory check: ${error.message}`);
        // Continue anyway
      }

      // Step 8: Clean up old SSH host keys (from PowerShell Step 6)
      log("");
      logStep("8", "Cleaning up old SSH host keys...");
      try {
        const knownHostsPath = path.join(
          process.env.USERPROFILE || "",
          ".ssh",
          "known_hosts"
        );
        if (fs.existsSync(knownHostsPath)) {
          const content = fs.readFileSync(knownHostsPath, "utf8");
          const lines = content.split("\n");
          const filtered = lines.filter((line) => !line.includes("sm_lc_arn"));
          if (filtered.length < lines.length) {
            fs.writeFileSync(knownHostsPath, filtered.join("\n"));
            log("   ✅ Removed old host keys");
          } else {
            log("   ✅ No old host keys found");
          }
        } else {
          log(
            "   ✅ No known_hosts file (will be created on first connection)"
          );
        }
      } catch (error: any) {
        log(`   ⚠️  Host key cleanup: ${error.message}`);
        // Continue anyway
      }

      // Step 9: Check server status (from PowerShell Step 7)
      log("");
      logStep("9", "Checking server status...");
      let serverInfo = await ServerManager.checkServerStatus();

      if (!serverInfo.running || !serverInfo.accessible) {
        log("");
        logStep("9", "❌ Server is NOT running");
        log("   Attempting to start server...");

        // Try to start the server
        const serverStarted = await this.startServerInternal(log);

        if (!serverStarted) {
          log("");
          log("📋 To start the server manually:");
          log("   1. Open AWS Toolkit sidebar (AWS icon in left sidebar)");
          log("   2. Navigate to: SageMaker AI → Studio → Domain → SPACES");
          log("   3. Right-click on your SPACE (NOT the app)");
          log("   4. Click: 'Open Remote Connection'");
          log(
            "   5. When the VS Code/Cursor Remote window opens, leave it open even if it errors"
          );
          log("   6. Wait 10-15 seconds for the server to finish starting");
          log("");
          log("   Then run this command again to connect.");

          const action = await vscode.window.showWarningMessage(
            "Server is not running. Start it via AWS Toolkit, then run this command again.",
            "Open AWS Toolkit",
            "Check Status",
            "I'll Start It Manually"
          );

          if (action === "Open AWS Toolkit") {
            try {
              await vscode.commands.executeCommand(
                "workbench.view.extension.aws-toolkit"
              );
            } catch (error: any) {
              log("⚠️  AWS Toolkit view not found. Opening Extensions view...");
              try {
                await vscode.commands.executeCommand(
                  "workbench.view.extensions"
                );
                setTimeout(() => {
                  vscode.commands.executeCommand(
                    "workbench.extensions.search",
                    "@id:amazonwebservices.aws-toolkit-vscode"
                  );
                }, 500);
                vscode.window.showInformationMessage(
                  "AWS Toolkit extension may not be installed. Please install it from the Extensions view.",
                  "Open Extensions"
                );
              } catch (fallbackError: any) {
                log(
                  `❌ Could not open Extensions view: ${fallbackError.message}`
                );
                vscode.window.showWarningMessage(
                  "Could not open AWS Toolkit. Please install the AWS Toolkit extension manually from the Extensions marketplace."
                );
              }
            }
          } else if (action === "Check Status") {
            vscode.commands.executeCommand("sagemaker-remote.checkStatus");
          }

          return;
        }

        // Re-check server status after starting
        log("   ⏳ Waiting for server to start...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        serverInfo = await ServerManager.checkServerStatus();
      }

      if (!serverInfo.running || !serverInfo.accessible) {
        log("   ❌ Server still not running after start attempt");
        return;
      }

      logStep(
        "9",
        `✅ Server is running (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`
      );

      // Step 10: Final verification
      log("");
      logStep(
        "10",
        "Final verification (double-checking server is still accessible)..."
      );
      const finalCheck = await ServerManager.checkServerStatus();
      if (!finalCheck.running || !finalCheck.accessible) {
        log("❌ Server stopped between checks!");
        log("Please restart the server and try again.");
        vscode.window.showErrorMessage(
          "Server stopped. Please restart it via AWS Toolkit and try again."
        );
        return;
      }
      logStep("10", "✅ Server verified and ready");

      // Step 11: Re-apply ARN conversion now that the script exists
      log("");
      logStep(
        "11",
        "Re-applying ARN conversion fix to the fresh connection script..."
      );
      try {
        // Force re-application by checking the script content first
        const connectScriptPath = ServerManager.getConnectionScriptPath();
        if (fs.existsSync(connectScriptPath)) {
          const scriptContent = fs.readFileSync(connectScriptPath, "utf8");
          const hasIncorrectSyntax =
            scriptContent.includes(
              "HTTP error $statusCode on attempt $attempt:"
            ) ||
            scriptContent.includes("HTTP $statusCode:") ||
            scriptContent.includes("Error on attempt $attempt:");

          // Check retry count
          const retryCountMatch = scriptContent.match(/\$maxRetries\s*=\s*(\d+)/);
          const retryCount = retryCountMatch ? parseInt(retryCountMatch[1], 10) : 0;
          const hasOldRetryCount = retryCount !== 10;

          if (hasIncorrectSyntax) {
            log("   ⚠️  Detected incorrect PowerShell syntax, fixing...");
          }
          
        if (hasOldRetryCount) {
          log(`   ⚠️  Detected incorrect retry count (${retryCount}), updating to 10...`);
        }
        }
        await this.fixArnConversionInternal(log);
        log("✅ Connection script refreshed with ARN conversion fix");

        // Verify the fix was applied correctly
        if (fs.existsSync(connectScriptPath)) {
          const scriptContent = fs.readFileSync(connectScriptPath, "utf8");
          const stillHasIncorrectSyntax =
            scriptContent.includes(
              "HTTP error $statusCode on attempt $attempt:"
            ) ||
            scriptContent.includes("HTTP $statusCode:") ||
            scriptContent.includes("Error on attempt $attempt:");

          // Check retry count
          const retryCountMatch = scriptContent.match(/\$maxRetries\s*=\s*(\d+)/);
          const retryCount = retryCountMatch ? parseInt(retryCountMatch[1], 10) : 0;
          const hasOldRetryCount = retryCount !== 10;

          if (stillHasIncorrectSyntax) {
            log(
              "   ⚠️  WARNING: Script still has incorrect syntax after fix attempt"
            );
            log(
              "   This may indicate the script was regenerated. Please run 'SageMaker: Fix ARN Conversion' manually."
            );
          } else if (hasOldRetryCount) {
            log(
              `   ⚠️  WARNING: Script still has old retry count (${retryCount}) after fix attempt`
            );
            log(
              "   This may indicate the script was regenerated. Please run 'SageMaker: Fix ARN Conversion' manually."
            );
          } else {
            log("   ✅ Verified: Script has correct PowerShell syntax and retry count (10)");
          }
        }
      } catch (error: any) {
        log(
          `⚠️  Unable to refresh connection script automatically: ${error.message}`
        );
        log(
          "   If AWS Toolkit regenerates the script again, run 'SageMaker: Fix ARN Conversion' before connecting."
        );
      }

      // Step 12: Verify PowerShell script and prepare for connection
      log("");
      logStep("12", "Verifying connection script...");
      const config = vscode.workspace.getConfiguration("sagemakerRemote");
      const sshHost = config.get<string>("sshHostAlias", "sagemaker");

      // Verify PowerShell script exists
      if (!ServerManager.connectionScriptExists()) {
        log("   ⚠️  PowerShell script not found");
        log("   This script is created by AWS Toolkit when the server starts.");
        log("   Try restarting the local server via AWS Toolkit.");
        vscode.window.showWarningMessage(
          "PowerShell script not found. Restart the local server via AWS Toolkit."
        );
        return;
      }

      log("   ✅ PowerShell script found");

      // Final check and fix right before connection to ensure script is up to date
      log("   🔍 Performing final check of PowerShell script...");
      const connectScriptPath = ServerManager.getConnectionScriptPath();
      if (fs.existsSync(connectScriptPath)) {
        const scriptContent = fs.readFileSync(connectScriptPath, "utf8");
        const retryCountMatch = scriptContent.match(/\$maxRetries\s*=\s*(\d+)/);
        const retryCount = retryCountMatch ? parseInt(retryCountMatch[1], 10) : 0;
        const hasOldRetryCount = retryCount !== 10;
        
        if (hasOldRetryCount) {
          log(`   ⚠️  Script still has incorrect retry count (${retryCount}), applying fix one more time...`);
          try {
            await this.fixArnConversionInternal(log);
            log("   ✅ Script updated with correct retry count");
          } catch (error: any) {
            log(`   ⚠️  Could not update script: ${error.message}`);
          }
        } else {
          log(`   ✅ Script has correct retry count (${retryCount})`);
        }
      }

      log("");
      log("========================================");
      log("✅ Quick Start Complete!");
      log("========================================");
      log("");
      log("📋 Next Steps:");
      log("");
      log("1. Connect manually using Remote-SSH:");
      log(`   Press F1 → Type "Remote-SSH: Connect to Host" → Select "${sshHost}"`);
      log("");
      log("2. If the host doesn't appear in the list:");
      log(`   Press F1 → Type "Remote-SSH: Connect to Host" → Type "${sshHost}" manually`);
      log("");
      log("💡 The server is ready. You can connect now or wait a few seconds if you prefer.");
      log("");
      log("💡 Troubleshooting:");
      log("   - If connection times out during 'server installation':");
      log(
        "     This means SSH connected, but remote server install is failing."
      );
      log("     Check Remote-SSH output panel for detailed errors.");
      log("   - If you see 'Failed to install server within the timeout':");
      log(
        "     The ProxyCommand is working, but Remote-SSH server installation is timing out."
      );
      log("     Try connecting again - sometimes it works on retry");
      log("   - The SSH config includes keepalive settings to prevent disconnects.");
      log("   - Run diagnostics: SageMaker: Diagnose Connection");
    } catch (error: any) {
      const outputChannel =
        vscode.window.createOutputChannel("SageMaker Remote");
      outputChannel.appendLine(
        `\n[${new Date().toISOString()}] ❌ Error during quick start: ${
          error.message
        }`
      );
      vscode.window.showErrorMessage(`Quick start failed: ${error.message}`);
    }
  }

  /**
   * Install Session Manager Plugin
   */
  private static async installSessionManagerPlugin(
    log: (message: string) => void
  ): Promise<void> {
    const downloadUrl =
      "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe";
    const installerPath = path.join(
      process.env.TEMP || "",
      "SessionManagerPluginSetup.exe"
    );

    log("   Downloading Session Manager Plugin...");
    await ExecUtils.execute(
      `powershell -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile '${installerPath}'"`
    );

    log("   Installing Session Manager Plugin...");
    await ExecUtils.execute(`"${installerPath}" /S`);

    log("   ✅ Session Manager Plugin installed");
  }

  /**
   * Apply all fixes internally (code wrapper, ARN conversion, SSH config)
   */
  private static async applyAllFixesInternal(
    outputChannel: vscode.OutputChannel,
    log: (message: string) => void
  ): Promise<void> {
    // 1. Fix code wrapper
    log("   Fixing code wrapper...");
    await this.fixCodeWrapperInternal(log, true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Fix ARN conversion (if script exists)
    if (ServerManager.connectionScriptExists()) {
      log("   Fixing ARN conversion...");
      await this.fixArnConversionInternal(log);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      log(
        "   ⚠️  Connection script not found yet (will fix after server starts)"
      );
    }

    // 3. Fix SSH config
    log("   Fixing SSH config...");
    await this.fixSSHConfigInternal(log);
  }

  /**
   * Fix code wrapper internally
   */
  private static async fixCodeWrapperInternal(
    log: (message: string) => void,
    suppressRestartPrompt: boolean = false
  ): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      let scriptPath = "";

      if (workspaceFolders && workspaceFolders.length > 0) {
        scriptPath = path.join(
          workspaceFolders[0].uri.fsPath,
          "scripts",
          "fix_cursor_code_command.ps1"
        );
      }

      if (!scriptPath || !fs.existsSync(scriptPath)) {
        log("   Creating code wrapper manually...");

        const cursorExe = CodeWrapperChecker.getCursorExePath();

        const possiblePaths = [
          path.join(process.env.USERPROFILE || "", "code.cmd"),
          path.join(process.env.USERPROFILE || "", "code.bat"),
          path.join(
            process.env.LOCALAPPDATA || "",
            "Programs",
            "cursor",
            "code.cmd"
          ),
        ];

        let existingCodePath: string | null = null;
        try {
          existingCodePath = await ExecUtils.findCommand("code");
          if (existingCodePath) {
            log(`   Found existing 'code' command at: ${existingCodePath}`);
          }
        } catch {
          // Ignore
        }

        const codeWrapperPath = possiblePaths[0];
        const codeWrapperContent = `@echo off
setlocal enabledelayedexpansion

set "FOLDER_URI="
set "NEXT_IS_URI=0"
set "ARGS="

:parse_args
if "%~1"=="" goto execute
if "!NEXT_IS_URI!"=="1" (
    set "FOLDER_URI=%~1"
    set "NEXT_IS_URI=0"
    shift
    goto parse_args
)
if /i "%~1"=="--folder-uri" (
    set "NEXT_IS_URI=1"
    shift
    goto parse_args
)
set "ARGS=!ARGS! %~1"
shift
goto parse_args

:execute
if defined FOLDER_URI (
    REM Cursor doesn't support remote URIs via command line like VS Code does
    REM The URI format is: vscode-remote://ssh-remote+user@host/path
    REM Instead of trying to open it (which fails), we just return success
    REM The connection will be handled by the SageMaker Remote Connection extension
    REM via Remote-SSH commands instead
    REM 
    REM Extract hostname from URI for logging (optional)
    REM Format: vscode-remote://ssh-remote+user@hostname/path
    echo SageMaker Remote Connection: URI received, connection will be handled by extension
    exit /b 0
) else (
    REM For non-URI commands, pass through to Cursor normally
    if defined ARGS (
        "${cursorExe.replace(/\\/g, "\\\\")}" !ARGS!
    ) else (
        "${cursorExe.replace(/\\/g, "\\\\")}"
    )
)
endlocal
`;

        fs.writeFileSync(codeWrapperPath, codeWrapperContent, "utf8");
        log(`   ✅ Created code wrapper at: ${codeWrapperPath}`);

        const cursorDir = path.dirname(cursorExe);
        if (fs.existsSync(cursorDir)) {
          const cursorWrapperPath = path.join(cursorDir, "code.cmd");
          try {
            fs.writeFileSync(cursorWrapperPath, codeWrapperContent, "utf8");
            log(`   ✅ Also created wrapper at: ${cursorWrapperPath}`);
          } catch (error: any) {
            log(
              `   ⚠️  Could not create wrapper in Cursor directory: ${error.message}`
            );
          }
        }

        const codeBatPath = path.join(
          process.env.USERPROFILE || "",
          "code.bat"
        );
        try {
          fs.writeFileSync(codeBatPath, codeWrapperContent, "utf8");
          log(`   ✅ Also created code.bat at: ${codeBatPath}`);
        } catch (error: any) {
          log(`   ⚠️  Could not create code.bat: ${error.message}`);
        }

        log("   ✅ Code wrapper created!");
        if (!suppressRestartPrompt) {
          log(
            "   ⚠️  You may need to restart Cursor for changes to take effect"
          );
        }
      } else {
        log(`   Running fix script: ${scriptPath}`);
        const terminal = vscode.window.createTerminal("Fix Code Wrapper");
        terminal.sendText(
          `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
        );
        terminal.show();
      }
    } catch (error: any) {
      log(`   ⚠️  Failed to fix code wrapper: ${error.message}`);
    }
  }

  /**
   * Fix PATH internally (from PowerShell Step 2)
   */
  private static async fixPathInternal(
    log: (message: string) => void
  ): Promise<void> {
    try {
      // Use a subexpression to properly construct the pattern
      const { stdout: pathCheck } = await ExecUtils.execute(
        "powershell -Command \"$userPath = [Environment]::GetEnvironmentVariable('Path', 'User'); $pattern = '^' + [regex]::Escape($env:USERPROFILE) + '$'; if ($userPath -split ';' | Select-String -Pattern $pattern) { Write-Output 'IN_PATH' } else { Write-Output 'NOT_IN_PATH' }\""
      );

      if (pathCheck.trim() !== "IN_PATH") {
        log("   Adding user profile to PATH...");
        const currentPath = await ExecUtils.execute(
          "powershell -Command \"[Environment]::GetEnvironmentVariable('Path', 'User')\""
        );
        const pathParts = currentPath.stdout
          .trim()
          .split(";")
          .filter((p) => p && p !== "");
        const newPath = `${process.env.USERPROFILE};${pathParts.join(";")}`;
        await ExecUtils.execute(
          `powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath.replace(
            /'/g,
            "''"
          )}', 'User')"`
        );
        log("   ✅ Added to START of PATH");
        log("   ⚠️  You MUST restart Cursor for PATH changes to take effect");
      } else {
        const { stdout: startCheck } = await ExecUtils.execute(
          "powershell -Command \"$userPath = [Environment]::GetEnvironmentVariable('Path', 'User'); $pathParts = $userPath -split ';'; if ($pathParts[0] -eq $env:USERPROFILE) { Write-Output 'AT_START' } else { Write-Output 'NOT_AT_START' }\""
        );
        if (startCheck.trim() !== "AT_START") {
          log("   Moving user profile to start of PATH...");
          const currentPath = await ExecUtils.execute(
            "powershell -Command \"[Environment]::GetEnvironmentVariable('Path', 'User')\""
          );
          const pathParts = currentPath.stdout
            .trim()
            .split(";")
            .filter((p) => p && p !== "" && p !== process.env.USERPROFILE);
          const newPath = `${process.env.USERPROFILE};${pathParts.join(";")}`;
          await ExecUtils.execute(
            `powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath.replace(
              /'/g,
              "''"
            )}', 'User')"`
          );
          log("   ✅ Moved to START of PATH");
          log("   ⚠️  You MUST restart Cursor for PATH changes to take effect");
        } else {
          log("   ✅ User profile already at START of PATH");
        }
      }
    } catch (error: any) {
      log(`   ⚠️  Could not modify PATH: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fix ARN conversion internally
   */
  private static async fixArnConversionInternal(
    log: (message: string) => void
  ): Promise<void> {
    try {
      const connectScriptPath = ServerManager.getConnectionScriptPath();
      ServerManager.ensureStorageDirExists();

      if (!fs.existsSync(connectScriptPath)) {
        log("   ⚠️  Connection script not found (server hasn't started yet)");
        return;
      }

      let scriptContent = fs.readFileSync(connectScriptPath, "utf8");

      const arnFixApplied = scriptContent.includes(
        "Convert app ARN to space ARN"
      );
      const retryFixApplied = scriptContent.includes(
        "Attempt $attempt of $maxRetries to get SSM session info"
      );

      // Check for incorrect syntax (old version with $statusCode: instead of ${statusCode})
      const hasIncorrectSyntax =
        scriptContent.includes("HTTP error $statusCode on attempt $attempt:") ||
        scriptContent.includes("HTTP $statusCode:") ||
        scriptContent.includes("Error on attempt $attempt:");

      // Check if retry count is not 10 (we want 10 retries, not 50)
      const retryCountMatch = scriptContent.match(/\$maxRetries\s*=\s*(\d+)/);
      const retryCount = retryCountMatch ? parseInt(retryCountMatch[1], 10) : 0;
      const hasOldRetryCount = retryCount !== 10;

      if (arnFixApplied && retryFixApplied && !hasIncorrectSyntax && !hasOldRetryCount) {
        log("   ✅ All fixes already applied with correct syntax and retry count");
        return;
      }

      if (hasIncorrectSyntax) {
        log("   ⚠️  Found incorrect syntax in retry logic, fixing...");
      }
      
      if (hasOldRetryCount) {
        log(`   ⚠️  Found old retry count (${retryCount}), updating to 50...`);
      }

      const backupPath = `${connectScriptPath}.backup.${Date.now()}`;
      fs.copyFileSync(connectScriptPath, backupPath);
      log(`   ✅ Created backup: ${backupPath}`);

      const arnConversionCode = [
        "",
        "# Convert app ARN to space ARN if needed (server only accepts space ARNs)",
        "if ($AWS_RESOURCE_ARN -match '^arn:aws:sagemaker:([^:]+):(\\d+):app/([^/]+)/([^/]+)/.*$') {",
        "    $region = $matches[1]",
        "    $account = $matches[2]",
        "    $domain = $matches[3]",
        "    $space = $matches[4]",
        '    $AWS_RESOURCE_ARN = "arn:aws:sagemaker:" + $region + ":" + $account + ":space/" + $domain + "/" + $space',
        '    Write-Host "Converted app ARN to space ARN: $AWS_RESOURCE_ARN"',
        "}",
        "",
      ].join("\n");

      // Fix ARN parsing to handle both _._ and ._ patterns
      const arnPatternOld = /(\$AWS_RESOURCE_ARN = \$matches\[2\] -replace '_\._', ':' -replace '__', '\/'\s*\n)/;
      const arnPatternNew = /(\$AWS_RESOURCE_ARN = \$matches\[2\] -replace '_\._', ':' -replace '\._', ':' -replace '__', '\/'\s*\n)/;
      
      if (scriptContent.match(arnPatternOld) && !scriptContent.match(arnPatternNew)) {
        scriptContent = scriptContent.replace(
          arnPatternOld,
          "$1"
        );
        scriptContent = scriptContent.replace(
          /(\$AWS_RESOURCE_ARN = \$matches\[2\] -replace '_\._', ':' -replace '__', '\/'\s*\n)/,
          "$AWS_RESOURCE_ARN = $matches[2] -replace '_\._', ':' -replace '\._', ':' -replace '__', '/'\n"
        );
        log("   ✅ Fixed ARN parsing to handle both _._ and ._ patterns");
      }

      if (!arnFixApplied && scriptContent.match(/AWS_RESOURCE_ARN.*-replace/)) {
        // Find the ARN replacement line and add conversion code after it
        const arnReplacementPattern = /(\$AWS_RESOURCE_ARN = \$matches\[2\][^\n]*\n)/;
        if (scriptContent.match(arnReplacementPattern)) {
          scriptContent = scriptContent.replace(
            arnReplacementPattern,
            (_match, captureGroup) => {
              return `${captureGroup}${arnConversionCode}`;
            }
          );
          log("   ✅ Added ARN conversion logic");
        }
      }

      const retryLogicCode = `
      # Reduced retries to fail faster - SSH ConnectTimeout is 30 seconds
      $maxRetries = 10
      $baseRetryInterval = 1
      $lastError = $null
      
      [Console]::Error.WriteLine("DEBUG: Starting retry loop, maxRetries=$maxRetries")
      # Try immediately first, then use short retries
      # No initial wait - SSH needs quick banner exchange
      
      for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
          try {
              [Console]::Error.WriteLine("DEBUG: Attempt \${attempt} of $maxRetries to get SSM session info...")
              Write-Host "Attempt \${attempt} of $maxRetries to get SSM session info..."
              # Use short timeout to fail fast - SSH needs quick connection
              $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
              [Console]::Error.WriteLine("DEBUG: Got response with status: $($response.StatusCode)")
              Write-Host "Received response with status: $($response.StatusCode)"
              
              if ($response.StatusCode -eq 200) {
                  if (-not $response.Content) {
                      Write-Host "Response content is empty, will retry..."
                      $lastError = "Empty response content"
                      if ($attempt -lt $maxRetries) {
                          Start-Sleep -Seconds $baseRetryInterval
                      }
                      continue
                  }
                  
                  $script:SSM_SESSION_JSON = $response.Content
                  Write-Host "Session JSON successfully retrieved on attempt \${attempt}"
                  return
              } else {
                  Write-Host "HTTP status $($response.StatusCode), will retry..."
                  Write-Host "Response: $($response.Content)"
                  $lastError = "HTTP status: $($response.StatusCode)"
              }
          } catch {
              [Console]::Error.WriteLine("DEBUG: Exception on attempt \${attempt}: $($_.Exception.GetType().FullName)")
              [Console]::Error.WriteLine("DEBUG: Exception message: $($_.Exception.Message)")
              if ($_.Exception.Response) {
                  $statusCode = $_.Exception.Response.StatusCode.value__
                  [Console]::Error.WriteLine("DEBUG: HTTP status code: $statusCode")
                  if ($statusCode -eq 500) {
                      # Exponential backoff for 500 errors (server not ready)
                      $waitTime = [Math]::Min($baseRetryInterval * [Math]::Pow(1.5, $attempt - 1), 15)
                      Write-Host "Server returned 500 (Internal Server Error) on attempt \${attempt}, will retry in $([Math]::Round($waitTime)) s..."
                      $lastError = "HTTP 500: Server not ready yet"
                      if ($attempt -lt $maxRetries) {
                          Start-Sleep -Seconds ([Math]::Round($waitTime))
                      }
                      continue
                  } else {
                      Write-Host "HTTP error \${statusCode} on attempt \${attempt}: $($_.Exception.Message), will retry..."
                      $lastError = "HTTP \${statusCode}: $($_.Exception.Message)"
                  }
              } else {
                  Write-Host "Error on attempt \${attempt}: $($_.Exception.Message), will retry..."
                  $lastError = $_.Exception.Message
                  # Check if it's a timeout or connection error
                  if ($_.Exception.Message -like "*timeout*" -or $_.Exception.Message -like "*Unable to connect*") {
                      [Console]::Error.WriteLine("DEBUG: Connection/timeout error - local server may not be running or not responding")
                  }
              }
          }
          
          if ($attempt -lt $maxRetries) {
              Start-Sleep -Seconds $baseRetryInterval
          }
      }
      
      Write-Error "Failed to get SSM session info after $maxRetries attempts. Last error: $lastError"
      exit 1`;

      // Re-apply retry logic if not applied, incorrect syntax detected, or old retry count
      if (!retryFixApplied || hasIncorrectSyntax || hasOldRetryCount) {
        if (hasIncorrectSyntax || hasOldRetryCount) {
          log("   Removing old retry logic...");
          // Remove the old retry logic - match from $maxRetries to the end of the function's try-catch
          // This pattern matches the entire retry loop
          const oldRetryPattern =
            /(\s+\$maxRetries\s*=\s*\d+[\s\S]*?Write-Error "Failed to get SSM session info after.*?exit\s+1[\s\S]*?)/;
          if (scriptContent.match(oldRetryPattern)) {
            scriptContent = scriptContent.replace(oldRetryPattern, "");
            log("   ✅ Removed old retry logic");
          }

          // Also try to remove just the problematic lines if the full pattern doesn't match
          if (hasIncorrectSyntax) {
            // Remove lines with incorrect syntax patterns (these are multiline, so we need to be careful)
            const lines = scriptContent.split("\n");
            const filteredLines: string[] = [];
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              // Skip lines with the incorrect syntax patterns
              if (
                line.includes("HTTP error $statusCode on attempt $attempt:") ||
                line.includes("HTTP $statusCode:") ||
                line.includes("Error on attempt $attempt:")
              ) {
                // Skip this line
                continue;
              }
              filteredLines.push(line);
            }
            if (filteredLines.length < lines.length) {
              scriptContent = filteredLines.join("\n");
              log(
                `   ✅ Removed ${
                  lines.length - filteredLines.length
                } lines with incorrect syntax`
              );
            }
          }
        }

        const tryCatchPattern =
          /(\s+try\s*\{[\s\S]*?\$script:SSM_SESSION_JSON = \$response\.Content[\s\S]*?Write-Host "Session JSON successfully retrieved"[\s\S]*?\}\s*catch\s*\{[\s\S]*?Write-Error "Exception in Get-SSMSessionInfo: \$_"[\s\S]*?exit\s+1[\s\S]*?\})/;

        if (scriptContent.match(tryCatchPattern)) {
          scriptContent = scriptContent.replace(
            tryCatchPattern,
            retryLogicCode
          );
          log("   ✅ Added/updated retry logic to Get-SSMSessionInfo");
        } else {
          const permissivePattern =
            /(function Get-SSMSessionInfo \{[\s\S]*?)(\s+try\s*\{[\s\S]*?\}\s*catch\s*\{[\s\S]*?Write-Error "Exception in Get-SSMSessionInfo: \$_"[\s\S]*?exit\s+1[\s\S]*?\})([\s\S]*?\n\})/;

          if (scriptContent.match(permissivePattern)) {
            scriptContent = scriptContent.replace(
              permissivePattern,
              (match, before, tryCatch, after) => {
                return before + retryLogicCode + after;
              }
            );
            log("   ✅ Added/updated retry logic to Get-SSMSessionInfo");
          }
        }
      }

      if (
        scriptContent.includes("Convert app ARN to space ARN") ||
        scriptContent.includes(
          "Attempt $attempt of $maxRetries to get SSM session info"
        )
      ) {
        fs.writeFileSync(connectScriptPath, scriptContent, "utf8");
        log("   ✅ Updated script with fixes");
      }
    } catch (error: any) {
      log(`   ⚠️  Failed to fix ARN conversion: ${error.message}`);
    }
  }

  /**
   * Fix SSH config internally
   */
  private static async fixSSHConfigInternal(
    log: (message: string) => void
  ): Promise<void> {
    try {
      const sshConfigPath = SSHConfigManager.getSSHConfigPath();

      if (!fs.existsSync(sshConfigPath)) {
        log("   ⚠️  SSH config file not found");
        return;
      }

      let configContent = fs.readFileSync(sshConfigPath, "utf8");

      if (!configContent.includes("Host sagemaker")) {
        log("   ⚠️  SSH config doesn't contain 'Host sagemaker'");
        return;
      }

      const hostMatch = configContent.match(
        /Host sagemaker[\s\S]*?(?=Host |$)/i
      );
      if (!hostMatch) {
        log("   ⚠️  Could not find sagemaker host entry");
        return;
      }

      const hostSection = hostMatch[0];
      let needsFix = false;
      let fixedSection = hostSection;

      if (hostSection.includes("%n") && !hostSection.includes("%h")) {
        fixedSection = fixedSection.replace(/%n/g, "%h");
        needsFix = true;
      }

      const serverInfoPath = ServerManager.getServerInfoPath();
      if (!hostSection.includes("SAGEMAKER_LOCAL_SERVER_FILE_PATH")) {
        fixedSection = fixedSection.replace(
          /(ProxyCommand\s+)(.+)/,
          `$1powershell.exe -NoProfile -Command "$env:SAGEMAKER_LOCAL_SERVER_FILE_PATH='${serverInfoPath}'; & '$2' %h"`
        );
        needsFix = true;
      }

      if (needsFix) {
        const backupPath = `${sshConfigPath}.backup.${Date.now()}`;
        fs.copyFileSync(sshConfigPath, backupPath);
        configContent = configContent.replace(
          /Host sagemaker[\s\S]*?(?=Host |$)/i,
          fixedSection
        );
        fs.writeFileSync(sshConfigPath, configContent, "utf8");
        log("   ✅ SSH config fixed");
      } else {
        log("   ✅ SSH config looks good");
      }
    } catch (error: any) {
      log(`   ⚠️  Failed to fix SSH config: ${error.message}`);
    }
  }

  /**
   * Start server internally
   */
  private static async startServerInternal(
    log: (message: string) => void
  ): Promise<boolean> {
    try {
      // Check for code wrapper issue first
      const codeWrapperIssue = await CodeWrapperChecker.checkCodeWrapperIssue();
      if (codeWrapperIssue.hasIssue) {
        log(`   ⚠️  Code wrapper issue detected: ${codeWrapperIssue.message}`);
        log("   Attempting to fix code wrapper...");
        await this.fixCodeWrapperInternal(log, true);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Try to execute AWS Toolkit commands that might start the server
      const awsCommands = [
        "aws.sagemaker.connectToNotebookSpace",
        "aws.sagemaker.openNotebook",
        "aws.sagemaker.connectToSpace",
      ];

      let commandFound = false;
      for (const cmd of awsCommands) {
        try {
          const commands = await vscode.commands.getCommands();
          if (commands.includes(cmd)) {
            log(`   Found AWS Toolkit command: ${cmd}`);
            log(`   Executing command to trigger server start...`);
            commandFound = true;

            try {
              await vscode.commands.executeCommand(cmd);
              log(`   Command executed. Waiting for server to start...`);
            } catch (cmdError: any) {
              log(
                `   Command executed (may have failed, but server might start): ${cmdError.message}`
              );
            }
            break;
          }
        } catch {
          // Continue to next command
        }
      }

      if (!commandFound) {
        log(
          "   ⚠️  Could not find AWS Toolkit commands to trigger server start"
        );
        return false;
      }

      // Wait and check if server started
      log("   ⏳ Waiting 5 seconds for server to start...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const newServerInfo = await ServerManager.checkServerStatus();
      if (newServerInfo.running) {
        log(
          `   ✅ Server started! (PID: ${newServerInfo.pid}, Port: ${newServerInfo.port})`
        );
        return true;
      } else {
        log("   ⚠️  Server did not start automatically");
        return false;
      }
    } catch (error: any) {
      log(`   ❌ Failed to start server: ${error.message}`);
      return false;
    }
  }

  /**
   * Configure Remote-SSH timeout to prevent installation timeouts
   */
  private static async configureRemoteSSHTimeout(
    log: (message: string) => void
  ): Promise<void> {
    try {
      const remoteSSHConfig = vscode.workspace.getConfiguration("remote.SSH");
      const currentTimeout = remoteSSHConfig.get<number>("connectTimeout", 60);

      // The server installation timeout is separate and hardcoded to 120s in Remote-SSH
      // But we can increase connectTimeout to help with initial connection
      if (currentTimeout < 300) {
        log("   Increasing Remote-SSH connectTimeout to 300 seconds...");
        await remoteSSHConfig.update(
          "connectTimeout",
          300,
          vscode.ConfigurationTarget.Global
        );
        log("   ✅ Remote-SSH connectTimeout set to 300 seconds");
        log(
          "   ⚠️  Note: Server installation timeout is hardcoded to 120s in Remote-SSH"
        );
        log(
          "   If you still get timeouts, the server installation may be slow on SageMaker"
        );
      } else {
        log(
          `   ✅ Remote-SSH connectTimeout already set to ${currentTimeout} seconds`
        );
      }

      // Also check for server install timeout setting (if it exists)
      // Some versions of Remote-SSH may have this setting
      const serverInstallTimeout = remoteSSHConfig.get<number>(
        "serverInstallTimeout",
        120
      );
      if (serverInstallTimeout < 300) {
        try {
          await remoteSSHConfig.update(
            "serverInstallTimeout",
            300,
            vscode.ConfigurationTarget.Global
          );
          log("   ✅ Remote-SSH serverInstallTimeout set to 300 seconds");
        } catch {
          // Setting may not exist in this version of Remote-SSH
          log(
            "   ⚠️  serverInstallTimeout setting not available (may be hardcoded)"
          );
        }
      }
    } catch (error: any) {
      log(`   ⚠️  Could not configure Remote-SSH timeout: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initiate Remote-SSH connection internally
   */
  private static async initiateConnectionInternal(
    log: (message: string) => void,
    sshHost: string,
    remoteSSH: any
  ): Promise<void> {
    const commands = await vscode.commands.getCommands();
    let connectCommand: string | null = null;

    if (remoteSSH.type === "cursor") {
      if (commands.includes("remote-ssh.connectToHost")) {
        connectCommand = "remote-ssh.connectToHost";
      } else if (commands.includes("remote-ssh.connect")) {
        connectCommand = "remote-ssh.connect";
      } else if (commands.includes("opensshremotes.connectToHost")) {
        connectCommand = "opensshremotes.connectToHost";
      } else if (commands.includes("opensshremotes.connect")) {
        connectCommand = "opensshremotes.connect";
      } else if (commands.includes("opensshremotes.addNewSshHost")) {
        connectCommand = "opensshremotes.addNewSshHost";
      }
    } else {
      if (commands.includes("remote-ssh.connect")) {
        connectCommand = "remote-ssh.connect";
      } else if (commands.includes("remote.SSH.connect")) {
        connectCommand = "remote.SSH.connect";
      } else if (commands.includes("remote-ssh.connectToHost")) {
        connectCommand = "remote-ssh.connectToHost";
      } else if (commands.includes("opensshremotes.connectToHost")) {
        connectCommand = "opensshremotes.connectToHost";
      } else if (commands.includes("opensshremotes.connect")) {
        connectCommand = "opensshremotes.connect";
      }
    }

    if (connectCommand) {
      log(
        `   Attempting to open Remote-SSH connection using: ${connectCommand}`
      );
      try {
        await vscode.commands.executeCommand(connectCommand, sshHost);
        log("   ✅ Remote-SSH connection initiated");
      } catch (error: any) {
        log(`   ⚠️  Could not auto-connect: ${error.message}`);
        log(
          `   Please connect manually: F1 → "Remote-SSH: Connect to Host" → ${sshHost}`
        );
        await vscode.commands.executeCommand("workbench.action.showCommands");
        vscode.window.showInformationMessage(
          `Type "Remote-SSH: Connect to Host", then enter "${sshHost}" as the hostname when prompted`
        );
      }
    } else {
      log("   ⚠️  Remote-SSH connect command not found");
      log(
        `   Please connect manually: F1 → "Remote-SSH: Connect to Host" → ${sshHost}`
      );
      await vscode.commands.executeCommand("workbench.action.showCommands");
      vscode.window.showInformationMessage(
        `Type "Remote-SSH: Connect to Host", then enter "${sshHost}" as the hostname when prompted`
      );
    }
  }
}
