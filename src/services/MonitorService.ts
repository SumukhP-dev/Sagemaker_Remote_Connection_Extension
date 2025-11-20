/**
 * Service for monitoring active SSH connections and remote server installation
 */
import * as vscode from "vscode";
import { ExecUtils } from "../utils/ExecUtils";
import { ServerManager } from "./ServerManager";

export class MonitorService {
  // Store active monitoring intervals so they can be cancelled
  private static activeIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Monitor remote server installation status in real-time
   * Useful for debugging active connections
   */
  static async monitorRemoteServer(sshHost: string = "sagemaker"): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("SageMaker Monitor");
    outputChannel.show();

    // Cancel any existing monitoring for this host
    const intervalKey = `monitor-${sshHost}`;
    if (this.activeIntervals.has(intervalKey)) {
      clearInterval(this.activeIntervals.get(intervalKey)!);
      this.activeIntervals.delete(intervalKey);
      outputChannel.appendLine("⚠️  Stopped previous monitoring session");
      outputChannel.appendLine("");
    }

    outputChannel.appendLine("========================================");
    outputChannel.appendLine("Monitoring Remote Server Installation");
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("");
    outputChannel.appendLine(`SSH Host: ${sshHost}`);
    outputChannel.appendLine("This will check the remote host every 5 seconds.");
    outputChannel.appendLine("Close this panel to stop monitoring.");
    outputChannel.appendLine("");
    outputChannel.appendLine("💡 Tip: Also check the 'Remote-SSH' output panel for detailed");
    outputChannel.appendLine("   installation logs and connection status.");
    outputChannel.appendLine("");

