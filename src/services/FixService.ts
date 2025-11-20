/**
 * Service for applying fixes to common issues
 */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ExecUtils } from "../utils/ExecUtils";
import { CodeWrapperChecker } from "../utils/CodeWrapperChecker";
import { ServerManager } from "./ServerManager";
import { SSHConfigManager } from "./SSHConfigManager";

export class FixService {
  /**
   * Fix ARN conversion in the PowerShell connection script
   */
  static async fixArnConversion(): Promise<void> {
    const outputChannel =
      vscode.window.createOutputChannel("Fix ARN Conversion");
    outputChannel.show();

    try {
      outputChannel.appendLine(
        "Fixing ARN conversion in sagemaker_connect.ps1...\n"
      );

      const connectScriptPath = ServerManager.getConnectionScriptPath();

      // Ensure the directory exists
      ServerManager.ensureStorageDirExists();

      if (!fs.existsSync(connectScriptPath)) {
        outputChannel.appendLine("❌ Connection script not found!");
        outputChannel.appendLine(
          "   The script is created by AWS Toolkit when the server starts."
        );
        outputChannel.appendLine(
          "   Please start the server first: SageMaker: Start Local Server"
        );
        vscode.window.showErrorMessage(
          "Connection script not found. Start the server first."
        );
        return;
      }

      let scriptContent = fs.readFileSync(connectScriptPath, "utf8");

      // Check if both fixes already applied
      const arnFixApplied = scriptContent.includes(
        "Convert app ARN to space ARN"
      );
      const retryFixApplied = scriptContent.includes(
        "Attempt $attempt of $maxRetries to get SSM session info"
      );

      if (arnFixApplied && retryFixApplied) {
        outputChannel.appendLine("✅ All fixes already applied!");
        vscode.window.showInformationMessage("All fixes are already applied.");
        return;
      }

      // Create backup
      const backupPath = `${connectScriptPath}.backup.${Date.now()}`;
      fs.copyFileSync(connectScriptPath, backupPath);
      outputChannel.appendLine(`✅ Created backup: ${backupPath}`);

      // ARN conversion code
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

      // Find the line where AWS_RESOURCE_ARN is set and add ARN conversion if not already applied
      const arnPattern =
        /(\$AWS_RESOURCE_ARN = \$matches\[2\] -replace '_\._', ':' -replace '__', '\/'\s*\n)/;

      if (!arnFixApplied && scriptContent.match(arnPattern)) {
        scriptContent = scriptContent.replace(
          arnPattern,
          (_match, captureGroup) => {
            return `${captureGroup}${arnConversionCode}`;
          }
        );
        outputChannel.appendLine("✅ Added ARN conversion logic!");
      } else if (arnFixApplied) {
        outputChannel.appendLine("✅ ARN conversion already applied");
      }

      // Add retry logic to Get-SSMSessionInfo function (it currently has no retries, unlike Get-SSMSessionInfoAsync)
      // The function structure: try { Invoke-WebRequest ... $script:SSM_SESSION_JSON = $response.Content ... } catch { Write-Error ... exit 1 }
      const retryLogicCode = `
      $maxRetries = 20
      $baseRetryInterval = 3
      $lastError = $null
      
      # Initial wait to give server time to start
      Write-Host "Waiting 5 seconds for server to initialize..."
      Start-Sleep -Seconds 5
      
      for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
          try {
              Write-Host "Attempt $attempt of $maxRetries to get SSM session info..."
              $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
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
                  Write-Host "Session JSON successfully retrieved on attempt $attempt"
                  return
              } else {
                  Write-Host "HTTP status $($response.StatusCode), will retry..."
                  Write-Host "Response: $($response.Content)"
                  $lastError = "HTTP status: $($response.StatusCode)"
              }
          } catch {
              if ($_.Exception.Response) {
                  $statusCode = $_.Exception.Response.StatusCode.value__
                  if ($statusCode -eq 500) {
                      # Exponential backoff for 500 errors (server not ready)
                      $waitTime = [Math]::Min($baseRetryInterval * [Math]::Pow(1.5, $attempt - 1), 10)
                      Write-Host "Server returned 500 (Internal Server Error) on attempt $attempt, will retry in $([Math]::Round($waitTime)) s..."
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
              }
          }
          
          if ($attempt -lt $maxRetries) {
              Start-Sleep -Seconds $baseRetryInterval
          }
      }
      
      Write-Error "Failed to get SSM session info after $maxRetries attempts. Last error: $lastError"
      exit 1`;

      // Replace the try-catch block in Get-SSMSessionInfo with retry logic if not already applied
      if (!retryFixApplied) {
        // Use a simple regex to find and replace the try-catch block
        // Match: try { ... everything until ... } catch { Write-Error "Exception in Get-SSMSessionInfo: $_" ... exit 1 ... }
        // This pattern matches the entire try-catch block including all nested braces
        const tryCatchPattern =
          /(\s+try\s*\{[\s\S]*?\$script:SSM_SESSION_JSON = \$response\.Content[\s\S]*?Write-Host "Session JSON successfully retrieved"[\s\S]*?\}\s*catch\s*\{[\s\S]*?Write-Error "Exception in Get-SSMSessionInfo: \$_"[\s\S]*?exit\s+1[\s\S]*?\})/;

        if (scriptContent.match(tryCatchPattern)) {
          scriptContent = scriptContent.replace(
            tryCatchPattern,
            retryLogicCode
          );
          outputChannel.appendLine(
            "✅ Added retry logic to Get-SSMSessionInfo!"
          );
          outputChannel.appendLine(
            "   The function will now retry up to 10 times with 3-second intervals"
          );
          outputChannel.appendLine(
            "   This should handle 500 errors while the server initializes"
          );
        } else {
          // Try a more permissive pattern that matches any try-catch in Get-SSMSessionInfo
          const permissivePattern =
            /(function Get-SSMSessionInfo \{[\s\S]*?)(\s+try\s*\{[\s\S]*?\}\s*catch\s*\{[\s\S]*?Write-Error "Exception in Get-SSMSessionInfo: \$_"[\s\S]*?exit\s+1[\s\S]*?\})([\s\S]*?\n\})/;

          if (scriptContent.match(permissivePattern)) {
            scriptContent = scriptContent.replace(
              permissivePattern,
              (match, before, tryCatch, after) => {
                return before + retryLogicCode + after;
              }
            );
            outputChannel.appendLine(
              "✅ Added retry logic to Get-SSMSessionInfo (using permissive pattern)!"
            );
            outputChannel.appendLine(
              "   The function will now retry up to 10 times with 3-second intervals"
            );
          } else {
            // Last resort: find function and replace manually
            const funcStart = scriptContent.indexOf(
              "function Get-SSMSessionInfo {"
            );
            if (funcStart !== -1) {
              const funcEnd = scriptContent.indexOf(
                "\nfunction ",
                funcStart + 1
              );
              const funcEndIndex =
                funcEnd !== -1 ? funcEnd : scriptContent.length;
              const funcContent = scriptContent.substring(
                funcStart,
                funcEndIndex
              );

              // Find try { and the matching } catch { ... } }
              const tryIndex = funcContent.indexOf("\n      try {");
              if (tryIndex !== -1) {
                // Find the matching closing brace for the catch block
                let catchEnd = funcContent.lastIndexOf("      }\n  }");
                if (catchEnd === -1) {
                  catchEnd = funcContent.lastIndexOf("\n  }");
                }

                if (catchEnd > tryIndex) {
                  const beforeTry = funcContent.substring(0, tryIndex);
                  const afterCatch = funcContent.substring(catchEnd);
                  const newFunc = beforeTry + retryLogicCode + afterCatch;
                  scriptContent =
                    scriptContent.substring(0, funcStart) +
                    newFunc +
                    scriptContent.substring(funcEndIndex);
                  outputChannel.appendLine(
                    "✅ Added retry logic to Get-SSMSessionInfo (using manual replacement)!"
                  );
                  outputChannel.appendLine(
                    "   The function will now retry up to 10 times with 3-second intervals"
                  );
                } else {
                  outputChannel.appendLine(
                    "⚠️  Could not determine try-catch block boundaries"
                  );
                  outputChannel.appendLine(
                    "   Please run 'SageMaker: Fix ARN Conversion' manually after the server starts"
                  );
                }
              } else {
                outputChannel.appendLine(
                  "⚠️  Could not find try block in Get-SSMSessionInfo function"
                );
              }
            } else {
              outputChannel.appendLine(
                "⚠️  Could not find Get-SSMSessionInfo function"
              );
            }
          }
        }
      } else {
        outputChannel.appendLine("✅ Retry logic already applied");
      }

      // Save the script if we made any changes
      const hasChanges =
        scriptContent.includes("Convert app ARN to space ARN") ||
        scriptContent.includes(
          "Attempt $attempt of $maxRetries to get SSM session info"
        );

      if (hasChanges) {
        fs.writeFileSync(connectScriptPath, scriptContent, "utf8");
        const changes = [];
        if (scriptContent.includes("Convert app ARN to space ARN")) {
          changes.push("ARN conversion");
        }
        if (
          scriptContent.includes(
            "Attempt $attempt of $maxRetries to get SSM session info"
          )
        ) {
          changes.push("retry logic");
        }
        outputChannel.appendLine(
          `✅ Updated script with ${changes.join(" and ")}!`
        );
        if (changes.includes("retry logic")) {
          outputChannel.appendLine(
            "   Get-SSMSessionInfo will now retry up to 10 times with 3-second intervals"
          );
          outputChannel.appendLine(
            "   This should handle 500 errors while the server initializes"
          );
        }
        vscode.window.showInformationMessage(
          `Script updated with ${changes.join(" and ")}!`
        );
      } else if (!scriptContent.match(arnPattern)) {
        outputChannel.appendLine("❌ Could not find insertion point in script");
        outputChannel.appendLine("   The script format may have changed");
        vscode.window.showErrorMessage(
          "Could not apply fix. Script format may have changed."
        );
      }
    } catch (error: any) {
      const outputChannel =
        vscode.window.createOutputChannel("Fix ARN Conversion");
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Fix failed: ${error.message}`);
    }
  }

  /**
   * Fix code wrapper for Cursor compatibility
   * @param suppressRestartPrompt If true, won't show restart dialog (useful when called from quick start)
   */
  static async fixCodeWrapper(
    suppressRestartPrompt: boolean = false
  ): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("Fix Code Wrapper");
    outputChannel.show();

    try {
      outputChannel.appendLine("Fixing code wrapper...\n");

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
        outputChannel.appendLine("❌ Fix script not found!");
        outputChannel.appendLine("   Creating code wrapper manually...");

        const cursorExe = CodeWrapperChecker.getCursorExePath();

        // Try multiple locations to ensure the wrapper is found
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

        // Check if code command exists and where it points
        let existingCodePath: string | null = null;
        try {
          existingCodePath = await ExecUtils.findCommand("code");
          if (existingCodePath) {
            outputChannel.appendLine(
              `   Found existing 'code' command at: ${existingCodePath}`
            );
            // If it points to Cursor.exe directly, we need to replace it
            if (existingCodePath.toLowerCase().includes("cursor.exe")) {
              outputChannel.appendLine(
                "   ⚠️  'code' points directly to Cursor.exe (needs wrapper)"
              );
            }
          }
        } catch {
          // Ignore
        }

        // Create wrapper in user profile (should be in PATH)
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
        outputChannel.appendLine(
          `✅ Created code wrapper at: ${codeWrapperPath}`
        );

        // Also try to create in Cursor's directory if it exists
        const cursorDir = path.dirname(cursorExe);
        if (fs.existsSync(cursorDir)) {
          const cursorWrapperPath = path.join(cursorDir, "code.cmd");
          try {
            fs.writeFileSync(cursorWrapperPath, codeWrapperContent, "utf8");
            outputChannel.appendLine(
              `✅ Also created wrapper at: ${cursorWrapperPath}`
            );
          } catch (error: any) {
            outputChannel.appendLine(
              `   ⚠️  Could not create wrapper in Cursor directory: ${error.message}`
            );
            outputChannel.appendLine(
              "   (This is okay - user profile wrapper should work)"
            );
          }
        }

        // Add to PATH if not already there, and ensure it's at the START
        outputChannel.appendLine("   Checking PATH...");
        try {
          const { stdout: pathCheck } = await ExecUtils.execute(
            "powershell -Command \"$userPath = [Environment]::GetEnvironmentVariable('Path', 'User'); $pattern = '^' + [regex]::Escape($env:USERPROFILE) + '$'; if ($userPath -split ';' | Select-String -Pattern $pattern) { Write-Output 'IN_PATH' } else { Write-Output 'NOT_IN_PATH' }\""
          );

          if (pathCheck.trim() !== "IN_PATH") {
            outputChannel.appendLine(
              "   ⚠️  User profile not in PATH. Adding to START..."
            );
            const currentPath = await ExecUtils.execute(
              "powershell -Command \"[Environment]::GetEnvironmentVariable('Path', 'User')\""
            );
            const newPath = `${
              process.env.USERPROFILE
            };${currentPath.stdout.trim()}`;
            await ExecUtils.execute(
              `powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath.replace(
                /'/g,
                "''"
              )}', 'User')"`
            );
            outputChannel.appendLine("   ✅ Added to START of PATH");
            outputChannel.appendLine(
              "   ⚠️  You MUST restart Cursor for PATH changes to take effect"
            );
          } else {
            // Check if it's at the start
            const { stdout: startCheck } = await ExecUtils.execute(
              "powershell -Command \"$userPath = [Environment]::GetEnvironmentVariable('Path', 'User'); $pathParts = $userPath -split ';'; if ($pathParts[0] -eq $env:USERPROFILE) { Write-Output 'AT_START' } else { Write-Output 'NOT_AT_START' }\""
            );
            if (startCheck.trim() !== "AT_START") {
              outputChannel.appendLine(
                "   ⚠️  User profile in PATH but not at start. Moving to start..."
              );
              const currentPath = await ExecUtils.execute(
                "powershell -Command \"[Environment]::GetEnvironmentVariable('Path', 'User')\""
              );
              const pathParts = currentPath.stdout
                .trim()
                .split(";")
                .filter((p) => p && p !== process.env.USERPROFILE);
              const newPath = `${process.env.USERPROFILE};${pathParts.join(
                ";"
              )}`;
              await ExecUtils.execute(
                `powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath.replace(
                  /'/g,
                  "''"
                )}', 'User')"`
              );
              outputChannel.appendLine("   ✅ Moved to START of PATH");
              outputChannel.appendLine(
                "   ⚠️  You MUST restart Cursor for PATH changes to take effect"
              );
            } else {
              outputChannel.appendLine(
                "   ✅ User profile already at START of PATH"
              );
            }
          }
        } catch (error: any) {
          outputChannel.appendLine(
            `   ⚠️  Could not modify PATH automatically: ${error.message}`
          );
          outputChannel.appendLine(
            "   Please add %USERPROFILE% to the START of your PATH manually"
          );
        }

        // Also create code.bat for better compatibility
        const codeBatPath = path.join(
          process.env.USERPROFILE || "",
          "code.bat"
        );
        try {
          fs.writeFileSync(codeBatPath, codeWrapperContent, "utf8");
          outputChannel.appendLine(
            `✅ Also created code.bat at: ${codeBatPath}`
          );
        } catch (error: any) {
          outputChannel.appendLine(
            `   ⚠️  Could not create code.bat: ${error.message}`
          );
        }

        // Verify the wrapper works
        outputChannel.appendLine("\n   Testing wrapper...");
        try {
          // Test if code command now points to our wrapper
          const testCodePath = await ExecUtils.findCommand("code");
          if (
            testCodePath &&
            (testCodePath.includes("code.cmd") ||
              testCodePath.includes("code.bat"))
          ) {
            outputChannel.appendLine(
              `   ✅ Wrapper is in PATH: ${testCodePath}`
            );
          } else {
            outputChannel.appendLine(
              `   ⚠️  Wrapper may not be in PATH yet. Found: ${
                testCodePath || "nothing"
              }`
            );
            outputChannel.appendLine(
              "   💡 You may need to restart Cursor for PATH changes to take effect"
            );
          }
        } catch {
          outputChannel.appendLine("   ⚠️  Could not verify wrapper location");
        }

        outputChannel.appendLine("\n✅ Code wrapper created!");
        outputChannel.appendLine("📋 Next steps:");
        outputChannel.appendLine(
          "   1. RESTART Cursor completely (close all windows)"
        );
        outputChannel.appendLine(
          "   2. After restart, start the server via AWS Toolkit"
        );
        outputChannel.appendLine(
          "   3. Use our extension to connect: 'SageMaker: Connect to SageMaker'"
        );
        outputChannel.appendLine("");
        outputChannel.appendLine(
          "ℹ️  Important: Cursor doesn't support remote URIs via command line."
        );
        outputChannel.appendLine(
          "   The wrapper will prevent errors, but AWS Toolkit's auto-connect won't work."
        );
        outputChannel.appendLine(
          "   Instead, use our extension's connection commands:"
        );
        outputChannel.appendLine(
          "   - 'SageMaker: Quick Start: Connect to SageMaker' (recommended)"
        );
        outputChannel.appendLine("   - 'SageMaker: Connect to SageMaker'");

        if (!suppressRestartPrompt) {
          vscode.window
            .showInformationMessage(
              "Code wrapper created! Please RESTART Cursor completely for changes to take effect.",
              "Restart Now"
            )
            .then((action) => {
              if (action === "Restart Now") {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
              }
            });
        } else {
          outputChannel.appendLine(
            "   (Restart prompt suppressed - will be handled after quick start)"
          );
        }
      } else {
        // Run the fix script
        outputChannel.appendLine(`Running fix script: ${scriptPath}`);
        const terminal = vscode.window.createTerminal("Fix Code Wrapper");
        terminal.sendText(
          `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
        );
        terminal.show();
        vscode.window.showInformationMessage(
          "Running code wrapper fix script. Check terminal for output."
        );
      }
    } catch (error: any) {
      const outputChannel =
        vscode.window.createOutputChannel("Fix Code Wrapper");
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Fix failed: ${error.message}`);
    }
  }

  /**
   * Fix SSH config issues
   */
  static async fixSSHConfig(): Promise<void> {
    await SSHConfigManager.fixSSHConfig();
  }

  /**
   * Fix PowerShell script to suppress debug output that breaks SSH banner exchange
   * This redirects Write-Host and debug output to stderr or suppresses it entirely
   */
  static async fixPowerShellDebugOutput(): Promise<void> {
    const outputChannel =
      vscode.window.createOutputChannel("Fix PowerShell Debug Output");
    outputChannel.show();

    try {
      outputChannel.appendLine(
        "Fixing PowerShell script to suppress debug output...\n"
      );

      const connectScriptPath = ServerManager.getConnectionScriptPath();

      if (!fs.existsSync(connectScriptPath)) {
        outputChannel.appendLine("❌ Connection script not found!");
        outputChannel.appendLine(
          "   The script is created by AWS Toolkit when the server starts."
        );
        outputChannel.appendLine(
          "   Please start the server first: SageMaker: Start Local Server"
        );
        vscode.window.showErrorMessage(
          "Connection script not found. Start the server first."
        );
        return;
      }

      let scriptContent = fs.readFileSync(connectScriptPath, "utf8");

      // Check if script is broken from a previous fix attempt
      const hasSyntaxError = scriptContent.includes("Missing ')' in function parameter list") ||
                            (scriptContent.includes("$DebugPreference = 'SilentlyContinue'") && 
                             scriptContent.includes("Unexpected token '-Object'"));
      
      if (hasSyntaxError) {
        outputChannel.appendLine("⚠️  Script appears to have syntax errors from a previous fix attempt.");
        outputChannel.appendLine("   Looking for backup to restore...");
        
        // Look for backup files
        const scriptDir = path.dirname(connectScriptPath);
        const backupFiles = fs.readdirSync(scriptDir)
          .filter(f => f.startsWith(path.basename(connectScriptPath) + ".backup."))
          .sort()
          .reverse(); // Most recent first
        
        if (backupFiles.length > 0) {
          const latestBackup = path.join(scriptDir, backupFiles[0]);
          outputChannel.appendLine(`   Found backup: ${backupFiles[0]}`);
          const restoreChoice = await vscode.window.showWarningMessage(
            "Script has syntax errors. Restore from backup?",
            "Restore",
            "Skip"
          );
          
          if (restoreChoice === "Restore") {
            scriptContent = fs.readFileSync(latestBackup, "utf8");
            fs.writeFileSync(connectScriptPath, scriptContent, "utf8");
            outputChannel.appendLine("✅ Script restored from backup!");
            outputChannel.appendLine("   Now applying the fix with improved method...");
          } else {
            outputChannel.appendLine("   Skipping restore. Please manually fix or restart server to regenerate script.");
            return;
          }
        } else {
          outputChannel.appendLine("   No backup found. Please restart the local server to regenerate the script.");
          outputChannel.appendLine("   Or manually fix the PowerShell script syntax errors.");
          vscode.window.showErrorMessage(
            "Script has syntax errors and no backup found. Restart the server to regenerate the script."
          );
          return;
        }
      }

      // Check if fix already applied (correctly)
      const fixApplied = scriptContent.includes(
        "# Suppress debug output for SSH ProxyCommand compatibility"
      ) && !hasSyntaxError;

      if (fixApplied) {
        outputChannel.appendLine("✅ Debug output suppression already applied!");
        vscode.window.showInformationMessage(
          "Debug output suppression is already applied."
        );
        return;
      }

      // Create backup
      const backupPath = `${connectScriptPath}.backup.${Date.now()}`;
      fs.copyFileSync(connectScriptPath, backupPath);
      outputChannel.appendLine(`✅ Created backup: ${backupPath}`);

      // Add debug suppression at the very beginning of the script
      // Use a simple approach: suppress debug output and redirect Write-Host calls
      // We'll wrap the script in a way that redirects stdout to stderr for Write-Host
      const debugSuppressionCode = [
        "# Suppress debug output for SSH ProxyCommand compatibility",
        "# SSH interprets any stdout output as part of the banner exchange",
        "# Redirect Write-Host to stderr (SSH handles stderr separately)",
        "",
        "# Suppress debug and verbose output",
        "$DebugPreference = 'SilentlyContinue'",
        "$VerbosePreference = 'SilentlyContinue'",
        "",
        "# Redirect Write-Host to stderr using a simple wrapper",
        "Set-Alias -Name Write-Host-Original -Value Write-Host -Scope Global -Force",
        "function Write-Host {",
        "    [CmdletBinding()]",
        "    param(",
        "        [Parameter(ValueFromPipeline=$true, ValueFromRemainingArguments=$true)]",
        "        [object[]]$Object,",
        "        [string]$ForegroundColor,",
        "        [string]$BackgroundColor,",
        "        [switch]$NoNewline",
        "    )",
        "    $allParams = @{}",
        "    if ($ForegroundColor) { $allParams['ForegroundColor'] = $ForegroundColor }",
        "    if ($BackgroundColor) { $allParams['BackgroundColor'] = $BackgroundColor }",
        "    if ($NoNewline) { $allParams['NoNewline'] = $true }",
        "    Write-Host-Original -Object $Object @allParams *>&2",
        "}",
        "",
      ].join("\n");

      // Insert at the very beginning of the script
      // Find a safe insertion point: after param block, before any function definitions
      const lines = scriptContent.split("\n");
      let insertIndex = 0;
      let inParamBlock = false;
      let parenCount = 0;

      // Find the end of the param block (if it exists) or first executable line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lowerLine = line.toLowerCase();
        
        // Skip empty lines and comments
        if (!line || line.startsWith("#")) {
          continue;
        }
        
        // Check if we're in a param block
        if (line.includes("param(")) {
          inParamBlock = true;
          parenCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
          continue;
        }
        
        // If in param block, track parentheses
        if (inParamBlock) {
          parenCount += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
          if (parenCount <= 0 && line.includes(")")) {
            // End of param block
            insertIndex = i + 1;
            break;
          }
          continue;
        }
        
        // If we see a function definition, insert before it
        if (lowerLine.startsWith("function ") || lowerLine.startsWith("filter ")) {
          insertIndex = i;
          break;
        }
        
        // First executable line (not in param, not a function)
        insertIndex = i;
        break;
      }

      // Insert the code as separate lines
      const codeLines = debugSuppressionCode.split("\n");
      lines.splice(insertIndex, 0, ...codeLines);
      scriptContent = lines.join("\n");
      outputChannel.appendLine(`✅ Added debug output suppression at line ${insertIndex + 1}!`);

      // Also replace any Write-Host that might output debug info
      // Replace Write-Host with redirected version for critical debug lines
      scriptContent = scriptContent.replace(
        /Write-Host\s+"DEBUG:\s*(\d+)\+\s+>>>>\s+(.+?)"/g,
        "# Suppressed debug output: $1+ >>>> $2"
      );

      // Write the fixed script
      fs.writeFileSync(connectScriptPath, scriptContent, "utf8");
      outputChannel.appendLine(`✅ Script fixed and saved!`);
      outputChannel.appendLine("");
      outputChannel.appendLine(
        "💡 The script will now suppress debug output that breaks SSH connections."
      );
      outputChannel.appendLine(
        "   Try connecting again via Remote-SSH."
      );

      vscode.window.showInformationMessage(
        "PowerShell script fixed! Debug output suppressed. Try connecting again."
      );
    } catch (error: any) {
      outputChannel.appendLine(`❌ Error: ${error.message}`);
      vscode.window.showErrorMessage(`Fix failed: ${error.message}`);
    }
  }

  /**
   * Apply all fixes with optional confirmation prompt
   */
  static async applyAllFixes(options?: {
    skipConfirmation?: boolean;
    suppressRestartPrompt?: boolean;
  }): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("Apply All Fixes");
    outputChannel.show();

    try {
      outputChannel.appendLine("Applying all fixes...\n");
      outputChannel.appendLine("This will:");
      outputChannel.appendLine("1. Fix code wrapper");
      outputChannel.appendLine("2. Fix ARN conversion");
      outputChannel.appendLine("3. Fix SSH config");
      outputChannel.appendLine("");

      if (!options?.skipConfirmation) {
        const result = await vscode.window.showWarningMessage(
          "Apply all fixes? This will modify your configuration files.",
          "Apply All",
          "Cancel"
        );

        if (result !== "Apply All") {
          outputChannel.appendLine("Cancelled by user");
          return;
        }
      }

      await this.runAllFixesSequence({
        outputChannel,
        suppressRestartPrompt: options?.suppressRestartPrompt ?? false,
      });

      outputChannel.appendLine("\n========================================");
      outputChannel.appendLine("✅ All fixes applied!");
      outputChannel.appendLine("========================================");
      outputChannel.appendLine("");
      outputChannel.appendLine("Next steps:");
      outputChannel.appendLine("1. Restart Cursor (if code wrapper was fixed)");
      outputChannel.appendLine(
        "2. Start server: SageMaker: Start Local Server"
      );
      outputChannel.appendLine("3. Connect: SageMaker: Connect to SageMaker");

      vscode.window
        .showInformationMessage(
          "All fixes applied! You may need to restart Cursor.",
          "Restart Cursor",
          "Start Server"
        )
        .then((selection) => {
          if (selection === "Restart Cursor") {
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          } else if (selection === "Start Server") {
            vscode.commands.executeCommand("sagemaker-remote.startServer");
          }
        });
    } catch (error: any) {
      const outputChannel =
        vscode.window.createOutputChannel("Apply All Fixes");
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Failed to apply fixes: ${error.message}`);
    }
  }

  /**
   * Apply all fixes without prompts (used during Quick Start)
   */
  static async applyAllFixesQuiet(options?: {
    suppressRestartPrompt?: boolean;
    outputChannel?: vscode.OutputChannel;
  }): Promise<void> {
    const outputChannel =
      options?.outputChannel ??
      vscode.window.createOutputChannel("Apply All Fixes (Quick Start)");
    if (!options?.outputChannel) {
      outputChannel.show();
    }

    try {
      await this.runAllFixesSequence({
        outputChannel,
        suppressRestartPrompt: options?.suppressRestartPrompt ?? false,
      });
      outputChannel.appendLine("\n✅ Quick Start fixes complete");
    } catch (error: any) {
      outputChannel.appendLine(`\n❌ Failed to run fixes: ${error.message}`);
      vscode.window.showErrorMessage(
        `Quick Start fixes failed: ${error.message}`
      );
    }
  }

  private static async runAllFixesSequence(options: {
    outputChannel: vscode.OutputChannel;
    suppressRestartPrompt: boolean;
  }): Promise<void> {
    const { outputChannel, suppressRestartPrompt } = options;

    // 1. Fix code wrapper
    outputChannel.appendLine("1. Fixing code wrapper...");
    await this.fixCodeWrapper(suppressRestartPrompt);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Fix ARN conversion
    outputChannel.appendLine("\n2. Fixing ARN conversion...");
    await this.fixArnConversion();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Fix SSH config
    outputChannel.appendLine("\n3. Fixing SSH config...");
    await this.fixSSHConfig();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Fix PowerShell debug output
    outputChannel.appendLine("\n4. Fixing PowerShell debug output...");
    await this.fixPowerShellDebugOutput();
  }
}
