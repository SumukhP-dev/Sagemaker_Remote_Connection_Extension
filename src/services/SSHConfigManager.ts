/**
 * Service for managing SSH configuration
 */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ExecUtils } from "../utils/ExecUtils";
import { HostnameGenerator } from "../utils/HostnameGenerator";
import { ServerManager } from "./ServerManager";

export class SSHConfigManager {
  /**
   * Get the path to SSH config file
   */
  static getSSHConfigPath(): string {
    return path.join(process.env.USERPROFILE || "", ".ssh", "config");
  }

  /**
   * Setup SSH config with SageMaker host entry
   */
  static async setupSSHConfig(spaceArn: string): Promise<void> {
    const sshDir = path.join(process.env.USERPROFILE || "", ".ssh");
    const sshConfigPath = this.getSSHConfigPath();

    // Create .ssh directory if it doesn't exist
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { recursive: true });
    }

    // Read existing config
    let configContent = "";
    if (fs.existsSync(sshConfigPath)) {
      configContent = fs.readFileSync(sshConfigPath, "utf8");
    }

    // Check if sagemaker host already exists
    if (configContent.includes("Host sagemaker")) {
      vscode.window.showInformationMessage(
        "SSH config already contains SageMaker host"
      );
      return;
    }

    // Generate hostname from ARN
    const hostname = HostnameGenerator.generateHostname(spaceArn);
    const serverInfoPath = ServerManager.getServerInfoPath();

    // Add SSH config entry
    // Note: SSH config requires consistent indentation (spaces, not tabs)
    // Using 4 spaces for indentation as per SSH config standards
    const sshEntry = `Host sagemaker
    HostName ${hostname}
    User sagemaker-user
    ForwardAgent yes
    AddKeysToAgent yes
    StrictHostKeyChecking accept-new
    ServerAliveInterval 60
    ServerAliveCountMax 3
    ConnectTimeout 30
    ProxyCommand powershell.exe -NoProfile -Command "$env:SAGEMAKER_LOCAL_SERVER_FILE_PATH='${serverInfoPath}'; & '${ServerManager.getConnectionScriptPath()}' %h"
`;

    configContent += sshEntry;
    fs.writeFileSync(sshConfigPath, configContent, "utf8");
  }

  /**
   * Debug SSH config and provide detailed analysis
   */
  static async debugSSHConfig(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel(
      "SageMaker SSH Debug"
    );
    outputChannel.show();

    try {
      outputChannel.appendLine("🔍 Debugging SSH Config...\n");

      const sshConfigPath = this.getSSHConfigPath();

      outputChannel.appendLine(`SSH Config Path: ${sshConfigPath}`);
      outputChannel.appendLine(
        `File exists: ${fs.existsSync(sshConfigPath) ? "✅" : "❌"}\n`
      );

      if (!fs.existsSync(sshConfigPath)) {
        outputChannel.appendLine("❌ SSH config file doesn't exist!");
        outputChannel.appendLine("   Run: SageMaker: Setup SageMaker Connection");
        return;
      }

      const configContent = fs.readFileSync(sshConfigPath, "utf8");
      outputChannel.appendLine(`File size: ${configContent.length} bytes`);
      outputChannel.appendLine(
        `Line endings: ${
          configContent.includes("\r\n")
            ? "Windows (CRLF)"
            : configContent.includes("\n")
            ? "Unix (LF)"
            : "Unknown"
        }\n`
      );

      // Check for sagemaker host
      const hasSagemaker = configContent.includes("Host sagemaker");
      outputChannel.appendLine(
        `Contains "Host sagemaker": ${hasSagemaker ? "✅" : "❌"}\n`
      );

      if (hasSagemaker) {
        // Extract the sagemaker section
        const hostMatch = configContent.match(
          new RegExp(`Host sagemaker[\\s\\S]*?(?=Host |$)`, "i")
        );

        if (hostMatch) {
          const hostSection = hostMatch[0];
          outputChannel.appendLine("✅ Found sagemaker host entry:\n");
          outputChannel.appendLine("--- SSH Config Entry ---");
          outputChannel.appendLine(hostSection);
          outputChannel.appendLine("--- End Entry ---\n");

          // Check for common issues
          outputChannel.appendLine("🔍 Checking for common issues:\n");

          // Check indentation
          const lines = hostSection.split("\n");
          const indentationIssues = lines
            .slice(1)
            .filter(
              (line) =>
                line.trim() && !line.match(/^\s{4,}/) && !line.match(/^Host\s/)
            )
            .map((line, idx) => ({ line: line.trim(), index: idx + 2 }));

          if (indentationIssues.length > 0) {
            outputChannel.appendLine(
              "⚠️  Potential indentation issues (should be 4+ spaces):"
            );
            indentationIssues.forEach(({ line, index }) => {
              outputChannel.appendLine(
                `   Line ${index}: ${line.substring(0, 50)}`
              );
            });
            outputChannel.appendLine("");
          } else {
            outputChannel.appendLine("✅ Indentation looks correct\n");
          }

          // Check for required fields
          const requiredFields = ["HostName", "User", "ProxyCommand"];
          requiredFields.forEach((field) => {
            const hasField = hostSection.includes(field);
            outputChannel.appendLine(`   ${field}: ${hasField ? "✅" : "❌"}`);
          });
          outputChannel.appendLine("");

          // Check ProxyCommand path
          const proxyMatch = hostSection.match(/ProxyCommand\s+(.+)/);
          if (proxyMatch) {
            const proxyCmd = proxyMatch[1];
            outputChannel.appendLine(
              `ProxyCommand: ${proxyCmd.substring(0, 100)}...`
            );

            // Check if PowerShell script path exists
            const scriptPathMatch = proxyCmd.match(/& '([^']+)'/);
            if (scriptPathMatch) {
              const scriptPath = scriptPathMatch[1];
              outputChannel.appendLine(`Script path: ${scriptPath}`);
              const scriptExists = fs.existsSync(scriptPath);
              outputChannel.appendLine(
                `Script exists: ${scriptExists ? "✅" : "❌"}`
              );
              
              // Check for wrong editor path (Code vs Cursor)
              if (!scriptExists) {
                if (scriptPath.includes("Code\\User") || scriptPath.includes("Code/User")) {
                  const cursorPath = scriptPath.replace(/Code\\User/g, "Cursor\\User").replace(/Code\/User/g, "Cursor/User");
                  outputChannel.appendLine(`⚠️  CRITICAL: Script path points to VS Code instead of Cursor!`);
                  outputChannel.appendLine(`   Current: ${scriptPath}`);
                  outputChannel.appendLine(`   Should be: ${cursorPath}`);
                  outputChannel.appendLine(`   Fix: Run 'SageMaker: Fix SSH Config' or update manually`);
                }
              }
            }
            
            // Check for %n instead of %h
            if (proxyCmd.includes("%n") && !proxyCmd.includes("%h")) {
              outputChannel.appendLine(`⚠️  Issue: ProxyCommand uses %n instead of %h`);
              outputChannel.appendLine(`   %n is the hostname alias, %h is the actual hostname`);
              outputChannel.appendLine(`   Fix: Run 'SageMaker: Fix SSH Config'`);
            }
            
            // Check if environment variable is set
            if (!proxyCmd.includes("SAGEMAKER_LOCAL_SERVER_FILE_PATH")) {
              outputChannel.appendLine(`⚠️  Issue: Missing SAGEMAKER_LOCAL_SERVER_FILE_PATH environment variable`);
              outputChannel.appendLine(`   The ProxyCommand should set this variable`);
              outputChannel.appendLine(`   Fix: Run 'SageMaker: Fix SSH Config'`);
            }
          }
          outputChannel.appendLine("");
          
          // Check for sm_* wildcard host issues
          if (configContent.includes("Host sm_*")) {
            outputChannel.appendLine("🔍 Checking sm_* wildcard host entry...\n");
            const wildcardMatch = configContent.match(/Host sm_\*[\s\S]*?(?=Host |$)/i);
            if (wildcardMatch) {
              const wildcardSection = wildcardMatch[0];
              
              // Check for wrong editor path
              if (wildcardSection.includes("Code\\User") || wildcardSection.includes("Code/User")) {
                outputChannel.appendLine(`❌ CRITICAL: sm_* host uses VS Code path instead of Cursor!`);
                outputChannel.appendLine(`   This will cause connection failures`);
                outputChannel.appendLine(`   Fix: Update the path manually or delete this entry`);
              }
              
              // Check for %n instead of %h
              if (wildcardSection.includes("%n") && !wildcardSection.includes("%h")) {
                outputChannel.appendLine(`⚠️  Issue: sm_* ProxyCommand uses %n instead of %h`);
                outputChannel.appendLine(`   Fix: Update %n to %h in the ProxyCommand`);
              }
            }
            outputChannel.appendLine("");
          }

          // Try to validate with SSH (if available)
          try {
            outputChannel.appendLine("🔍 Testing SSH config syntax...");
            const { stdout } = await ExecUtils.execute(
              `ssh -F "${sshConfigPath}" -G sagemaker 2>&1`
            );
            if (stdout) {
              outputChannel.appendLine("✅ SSH can parse the config:");
              outputChannel.appendLine(stdout);
            }
          } catch (sshError: any) {
            outputChannel.appendLine(`⚠️  SSH validation: ${sshError.message}`);
            outputChannel.appendLine(
              "   (This is normal if SSH isn't in PATH or config has ProxyCommand)"
            );
          }
        } else {
          outputChannel.appendLine(
            "❌ Found 'Host sagemaker' but couldn't extract the entry"
          );
        }
      } else {
        outputChannel.appendLine(
          "❌ SSH config doesn't contain 'Host sagemaker'"
        );
        outputChannel.appendLine("\nCurrent config content:");
        outputChannel.appendLine("---");
        outputChannel.appendLine(configContent.substring(0, 500));
        if (configContent.length > 500) {
          outputChannel.appendLine("... (truncated)");
        }
        outputChannel.appendLine("---");
      }

      outputChannel.appendLine("\n💡 Troubleshooting tips:");
      outputChannel.appendLine(
        "   1. Make sure SSH config uses 4 spaces for indentation"
      );
      outputChannel.appendLine(
        "   2. Check for syntax errors (missing colons, etc.)"
      );
      outputChannel.appendLine(
        "   3. Try opening SSH config: F1 → 'Remote-SSH: Open SSH Configuration File'"
      );
      outputChannel.appendLine("   4. Reload Cursor after making changes");
      outputChannel.appendLine("   5. Check Remote-SSH output for errors");

      vscode.window
        .showInformationMessage(
          "SSH config debug complete. Check output panel for details.",
          "Open SSH Config"
        )
        .then((selection) => {
          if (selection === "Open SSH Config") {
            vscode.commands.executeCommand("opensshremotes.openConfigFile");
          }
        });
    } catch (error: any) {
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Debug failed: ${error.message}`);
    }
  }

  /**
   * Fix common SSH config issues
   */
  static async fixSSHConfig(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("Fix SSH Config");
    outputChannel.show();

    try {
      outputChannel.appendLine("Fixing SSH config...\n");

      const sshConfigPath = this.getSSHConfigPath();

      if (!fs.existsSync(sshConfigPath)) {
        outputChannel.appendLine("❌ SSH config file not found!");
        outputChannel.appendLine("   Run: SageMaker: Setup SageMaker Connection");
        vscode.window.showErrorMessage(
          "SSH config not found. Run Setup command first."
        );
        return;
      }

      let configContent = fs.readFileSync(sshConfigPath, "utf8");

      // Check if sagemaker host exists
      if (!configContent.includes("Host sagemaker")) {
        outputChannel.appendLine(
          "❌ SSH config doesn't contain 'Host sagemaker'"
        );
        outputChannel.appendLine("   Run: SageMaker: Setup SageMaker Connection");
        vscode.window.showErrorMessage(
          "SSH config missing. Run Setup command first."
        );
        return;
      }

      // Extract sagemaker host section
      const hostMatch = configContent.match(/Host sagemaker[\s\S]*?(?=Host |$)/i);
      if (!hostMatch) {
        outputChannel.appendLine("❌ Could not find sagemaker host entry");
        return;
      }

      const hostSection = hostMatch[0];
      let needsFix = false;
      let fixedSection = hostSection;

      // Fix 1: Check ProxyCommand uses %h instead of %n
      if (hostSection.includes("%n") && !hostSection.includes("%h")) {
        outputChannel.appendLine(
          "⚠️  Found issue: ProxyCommand uses %n instead of %h"
        );
        fixedSection = fixedSection.replace(/%n/g, "%h");
        needsFix = true;
      }
      
      // Fix 1b: Check for wrong editor path (Code vs Cursor)
      if (hostSection.includes("Code\\User") || hostSection.includes("Code/User")) {
        outputChannel.appendLine(
          "❌ CRITICAL: Found VS Code path instead of Cursor path!"
        );
        fixedSection = fixedSection.replace(/Code\\User/g, "Cursor\\User");
        fixedSection = fixedSection.replace(/Code\/User/g, "Cursor/User");
        needsFix = true;
      }

      // Fix 2: Check environment variable is set
      const serverInfoPath = ServerManager.getServerInfoPath();

      if (!hostSection.includes("SAGEMAKER_LOCAL_SERVER_FILE_PATH")) {
        outputChannel.appendLine(
          "⚠️  Found issue: Missing SAGEMAKER_LOCAL_SERVER_FILE_PATH"
        );
        // Add environment variable to ProxyCommand
        fixedSection = fixedSection.replace(
          /(ProxyCommand\s+)(.+)/,
          `$1powershell.exe -NoProfile -Command "$env:SAGEMAKER_LOCAL_SERVER_FILE_PATH='${serverInfoPath}'; & '$2' %h"`
        );
        needsFix = true;
      }

      // Fix 3: Add timeout and keepalive settings if missing
      if (!hostSection.includes("ServerAliveInterval")) {
        outputChannel.appendLine(
          "⚠️  Adding connection keepalive settings..."
        );
        // Add after StrictHostKeyChecking or before ProxyCommand
        if (fixedSection.includes("StrictHostKeyChecking")) {
          fixedSection = fixedSection.replace(
            /(StrictHostKeyChecking\s+\S+\s*\n)/,
            `$1    ServerAliveInterval 60\n    ServerAliveCountMax 3\n    ConnectTimeout 30\n`
          );
        } else {
          // Add before ProxyCommand
          fixedSection = fixedSection.replace(
            /(ProxyCommand\s+)/,
            `    ServerAliveInterval 60\n    ServerAliveCountMax 3\n    ConnectTimeout 30\n$1`
          );
        }
        needsFix = true;
      }

      if (needsFix) {
        // Create backup
        const backupPath = `${sshConfigPath}.backup.${Date.now()}`;
        fs.copyFileSync(sshConfigPath, backupPath);
        outputChannel.appendLine(`✅ Created backup: ${backupPath}`);

        // Replace the section
        configContent = configContent.replace(
          /Host sagemaker[\s\S]*?(?=Host |$)/i,
          fixedSection
        );
        fs.writeFileSync(sshConfigPath, configContent, "utf8");

        outputChannel.appendLine("✅ SSH config fixed!");
        vscode.window.showInformationMessage("SSH config fixed successfully!");
      } else {
        outputChannel.appendLine("✅ SSH config looks good - no fixes needed");
        vscode.window.showInformationMessage("SSH config is already correct.");
      }
    } catch (error: any) {
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Fix failed: ${error.message}`);
    }
  }
}