    // Initial status check
    outputChannel.appendLine("🔍 Initial status check...");
    try {
      const initialServerInfo = await ServerManager.checkServerStatus();
      if (initialServerInfo.running) {
        outputChannel.appendLine(`   ✅ Local server: Running (PID: ${initialServerInfo.pid}, Port: ${initialServerInfo.port})`);
      } else {
        outputChannel.appendLine(`   ❌ Local server: Not running`);
        if (initialServerInfo.error) {
          outputChannel.appendLine(`   ⚠️  Error: ${initialServerInfo.error}`);
        }
      }

      // Test SSH connectivity
      outputChannel.appendLine(`   🔍 Testing SSH connection to ${sshHost}...`);
      try {
        // Use verbose mode to get more details, redirect stderr to stdout to capture all output
        const testCommand = `ssh -v -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new ${sshHost} "echo 'SSH_CONNECTION_OK'" 2>&1`;
        const { stdout, stderr } = await ExecUtils.execute(testCommand);
        const allOutput = (stdout + stderr).trim();
        
        if (allOutput.includes("SSH_CONNECTION_OK")) {
          outputChannel.appendLine(`   ✅ SSH connection test successful`);
        } else {
          // Show the actual SSH output for debugging
          const outputLines = allOutput.split('\n').filter(l => l.trim()).slice(-5); // Last 5 lines
          if (outputLines.length > 0) {
            outputChannel.appendLine(`   ⚠️  SSH connection test unclear:`);
            outputLines.forEach(line => {
              outputChannel.appendLine(`      ${line.substring(0, 120)}`);
            });
          } else {
            outputChannel.appendLine(`   ⚠️  SSH connection test unclear - no output received`);
          }
        }
      } catch (sshTestError: any) {
        let errorMsg = sshTestError.message || String(sshTestError);
        
        // Extract stderr if available (SSH errors go to stderr)
        // Node.js exec error has stdout/stderr as properties
        const stderr = (sshTestError.stderr || "").toString().trim();
        const stdout = (sshTestError.stdout || "").toString().trim();
        
        // Also check if error message itself contains useful info
        const fullErrorStr = JSON.stringify(sshTestError, Object.getOwnPropertyNames(sshTestError));
        
        // SSH errors typically go to stderr, so prioritize that
        if (stderr && stderr.length > 0) {
          // Filter out verbose debug messages and show actual errors
          const stderrLines = stderr.split('\n')
            .filter((l: string) => {
              const trimmed = l.trim();
              return trimmed && 
                     !trimmed.includes('debug1:') && 
                     !trimmed.includes('OpenSSH') &&
                     (trimmed.includes('error') || 
                      trimmed.includes('Error') || 
                      trimmed.includes('failed') || 
                      trimmed.includes('timeout') ||
                      trimmed.includes('refused') ||
                      trimmed.includes('Permission') ||
                      trimmed.length > 20); // Show substantial lines
            })
            .slice(-5); // Last 5 meaningful lines
          
          if (stderrLines.length > 0) {
            outputChannel.appendLine(`   ❌ SSH connection test failed:`);
            stderrLines.forEach((line: string) => {
              outputChannel.appendLine(`      ${line.substring(0, 150)}`);
            });
          } else {
            // Show raw stderr if filtering removed everything
            outputChannel.appendLine(`   ❌ SSH connection test failed: ${errorMsg}`);
            if (stderr.length < 300) {
              outputChannel.appendLine(`      Error output: ${stderr}`);
            } else {
              outputChannel.appendLine(`      Error output (first 300 chars): ${stderr.substring(0, 300)}...`);
            }
          }
        } else if (stdout && stdout.length > 0) {
          // Sometimes errors are in stdout (especially with 2>&1 redirection)
          const stdoutLines = stdout.split('\n')
            .filter((l: string) => {
              const trimmed = l.trim();
              return trimmed && 
                     (trimmed.includes('error') || 
                      trimmed.includes('Error') || 
                      trimmed.includes('failed') || 
                      trimmed.includes('timeout') ||
                      trimmed.includes('refused') ||
                      trimmed.length > 20);
            })
            .slice(-5);
          
          if (stdoutLines.length > 0) {
            outputChannel.appendLine(`   ❌ SSH connection test failed:`);
            stdoutLines.forEach((line: string) => {
              outputChannel.appendLine(`      ${line.substring(0, 150)}`);
            });
          } else {
            outputChannel.appendLine(`   ❌ SSH connection test failed: ${errorMsg}`);
            if (stdout.length < 300) {
              outputChannel.appendLine(`      Output: ${stdout}`);
            } else {
              outputChannel.appendLine(`      Output (first 300 chars): ${stdout.substring(0, 300)}...`);
            }
          }
        } else {
          // No stderr/stdout, show what we have
          outputChannel.appendLine(`   ❌ SSH connection test failed: ${errorMsg}`);
          
          // Debug: show error code if available
          if (sshTestError.code !== undefined) {
            outputChannel.appendLine(`      Exit code: ${sshTestError.code}`);
          }
          
          // If error message is just "Command failed", try to extract more info
          if (errorMsg.includes("Command failed") && fullErrorStr.length < 500) {
            outputChannel.appendLine(`      Full error details: ${fullErrorStr.substring(0, 300)}`);
          }
        }
        
        // Check if it's a "command not found" error
        if (errorMsg.includes("command not found") || errorMsg.includes("not recognized") || errorMsg.includes("not installed")) {
          outputChannel.appendLine(`   💡 To fix this:`);
          outputChannel.appendLine(`      1. Install OpenSSH Client: Settings > Apps > Optional Features > OpenSSH Client`);
          outputChannel.appendLine(`      2. Or install Git for Windows (includes SSH)`);
          outputChannel.appendLine(`      3. Restart Cursor after installation`);
        } else if (stderr.includes("Connection timed out") || stderr.includes("Connection refused") || errorMsg.includes("timeout")) {
          outputChannel.appendLine(`   💡 Connection timeout - this may be normal if:`);
          outputChannel.appendLine(`      - The local server is starting up`);
          outputChannel.appendLine(`      - The ProxyCommand is still establishing connection`);
          outputChannel.appendLine(`      - Check if local server is running on port ${initialServerInfo.port || 'unknown'}`);
        } else {
          outputChannel.appendLine(`   💡 Check the Remote-SSH output panel for more details`);
        }
      }
    } catch (initError: any) {
      outputChannel.appendLine(`   ❌ Initial check error: ${initError.message}`);
    }
    outputChannel.appendLine("");
    outputChannel.appendLine("Starting continuous monitoring...");
    outputChannel.appendLine("");

    let checkCount = 0;
    const maxChecks = 60; // Monitor for up to 5 minutes (60 * 5 seconds)
    let isStopped = false;

