/**
 * Service for running comprehensive diagnostics
 */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ExecUtils } from "../utils/ExecUtils";
import { CodeWrapperChecker } from "../utils/CodeWrapperChecker";
import { PrerequisitesChecker } from "./PrerequisitesChecker";
import { ServerManager } from "./ServerManager";
import { SSHConfigManager } from "./SSHConfigManager";

export class DiagnosticsService {
  /**
   * Run comprehensive diagnostics
   */
  static async diagnoseConnection(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("SageMaker Diagnostics");
    outputChannel.show();

    try {
      outputChannel.appendLine("========================================");
      outputChannel.appendLine("SageMaker Connection Diagnostics");
      outputChannel.appendLine("========================================");
      outputChannel.appendLine("");

      // 1. Check code wrapper
      outputChannel.appendLine("1. Checking code wrapper...");
      const codeWrapperIssue = await CodeWrapperChecker.checkCodeWrapperIssue();
      if (codeWrapperIssue.hasIssue) {
        outputChannel.appendLine(`   ❌ ${codeWrapperIssue.message}`);
      } else {
        outputChannel.appendLine(`   ✅ ${codeWrapperIssue.message}`);
      }
      outputChannel.appendLine("");

      // 2. Check PATH configuration
      outputChannel.appendLine("2. Checking PATH configuration...");
      let pathIssue = false;
      try {
        const { stdout } = await ExecUtils.execute(
          "powershell -Command \"$env:Path -split ';' | Select-String -Pattern '$env:USERPROFILE'\""
        );
        if (stdout.trim()) {
          outputChannel.appendLine("   ✅ User profile is in PATH");
          const { stdout: pathCheck } = await ExecUtils.execute(
            "powershell -Command \"$userPath = [Environment]::GetEnvironmentVariable('Path', 'User'); $pathParts = $userPath -split ';'; if ($pathParts[0] -eq $env:USERPROFILE) { Write-Output 'START' } else { Write-Output 'NOT_START' }\""
          );
          if (pathCheck.trim() === "START") {
            outputChannel.appendLine("   ✅ User profile is at START of PATH");
          } else {
            outputChannel.appendLine("   ⚠️  User profile is in PATH but not at the start");
            outputChannel.appendLine("      This may cause issues if multiple 'code' commands exist");
            pathIssue = true;
          }
        } else {
          outputChannel.appendLine("   ⚠️  User profile NOT in PATH");
          outputChannel.appendLine("      Code wrapper is working from Cursor directory, but PATH fix recommended");
          pathIssue = true;
        }
      } catch {
        outputChannel.appendLine("   ⚠️  Could not check PATH");
      }
      outputChannel.appendLine("");

      // 3. Check which 'code' command is found
      outputChannel.appendLine("3. Checking which 'code' command is found...");
      const codePath = await ExecUtils.findCommand("code");
      if (codePath) {
        outputChannel.appendLine(`   ✅ Found: ${codePath}`);
        if (codePath.includes(process.env.USERPROFILE || "")) {
          outputChannel.appendLine("   ✅ Using wrapper from user profile");
        } else if (codePath.toLowerCase().includes("cursor")) {
          outputChannel.appendLine("   ✅ Points to Cursor");
        } else if (codePath.toLowerCase().includes("code.exe") || codePath.toLowerCase().includes("vs code")) {
          outputChannel.appendLine("   ❌ Using VS Code instead of wrapper!");
        }
      } else {
        outputChannel.appendLine("   ❌ 'code' command not found in PATH");
      }
      outputChannel.appendLine("");

      // 4. Check Cursor installation
      outputChannel.appendLine("4. Checking Cursor installation...");
      const cursorExe = CodeWrapperChecker.getCursorExePath();
      if (fs.existsSync(cursorExe)) {
        outputChannel.appendLine(`   ✅ Cursor found at: ${cursorExe}`);
      } else {
        outputChannel.appendLine("   ⚠️  Cursor not found at expected location");
      }
      outputChannel.appendLine("");

      // 5. Check Remote-SSH extension
      outputChannel.appendLine("5. Remote-SSH Extension Check...");
      const remoteSSH = await PrerequisitesChecker.checkRemoteSSHExtension();
      if (remoteSSH.installed) {
        outputChannel.appendLine("   ✅ Remote-SSH extension is installed");
        outputChannel.appendLine(`      Version: ${remoteSSH.extensionId} (${remoteSSH.type})`);
      } else {
        outputChannel.appendLine("   ❌ Remote-SSH extension NOT installed");
        outputChannel.appendLine("      This extension is REQUIRED for remote connections!");
      }
      outputChannel.appendLine("");

      // 6. Check SSH config
      outputChannel.appendLine("6. Checking SSH config...");
      const sshConfigPath = SSHConfigManager.getSSHConfigPath();
      if (fs.existsSync(sshConfigPath)) {
        outputChannel.appendLine("   ✅ SSH config exists");
        const content = fs.readFileSync(sshConfigPath, "utf8");
        if (content.includes("sm_") || content.includes("sagemaker")) {
          outputChannel.appendLine("   ✅ Found SageMaker SSH entries");
        } else {
          outputChannel.appendLine("   ⚠️  No SageMaker SSH entries found");
          outputChannel.appendLine("      AWS Toolkit will create these when connecting");
        }
      } else {
        outputChannel.appendLine("   ⚠️  SSH config not found (will be created automatically)");
      }
      outputChannel.appendLine("");

      // 7. Check server status
      outputChannel.appendLine("7. Checking local server status...");
      const serverInfo = await ServerManager.checkServerStatus();
      if (serverInfo.running) {
        outputChannel.appendLine(`   ✅ Server is running (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`);
      } else {
        outputChannel.appendLine("   ❌ Server is NOT running");
        if (serverInfo.error) {
          outputChannel.appendLine(`      Error: ${serverInfo.error}`);
        }
      }
      outputChannel.appendLine("");

      // 8. Check ARN conversion fix
      outputChannel.appendLine("8. Checking ARN conversion fix...");
      const connectScriptPath = ServerManager.getConnectionScriptPath();
      if (fs.existsSync(connectScriptPath)) {
        const scriptContent = fs.readFileSync(connectScriptPath, "utf8");
        if (scriptContent.includes("Convert app ARN to space ARN")) {
          outputChannel.appendLine("   ✅ ARN conversion fix is applied");
        } else {
          outputChannel.appendLine("   ❌ ARN conversion fix NOT applied");
          outputChannel.appendLine("      Run: SageMaker: Fix ARN Conversion");
        }
      } else {
        outputChannel.appendLine("   ⚠️  Connection script not found (server hasn't started yet)");
      }
      outputChannel.appendLine("");

      // 9. Check retry fix
      outputChannel.appendLine("9. Checking retry logic fix...");
      if (fs.existsSync(connectScriptPath)) {
        const scriptContent = fs.readFileSync(connectScriptPath, "utf8");
        if (scriptContent.includes("Attempt $attempt of $maxRetries to get SSM session info")) {
          outputChannel.appendLine("   ✅ Retry logic fix is applied");
        } else {
          outputChannel.appendLine("   ❌ Retry logic fix NOT applied");
          outputChannel.appendLine("      Run: SageMaker: Fix ARN Conversion (applies both fixes)");
        }
      } else {
        outputChannel.appendLine("   ⚠️  Connection script not found (server hasn't started yet)");
      }
      outputChannel.appendLine("");

      // 9b. Check PowerShell script syntax errors
      outputChannel.appendLine("9b. Checking PowerShell script syntax...");
      const scriptSyntaxErrors: string[] = [];
      if (fs.existsSync(connectScriptPath)) {
        try {
          const scriptContent = fs.readFileSync(connectScriptPath, "utf8");
          
          // Check for common syntax errors
          const openBraces = (scriptContent.match(/\{/g) || []).length;
          const closeBraces = (scriptContent.match(/\}/g) || []).length;
          if (openBraces !== closeBraces) {
            scriptSyntaxErrors.push(`Mismatched braces: ${openBraces} open, ${closeBraces} close`);
          }

          const openParens = (scriptContent.match(/\(/g) || []).length;
          const closeParens = (scriptContent.match(/\)/g) || []).length;
          if (openParens !== closeParens) {
            scriptSyntaxErrors.push(`Mismatched parentheses: ${openParens} open, ${closeParens} close`);
          }

          // Check for unclosed strings
          const unclosedStringPattern = /Write-Error\s+['"]([^'"]*)$/gm;
          if (unclosedStringPattern.test(scriptContent)) {
            scriptSyntaxErrors.push("Unclosed string in Write-Error statement");
          }

          // Check for duplicate $REGION assignments (corruption indicator)
          const regionAssignments = (scriptContent.match(/\$REGION\s*=\s*\(\$AWS_RESOURCE_ARN/g) || []).length;
          if (regionAssignments > 1) {
            scriptSyntaxErrors.push(`Duplicate $REGION assignments detected (${regionAssignments} found - indicates corruption)`);
          }

          // Check for unclosed if statements
          if (scriptContent.includes('if ($Hostname -match') && 
              !scriptContent.match(/if\s*\(\$Hostname\s+-match[^}]*\}/s)) {
            scriptSyntaxErrors.push("Unclosed if statement detected");
          }

          // Check for malformed ARN conversion
          if (scriptContent.match(/if \(\$AWS_RESOURCE_ARN -match '[^']*\'\} else \{/)) {
            scriptSyntaxErrors.push("Malformed ARN conversion pattern detected");
          }

          // Check for broken session plugin calls
          if (scriptContent.includes('& $sessionPlugin') && 
              scriptContent.includes('"$REGION" "StartSession"') &&
              !scriptContent.match(/&\s+\$sessionPlugin\s+[^\n]+\s+"\$REGION"\s+"StartSession/)) {
            scriptSyntaxErrors.push("Broken session-manager-plugin call detected");
          }

          // Validate PowerShell syntax using parser
          try {
            await ExecUtils.execute(
              `powershell -Command "& { $ErrorActionPreference = 'Stop'; $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content '${connectScriptPath.replace(/\\/g, "/")}' -Raw), [ref]$null) }"`
            );
            if (scriptSyntaxErrors.length === 0) {
              outputChannel.appendLine("   ✅ PowerShell syntax is valid");
            } else {
              outputChannel.appendLine("   ⚠️  PowerShell syntax validation passed, but structural issues detected:");
              scriptSyntaxErrors.forEach(err => outputChannel.appendLine(`      - ${err}`));
            }
          } catch (parseError: any) {
            scriptSyntaxErrors.push(`PowerShell parser error: ${parseError.message.substring(0, 100)}`);
            outputChannel.appendLine("   ❌ PowerShell syntax validation FAILED");
            scriptSyntaxErrors.forEach(err => outputChannel.appendLine(`      - ${err}`));
            outputChannel.appendLine("   💡 Run: SageMaker: Fix PowerShell Script Syntax");
          }
        } catch (readError: any) {
          outputChannel.appendLine(`   ❌ Could not read script: ${readError.message}`);
        }
      } else {
        outputChannel.appendLine("   ⚠️  Script not found (server hasn't started yet)");
      }
      outputChannel.appendLine("");

      // 10. Check for 500 Internal Server Errors
      outputChannel.appendLine("10. Checking for 500 Internal Server Errors...");
      if (serverInfo.running && serverInfo.port) {
        try {
          // Check if server endpoint responds (even with errors)
          const endpointReady = await ServerManager.checkServerEndpointReady(serverInfo.port, 3, 1000);
          if (endpointReady) {
            outputChannel.appendLine("   ✅ Server HTTP endpoint is responding");
            outputChannel.appendLine("   ℹ️  If you see 500 errors, the server is running but in a bad state");
            outputChannel.appendLine("   💡 Solution: Restart the server via AWS Toolkit UI");
            outputChannel.appendLine("      1. Open AWS Toolkit sidebar (AWS icon)");
            outputChannel.appendLine("      2. SageMaker AI → Studio → Domain → SPACES");
            outputChannel.appendLine("      3. Right-click Space → 'Open Remote Connection'");
            outputChannel.appendLine("      4. Wait 15-20 seconds for server to restart");
          } else {
            outputChannel.appendLine("   ⚠️  Server HTTP endpoint not responding");
            outputChannel.appendLine("   💡 This could indicate:");
            outputChannel.appendLine("      - Server just started (wait 30-60 seconds)");
            outputChannel.appendLine("      - Server is in a bad state (restart via AWS Toolkit)");
            outputChannel.appendLine("      - Port is blocked or server crashed");
          }
        } catch (error: any) {
          outputChannel.appendLine(`   ⚠️  Could not check server endpoint: ${error.message}`);
        }
      } else {
        outputChannel.appendLine("   ⚠️  Cannot check - server is not running");
      }
      outputChannel.appendLine("");

      // 11. Test ProxyCommand (if server is running)
      outputChannel.appendLine("11. Testing ProxyCommand...");
      if (serverInfo.running && serverInfo.port) {
        try {
          const serverInfoPath = ServerManager.getServerInfoPath();
          const scriptPath = ServerManager.getConnectionScriptPath();
          
          if (fs.existsSync(scriptPath)) {
            outputChannel.appendLine("   ✅ PowerShell script exists");
            
            // Check script content for proper configuration
            try {
              const scriptContent = fs.readFileSync(scriptPath, "utf8");
              
              // Check for retry logic
              const hasRetryLogic = scriptContent.includes("$maxRetries") && 
                                    scriptContent.includes("Attempt");
              if (hasRetryLogic) {
                const retryMatch = scriptContent.match(/\$maxRetries\s*=\s*(\d+)/);
                const retryCount = retryMatch ? parseInt(retryMatch[1], 10) : 0;
                if (retryCount >= 50) {
                  outputChannel.appendLine(`   ✅ Script has proper retry logic (${retryCount} attempts)`);
                } else if (retryCount > 0) {
                  outputChannel.appendLine(`   ⚠️  Script has low retry count (${retryCount}), should be 50`);
                  outputChannel.appendLine("      Run 'SageMaker: Fix ARN Conversion' to update it");
                }
              } else {
                outputChannel.appendLine("   ⚠️  Script may be missing retry logic");
              }
              
              // Check for correct variable escaping
              const hasCorrectEscaping = scriptContent.includes("\\${statusCode}") || 
                                        scriptContent.includes('${statusCode}');
              if (hasCorrectEscaping && !scriptContent.includes("$statusCode:")) {
                outputChannel.appendLine("   ✅ Script has correct PowerShell variable syntax");
              } else if (scriptContent.includes("$statusCode:")) {
                outputChannel.appendLine("   ⚠️  Script has incorrect variable syntax (may cause errors)");
                outputChannel.appendLine("      Run 'SageMaker: Fix ARN Conversion' to fix it");
              }
              
              // Check if server endpoint is ready before testing execution
              outputChannel.appendLine("   Checking if server HTTP endpoint is ready...");
              const endpointReady = await ServerManager.checkServerEndpointReady(
                serverInfo.port,
                5,
                1000
              );
              
              if (endpointReady) {
                outputChannel.appendLine("   ✅ Server HTTP endpoint is ready");
                outputChannel.appendLine("   ℹ️  Note: Full script execution test skipped (can take 30-60 seconds)");
                outputChannel.appendLine("      The script will retry up to 50 times with exponential backoff.");
                outputChannel.appendLine("      If SSH connections timeout, check Remote-SSH output panel for details.");
              } else {
                outputChannel.appendLine("   ⚠️  Server HTTP endpoint not ready yet");
                outputChannel.appendLine("      This is normal if the server just started.");
                outputChannel.appendLine("      Wait 30-60 seconds and try connecting again.");
              }
            } catch (readError: any) {
              outputChannel.appendLine(`   ⚠️  Could not read script: ${readError.message}`);
            }
          } else {
            outputChannel.appendLine("   ❌ Script not found");
            outputChannel.appendLine("      The script should be created by AWS Toolkit when you start the server.");
            outputChannel.appendLine("      Try: AWS Toolkit → SageMaker → Right-click Space → 'Open Remote Connection'");
          }
        } catch (error: any) {
          outputChannel.appendLine(`   ⚠️  Could not test ProxyCommand: ${error.message}`);
        }
      } else {
        outputChannel.appendLine("   ⚠️  Cannot test - server is not running");
        outputChannel.appendLine("      Start the server first via AWS Toolkit");
      }
      outputChannel.appendLine("");

      // 12. Test SSH connection directly
      outputChannel.appendLine("12. Testing SSH connection directly...");
      if (serverInfo.running && serverInfo.port) {
        try {
          const sshConfigPath = path.join(process.env.USERPROFILE || "", ".ssh", "config");
          if (fs.existsSync(sshConfigPath)) {
            const configContent = fs.readFileSync(sshConfigPath, "utf8");
            if (configContent.includes("Host sagemaker")) {
              outputChannel.appendLine("   Testing SSH connection with a simple command...");
              outputChannel.appendLine("   ℹ️  This test uses a 30-second timeout (connection can be slow)");
              
              // Try to run a simple command via SSH to verify the connection works
              const testCommand = `ssh -F "${sshConfigPath}" -o ConnectTimeout=10 sagemaker "echo 'SSH connection test successful'" 2>&1`;
              
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout after 30 seconds")), 30000)
              );
              
              const execPromise = ExecUtils.execute(testCommand);
              
              try {
                const result = await Promise.race([execPromise, timeoutPromise]) as any;
                if (result.stdout && result.stdout.includes("SSH connection test successful")) {
                  outputChannel.appendLine("   ✅ SSH connection works! The ProxyCommand is functioning correctly.");
                  outputChannel.appendLine("   ℹ️  If Remote-SSH times out, the issue is with server installation, not SSH.");
                } else {
                  const output = (result.stdout || result.stderr || "No output").toString().trim();
                  if (output.length > 200) {
                    outputChannel.appendLine(`   ⚠️  SSH connection test returned output (first 200 chars):`);
                    outputChannel.appendLine(`      ${output.substring(0, 200)}...`);
                  } else {
                    outputChannel.appendLine(`   ⚠️  SSH connection test: ${output}`);
                  }
                  outputChannel.appendLine("   ℹ️  Some errors are expected - the connection may still work for Remote-SSH");
                }
              } catch (error: any) {
                if (error.message.includes("Timeout")) {
                  outputChannel.appendLine("   ⚠️  SSH connection test timed out after 30 seconds");
                  outputChannel.appendLine("   ℹ️  This is normal if:");
                  outputChannel.appendLine("      - The server just started (SSM session initialization takes 60-90 seconds)");
                  outputChannel.appendLine("      - The connection is slow");
                  outputChannel.appendLine("      - The instance is under heavy load");
                  outputChannel.appendLine("   💡 Try waiting 60-90 seconds after server start, then connect via Remote-SSH");
                } else {
                  const errorMsg = error.message || error.toString();
                  if (errorMsg.length > 200) {
                    outputChannel.appendLine(`   ⚠️  SSH connection test error (first 200 chars):`);
                    outputChannel.appendLine(`      ${errorMsg.substring(0, 200)}...`);
                  } else {
                    outputChannel.appendLine(`   ⚠️  SSH connection test: ${errorMsg}`);
                  }
                  outputChannel.appendLine("   ℹ️  Some errors are expected - the connection may still work for Remote-SSH");
                }
              }
            } else {
              outputChannel.appendLine("   ⚠️  Cannot test - SSH config doesn't contain 'Host sagemaker'");
            }
          } else {
            outputChannel.appendLine("   ⚠️  Cannot test - SSH config file not found");
          }
        } catch (error: any) {
          outputChannel.appendLine(`   ⚠️  Could not test SSH connection: ${error.message}`);
        }
      } else {
        outputChannel.appendLine("   ⚠️  Cannot test - server is not running");
      }
      outputChannel.appendLine("");

      // 13. Check for partially installed remote server
      outputChannel.appendLine("13. Checking for partially installed remote server...");
      let hasPartialInstallation = false;
      try {
        const remoteServerCheck = await ExecUtils.checkRemoteServerInstallation("sagemaker");
        if (remoteServerCheck.partiallyInstalled) {
          hasPartialInstallation = true;
          outputChannel.appendLine(`   ⚠️  Found partial server installation:`);
          outputChannel.appendLine(`      ${remoteServerCheck.details}`);
          outputChannel.appendLine("   💡 This may indicate a previous failed installation.");
          outputChannel.appendLine("      This can cause server installation timeouts.");
          outputChannel.appendLine("      Solution: Run 'SageMaker: Clean Up Remote Server'");
        } else {
          outputChannel.appendLine("   ✅ No partial installation detected (clean state)");
          if (remoteServerCheck.details && !remoteServerCheck.details.includes("Could not check")) {
            outputChannel.appendLine(`   ℹ️  ${remoteServerCheck.details}`);
          }
        }
      } catch (error: any) {
        outputChannel.appendLine(`   ⚠️  Could not check remote server installation: ${error.message}`);
        outputChannel.appendLine("      (This is normal if the server is not running or SSH is not configured)");
      }
      outputChannel.appendLine("");

      // 14. Check mapping file
      outputChannel.appendLine("14. Checking profile mapping file...");
      const mappingFile = path.join(process.env.USERPROFILE || "", ".aws", ".sagemaker-space-profiles");
      if (fs.existsSync(mappingFile)) {
        outputChannel.appendLine("   ✅ Mapping file exists");
        try {
          const mappingContent = JSON.parse(fs.readFileSync(mappingFile, "utf8"));
          const spaceArns = Object.keys(mappingContent.localCredential || {});
          outputChannel.appendLine(`      Found ${spaceArns.length} profile(s)`);
        } catch {
          outputChannel.appendLine("   ⚠️  Mapping file exists but could not parse");
        }
      } else {
        outputChannel.appendLine("   ⚠️  Mapping file not found (will be created when server starts)");
      }
      outputChannel.appendLine("");

      outputChannel.appendLine("========================================");
      outputChannel.appendLine("Diagnostics Complete");
      outputChannel.appendLine("========================================");
      outputChannel.appendLine("");

      // Recommendations
      outputChannel.appendLine("Recommendations:");
      let recNum = 1;
      if (hasPartialInstallation) {
        outputChannel.appendLine(`${recNum++}. Clean up partial installation: SageMaker: Clean Up Remote Server`);
        outputChannel.appendLine("      This will remove failed server installations on the remote host");
      }
      if (codeWrapperIssue.hasIssue) {
        outputChannel.appendLine(`${recNum++}. Fix code wrapper: SageMaker: Fix Code Wrapper`);
      }
      if (pathIssue) {
        outputChannel.appendLine(`${recNum++}. Fix PATH: Run 'SageMaker: Fix Code Wrapper' to add user profile to PATH`);
        outputChannel.appendLine("      (Restart Cursor after fixing PATH)");
      }
      if (!serverInfo.running) {
        outputChannel.appendLine(`${recNum++}. Start server: SageMaker: Start Local Server`);
      }
      if (fs.existsSync(connectScriptPath)) {
        const scriptContent = fs.readFileSync(connectScriptPath, "utf8");
        if (!scriptContent.includes("Convert app ARN to space ARN")) {
          outputChannel.appendLine(`${recNum++}. Apply ARN conversion fix: SageMaker: Fix ARN Conversion`);
        }
        if (!scriptContent.includes("Attempt $attempt of $maxRetries to get SSM session info")) {
          outputChannel.appendLine(`${recNum++}. Apply retry logic fix: SageMaker: Fix ARN Conversion (applies both)`);
        }
      }
      // Add PowerShell script fix recommendation if errors found
      if (scriptSyntaxErrors.length > 0) {
        outputChannel.appendLine(`${recNum++}. Fix PowerShell script syntax: SageMaker: Fix PowerShell Script Syntax`);
        outputChannel.appendLine("      This will attempt to fix syntax errors in the connection script");
      }

      if (recNum === 1) {
        outputChannel.appendLine("✅ All checks passed! No fixes needed.");
      } else {
        outputChannel.appendLine(`${recNum}. Or apply all fixes: SageMaker: Apply All Fixes`);
      }
      outputChannel.appendLine("");
      outputChannel.appendLine("💡 If SSH connection times out during server installation:");
      outputChannel.appendLine("   - This usually means the ProxyCommand is working (SSH connected)");
      outputChannel.appendLine("   - But the remote server installation is failing or hanging");
      outputChannel.appendLine("   ⚠️  IMPORTANT: Remote-SSH timeout is set to 300 seconds (5 minutes)");
      outputChannel.appendLine("   - The SSH connection itself is working (it reaches installation phase)");
      outputChannel.appendLine("   - Possible causes:");
      outputChannel.appendLine("     1. Partial installation from previous failed attempt");
      outputChannel.appendLine("     2. Slow network or instance under heavy load");
      outputChannel.appendLine("     3. Server installation script hanging");
      outputChannel.appendLine("   - Solutions:");
      outputChannel.appendLine("     1. Clean up partial installation: 'SageMaker: Clean Up Remote Server'");
      outputChannel.appendLine("     2. Check Remote-SSH output panel for detailed error messages");
      outputChannel.appendLine("     3. Try connecting multiple times (sometimes works on retry)");
      outputChannel.appendLine("     4. Wait a few minutes and try again");
      outputChannel.appendLine("     5. Check if SageMaker instance is slow/under load");

      vscode.window
        .showInformationMessage("Diagnostics complete. Check output panel for details.", "Apply All Fixes", "Fix Issues")
        .then((selection) => {
          if (selection === "Apply All Fixes") {
            vscode.commands.executeCommand("sagemaker-remote.applyAllFixes");
          } else if (selection === "Fix Issues") {
            vscode.window
              .showQuickPick(["Fix Code Wrapper", "Fix ARN Conversion", "Fix SSH Config", "Start Server"])
              .then((choice) => {
                if (choice === "Fix Code Wrapper") {
                  vscode.commands.executeCommand("sagemaker-remote.fixCodeWrapper");
                } else if (choice === "Fix ARN Conversion") {
                  vscode.commands.executeCommand("sagemaker-remote.fixArnConversion");
                } else if (choice === "Fix SSH Config") {
                  vscode.commands.executeCommand("sagemaker-remote.fixSshConfig");
                } else if (choice === "Start Server") {
                  vscode.commands.executeCommand("sagemaker-remote.startServer");
                }
              });
          }
        });
    } catch (error: any) {
      const outputChannel = vscode.window.createOutputChannel("SageMaker Diagnostics");
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Diagnostics failed: ${error.message}`);
    }
  }
}


