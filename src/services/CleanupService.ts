/**
 * Service for cleaning up failed remote server installations
 */
import * as vscode from "vscode";
import { ExecUtils } from "../utils/ExecUtils";

export class CleanupService {
  /**
   * Clean up partially installed remote server
   */
  static async cleanupRemoteServer(sshHost: string = "sagemaker"): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("SageMaker Cleanup");
    outputChannel.show();

    outputChannel.appendLine("========================================");
    outputChannel.appendLine("Cleaning Up Remote Server Installation");
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("");

    try {
      // First check what's installed
      outputChannel.appendLine("Checking for existing server installation...");
      const check = await ExecUtils.checkRemoteServerInstallation(sshHost);
      
      if (!check.partiallyInstalled) {
        outputChannel.appendLine("✅ No server installation found - nothing to clean up");
        outputChannel.appendLine("");
        outputChannel.appendLine("The remote host is in a clean state.");
        return;
      }

      outputChannel.appendLine(`⚠️  Found partial installation: ${check.details}`);
      outputChannel.appendLine("");

      // Ask for confirmation
      const confirm = await vscode.window.showWarningMessage(
        `This will remove server directories on the remote host (${sshHost}).\n\n` +
        `Found: ${check.details}\n\n` +
        `Do you want to proceed?`,
        { modal: true },
        "Yes, Clean Up",
        "Cancel"
      );

      if (confirm !== "Yes, Clean Up") {
        outputChannel.appendLine("❌ Cleanup cancelled by user");
        return;
      }

      outputChannel.appendLine("Starting cleanup...");
      outputChannel.appendLine("");

      // Clean up server directories
      const cleanupCommand = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new ${sshHost} "rm -rf ~/.cursor-server ~/.vscode-server && echo 'CLEANUP_SUCCESS' || echo 'CLEANUP_FAILED'" 2>&1`;
      
      try {
        const { stdout, stderr } = await ExecUtils.execute(cleanupCommand);
        const output = stdout + stderr;

        if (output.includes("CLEANUP_SUCCESS")) {
          outputChannel.appendLine("✅ Successfully cleaned up remote server directories");
          outputChannel.appendLine("");
          outputChannel.appendLine("The remote host is now in a clean state.");
          outputChannel.appendLine("You can try connecting again via Remote-SSH.");
          
          vscode.window.showInformationMessage(
            "Remote server cleanup completed successfully"
          );
        } else if (output.includes("CLEANUP_FAILED")) {
          outputChannel.appendLine("⚠️  Cleanup command executed but may have failed");
          outputChannel.appendLine(`Output: ${output}`);
          outputChannel.appendLine("");
          outputChannel.appendLine("You may need to manually clean up:");
          outputChannel.appendLine(`  ssh ${sshHost} 'rm -rf ~/.cursor-server ~/.vscode-server'`);
        } else {
          // Check if SSH connection failed
          if (output.includes("Connection refused") || output.includes("timeout") || output.includes("Could not resolve")) {
            outputChannel.appendLine("❌ Could not connect to remote host");
            outputChannel.appendLine(`Error: ${output}`);
            outputChannel.appendLine("");
            outputChannel.appendLine("Make sure:");
            outputChannel.appendLine("  1. The local SageMaker server is running");
            outputChannel.appendLine("  2. The SSH config is properly configured");
            outputChannel.appendLine("  3. The instance is accessible");
          } else {
            outputChannel.appendLine("⚠️  Unexpected output from cleanup command:");
            outputChannel.appendLine(output);
            outputChannel.appendLine("");
            outputChannel.appendLine("You may need to manually clean up:");
            outputChannel.appendLine(`  ssh ${sshHost} 'rm -rf ~/.cursor-server ~/.vscode-server'`);
          }
        }
      } catch (error: any) {
        outputChannel.appendLine(`❌ Cleanup failed: ${error.message}`);
        outputChannel.appendLine("");
        outputChannel.appendLine("You can try manually cleaning up:");
        outputChannel.appendLine(`  ssh ${sshHost} 'rm -rf ~/.cursor-server ~/.vscode-server'`);
        
        vscode.window.showErrorMessage(
          `Failed to clean up remote server: ${error.message}`
        );
      }
    } catch (error: any) {
      outputChannel.appendLine(`❌ Error during cleanup: ${error.message}`);
      vscode.window.showErrorMessage(`Cleanup error: ${error.message}`);
    }

    outputChannel.appendLine("");
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("Cleanup Complete");
    outputChannel.appendLine("========================================");
  }
}