    const intervalId = setInterval(async () => {
      if (isStopped) {
        return;
      }

      checkCount++;
      const timestamp = new Date().toLocaleTimeString();
      
      outputChannel.appendLine(`[${timestamp}] Check #${checkCount}:`);
      
      try {
        // Check local server status
        const serverInfo = await ServerManager.checkServerStatus();
        if (serverInfo.running) {
          outputChannel.appendLine(`   ✅ Local server: Running (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`);
        } else {
          outputChannel.appendLine(`   ❌ Local server: Not running`);
          if (serverInfo.error) {
            outputChannel.appendLine(`      Error: ${serverInfo.error}`);
          }
        }

        // Check remote server installation
        outputChannel.appendLine(`   🔍 Checking remote server installation...`);
        const remoteCheck = await ExecUtils.checkRemoteServerInstallation(sshHost);
        
        if (remoteCheck.partiallyInstalled) {
          outputChannel.appendLine(`   ⚠️  Remote server: ${remoteCheck.details}`);
          
          if (remoteCheck.serverProcessRunning) {
            outputChannel.appendLine(`   ✅ Server process is RUNNING on remote host!`);
            outputChannel.appendLine(`   💡 This means the installation may have succeeded.`);
            outputChannel.appendLine(`   💡 Try refreshing the Remote-SSH window or reconnecting.`);
          } else if (remoteCheck.serverDirExists) {
            outputChannel.appendLine(`   ⚠️  Server directory exists but no process running`);
            outputChannel.appendLine(`   💡 Installation may be in progress or failed.`);
          }
        } else {
          outputChannel.appendLine(`   ℹ️  Remote server: No installation detected yet`);
          // Show the actual error details if available
          if (remoteCheck.details) {
            if (remoteCheck.details.includes("Could not check")) {
              // Show the actual SSH error
              const errorDetail = remoteCheck.details.replace("Could not check remote server installation: ", "");
              if (errorDetail.length > 0 && errorDetail !== remoteCheck.details) {
                outputChannel.appendLine(`   ⚠️  SSH check error: ${errorDetail.substring(0, 150)}`);
              }
            } else {
              outputChannel.appendLine(`      ${remoteCheck.details}`);
            }
          }
          outputChannel.appendLine(`   💡 Installation is likely still in progress...`);
        }

        // Try to get more details about what's happening
        try {
          // Use a simpler command first to test connectivity
          const detailCommand = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new ${sshHost} "echo 'CONNECTION_TEST'; ls -la ~/.cursor-server ~/.vscode-server 2>&1 | head -5" 2>&1`;
          const { stdout, stderr } = await ExecUtils.execute(detailCommand);
          const detailOutput = (stdout + stderr).trim();
          
          if (detailOutput && !detailOutput.includes("No such file") && !detailOutput.includes("Connection refused") && !detailOutput.includes("timeout")) {
            const lines = detailOutput.split('\n').filter(l => l.trim()).slice(0, 5);
            if (lines.length > 0) {
              outputChannel.appendLine(`   📋 Details:`);
              lines.forEach(line => {
                if (line.trim() && !line.includes('---')) {
                  outputChannel.appendLine(`      ${line.substring(0, 80)}`);
                }
              });
            }
          } else if (detailOutput) {
            // Log SSH errors for debugging
            const errorLines = detailOutput.split('\n').filter(l => 
              l.trim() && 
              (l.includes("error") || l.includes("Error") || l.includes("failed") || l.includes("Failed"))
            );
            if (errorLines.length > 0) {
              outputChannel.appendLine(`   ⚠️  SSH detail check issues:`);
              errorLines.slice(0, 2).forEach(line => {
                outputChannel.appendLine(`      ${line.substring(0, 80)}`);
              });
            }
          }
        } catch (detailError: any) {
          // Log detail errors with full information for debugging
          let errorMsg = detailError.message || String(detailError);
          
          // Try to extract more information from the error
          if (detailError.stdout) {
            const stdoutStr = String(detailError.stdout).trim();
            if (stdoutStr && stdoutStr.length > 0) {
              errorMsg += `\n      stdout: ${stdoutStr.substring(0, 200)}`;
            }
          }
          if (detailError.stderr) {
            const stderrStr = String(detailError.stderr).trim();
            if (stderrStr && stderrStr.length > 0) {
              errorMsg += `\n      stderr: ${stderrStr.substring(0, 200)}`;
            }
          }
          
          // Only show error if it's not a normal connection issue
          if (!errorMsg.includes("Connection refused") && !errorMsg.includes("timeout") && !errorMsg.includes("Connection timed out")) {
            // Show full error message (not truncated)
            const errorLines = errorMsg.split('\n').slice(0, 3);
            errorLines.forEach((line: string, idx: number) => {
              if (idx === 0) {
                outputChannel.appendLine(`   ⚠️  Detail check error: ${line.substring(0, 150)}`);
              } else {
                outputChannel.appendLine(`      ${line.substring(0, 150)}`);
              }
            });
          }
        }

        outputChannel.appendLine("");

        // Stop if we detect a running server process
        if (remoteCheck.serverProcessRunning) {
          isStopped = true;
          clearInterval(intervalId);
          this.activeIntervals.delete(intervalKey);
          
          outputChannel.appendLine("========================================");
          outputChannel.appendLine("✅ Server process detected on remote host!");
          outputChannel.appendLine("========================================");
          outputChannel.appendLine("");
          outputChannel.appendLine("The remote server appears to be running.");
          outputChannel.appendLine("If Remote-SSH still shows 'installing', try:");
          outputChannel.appendLine("  1. Refresh the Remote-SSH window");
          outputChannel.appendLine("  2. Close and reopen the connection");
          outputChannel.appendLine("  3. Check Remote-SSH output panel for errors");
          return;
        }

        // Stop after max checks
        if (checkCount >= maxChecks) {
          isStopped = true;
          clearInterval(intervalId);
          this.activeIntervals.delete(intervalKey);
          
          outputChannel.appendLine("========================================");
          outputChannel.appendLine("⏱️  Monitoring timeout reached");
          outputChannel.appendLine("========================================");
          outputChannel.appendLine("");
          outputChannel.appendLine("No server process detected after 5 minutes.");
          outputChannel.appendLine("The installation may have failed or is taking longer than expected.");
          outputChannel.appendLine("");
          outputChannel.appendLine("Next steps:");
          outputChannel.appendLine("  1. Check Remote-SSH output panel for error messages");
          outputChannel.appendLine("  2. Try running 'SageMaker: Clean Up Remote Server'");
          outputChannel.appendLine("  3. Check if the local server is still running");
          outputChannel.appendLine("  4. Try connecting again");
          return;
        }

      } catch (error: any) {
        outputChannel.appendLine(`   ❌ Error during check: ${error.message}`);
        if (error.stack) {
          outputChannel.appendLine(`   📋 Stack trace: ${error.stack.split('\n').slice(0, 3).join(' -> ')}`);
        }
        outputChannel.appendLine("");
        
        // If SSH is failing, the connection might not be established yet
        if (error.message.includes("Connection refused") || error.message.includes("timeout")) {
          outputChannel.appendLine(`   ℹ️  SSH connection not ready yet (this is normal during initial connection)`);
        }
        outputChannel.appendLine("");
      }
    }, 5000); // Check every 5 seconds

    // Store interval ID so it can be cleared if needed
    this.activeIntervals.set(intervalKey, intervalId);

    // Clean up when output channel is closed (if possible)
    // Note: VS Code doesn't provide a direct way to detect panel close,
    // but we can at least clean up on extension deactivation
  }

  /**
   * Stop monitoring for a specific host
   */
  static stopMonitoring(sshHost: string = "sagemaker"): void {
    const intervalKey = `monitor-${sshHost}`;
    if (this.activeIntervals.has(intervalKey)) {
      clearInterval(this.activeIntervals.get(intervalKey)!);
      this.activeIntervals.delete(intervalKey);
    }
  }

  /**
   * Stop all active monitoring
   */
  static stopAllMonitoring(): void {
    this.activeIntervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.activeIntervals.clear();
  }

  /**
   * Quick status check - single check of remote server
   */
  static async quickStatusCheck(sshHost: string = "sagemaker"): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("SageMaker Status");
    outputChannel.show();

    outputChannel.appendLine("========================================");
    outputChannel.appendLine("Quick Status Check");
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("");

    try {
      // Check local server
      const serverInfo = await ServerManager.checkServerStatus();
      outputChannel.appendLine("Local Server:");
      if (serverInfo.running) {
        outputChannel.appendLine(`   ✅ Running (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`);
      } else {
        outputChannel.appendLine(`   ❌ Not running`);
      }
      outputChannel.appendLine("");

      // Check remote server
      outputChannel.appendLine("Remote Server:");
      const remoteCheck = await ExecUtils.checkRemoteServerInstallation(sshHost);
      
      if (remoteCheck.partiallyInstalled) {
        outputChannel.appendLine(`   Status: ${remoteCheck.details}`);
        if (remoteCheck.serverProcessRunning) {
          outputChannel.appendLine(`   ✅ Server process is RUNNING`);
        } else if (remoteCheck.serverDirExists) {
          outputChannel.appendLine(`   ⚠️  Directory exists but no process running`);
        }
      } else {
        outputChannel.appendLine(`   Status: No installation detected`);
      }
      outputChannel.appendLine("");

      // Additional details
      try {
        const detailCommand = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new ${sshHost} "echo 'Home dir:'; pwd; echo '---'; echo 'Server dirs:'; ls -ld ~/.cursor-server ~/.vscode-server 2>&1 | head -2; echo '---'; echo 'Processes:'; ps aux | grep -E '(cursor-server|vscode-server)' | grep -v grep | head -2" 2>&1`;
        const { stdout, stderr } = await ExecUtils.execute(detailCommand);
        const detailOutput = stdout + stderr;
        
        if (detailOutput && !detailOutput.includes("Connection refused") && !detailOutput.includes("timeout")) {
          outputChannel.appendLine("Additional Details:");
          const lines = detailOutput.split('\n').filter(l => l.trim() && !l.includes('---'));
          lines.forEach(line => {
            if (line.trim()) {
              outputChannel.appendLine(`   ${line.substring(0, 100)}`);
            }
          });
        }
      } catch (detailError) {
        outputChannel.appendLine("   ℹ️  Could not get additional details (SSH may not be ready)");
      }

    } catch (error: any) {
      outputChannel.appendLine(`❌ Error: ${error.message}`);
    }

    outputChannel.appendLine("");
    outputChannel.appendLine("========================================");
    outputChannel.appendLine("Status Check Complete");
    outputChannel.appendLine("========================================");
  }
}

