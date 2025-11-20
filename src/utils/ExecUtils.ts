/**
 * Utility functions for executing shell commands
 */
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

const execAsync = promisify(exec);

export class ExecUtils {
  // Cache for SSH path to avoid repeated lookups
  private static sshPathCache: string | null = null;

  /**
   * Find the SSH executable path on Windows
   * On Windows, SSH might be in System32 or Program Files
   */
  private static async findSSHPath(): Promise<string> {
    if (this.sshPathCache) {
      return this.sshPathCache;
    }

    // Common SSH locations on Windows
    const possiblePaths = [
      "C:\\Windows\\System32\\OpenSSH\\ssh.exe", // Most common on Windows 10/11
      "C:\\Program Files\\OpenSSH\\ssh.exe",
      "C:\\Program Files\\Git\\usr\\bin\\ssh.exe",
      "ssh", // Try direct command last (if in PATH)
    ];

    for (const sshPath of possiblePaths) {
      try {
        if (sshPath === "ssh") {
          // Try to find it using 'where' command with cmd.exe explicitly
          // Use exec directly with proper options for Windows
          const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            exec(`cmd /c where ssh 2>&1`, { shell: "cmd.exe" }, (error: any, stdout: string, stderr: string) => {
              if (error && !stdout) {
                reject(error);
              } else {
                resolve({ stdout, stderr });
              }
            });
          });
          const path = stdout.trim().split("\n")[0];
          if (path && !path.includes("not found") && !path.includes("Could not find") && path.endsWith(".exe")) {
            this.sshPathCache = path;
            return path;
          }
        } else {
          // Test if the file exists using fs (more reliable than exec)
          if (fs.existsSync(sshPath)) {
            this.sshPathCache = sshPath;
            return sshPath;
          }
        }
      } catch {
        // Continue to next path
        continue;
      }
    }

    // Fallback to just "ssh" and hope it's in PATH
    // This will work if SSH is properly installed and in PATH
    this.sshPathCache = "ssh";
    return "ssh";
  }

  /**
   * Execute a shell command and return the result
   * On Windows, automatically resolves SSH path if needed
   */
  static async execute(command: string): Promise<{ stdout: string; stderr: string }> {
    // Check if this is an SSH command and we're on Windows
    if (process.platform === "win32" && command.trim().startsWith("ssh ")) {
      try {
        const sshPath = await this.findSSHPath();
        // Replace 'ssh' with the full path
        const fixedCommand = command.replace(/^ssh\s+/, `${sshPath} `);
        return await execAsync(fixedCommand);
      } catch (error: any) {
        // If finding SSH path fails, try original command
        // This will provide a better error message
        try {
          return await execAsync(command);
        } catch (execError: any) {
          // Preserve stdout and stderr from the original error for better debugging
          // Node.js exec includes stdout/stderr in the error object when command fails
          const enhancedError: any = new Error(
            `SSH command failed. SSH might not be installed or in PATH. ` +
            `Original error: ${execError.message}`
          );
          enhancedError.stdout = execError.stdout || "";
          enhancedError.stderr = execError.stderr || "";
          enhancedError.code = execError.code;
          throw enhancedError;
        }
      }
    }
    
    try {
      return await execAsync(command);
    } catch (error: any) {
      // Enhance error with stdout/stderr for better debugging
      // Node.js exec includes stdout/stderr in the error object when command fails
      const enhancedError: any = new Error(error.message || String(error));
      enhancedError.stdout = error.stdout || "";
      enhancedError.stderr = error.stderr || "";
      enhancedError.code = error.code;
      throw enhancedError;
    }
  }

  /**
   * Check if a process is running by PID (Windows)
   */
  static async isProcessRunning(pid: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" 2>&1`);
      return stdout.includes(`${pid}`) && !stdout.includes("INFO: No tasks");
    } catch {
      return false;
    }
  }

  /**
   * Test if a port is accessible (Windows)
   */
  static async isPortAccessible(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `powershell -Command "Test-NetConnection -ComputerName localhost -Port ${port} -InformationLevel Quiet" 2>&1`
      );
      return stdout.includes("True") || stdout.trim() === "True";
    } catch {
      return false;
    }
  }

  /**
   * Find the path to a command in PATH
   */
  static async findCommand(command: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`where ${command} 2>&1`);
      const path = stdout.trim().split("\n")[0];
      if (path && !path.includes("not found") && !path.includes("Could not find")) {
        return path;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Test if an HTTP endpoint is responding (not just if port is open)
   * This checks if the server is actually ready to handle requests
   */
  static async isHttpEndpointReady(port: number, maxRetries: number = 5, delayMs: number = 2000): Promise<boolean> {
    // Try multiple endpoints that the SageMaker local server might have
    const endpointsToTry = ['/health', '/status', '/', '/api/health'];
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      for (const endpoint of endpointsToTry) {
        try {
          // Try to make a simple HTTP request to the server
          // Even if it returns an error (404, 500, etc.), if we get a response 
          // (not connection refused), the server HTTP stack is ready
          const { stdout, stderr } = await execAsync(
            `powershell -Command "$ErrorActionPreference = 'Stop'; try { $response = Invoke-WebRequest -Uri 'http://localhost:${port}${endpoint}' -Method Get -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop; Write-Output 'READY' } catch { if ($_.Exception.Response -or $_.Exception.StatusCode) { Write-Output 'READY' } elseif ($_.Exception.Message -match 'connection.*refused' -or $_.Exception.Message -match 'No connection') { Write-Output 'NOT_READY' } else { Write-Output 'READY' } }" 2>&1`
          );
          
          if (stdout.includes("READY") || stderr.includes("READY")) {
            return true;
          }
        } catch (error: any) {
          // Check if the error output indicates the server responded
          const errorStr = error.toString().toLowerCase();
          if (errorStr.includes("ready") || 
              (errorStr.includes("http") && !errorStr.includes("connection refused") && !errorStr.includes("no connection"))) {
            return true;
          }
        }
      }
      
      // Wait before next attempt (except on last attempt)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return false;
  }

  /**
   * Check if the Remote-SSH server is partially installed on the remote host
   * This uses SSH to check for server directories and processes
   * @param sshHost The SSH host alias (e.g., "sagemaker")
   * @returns Object with installation status information
   */
  static async checkRemoteServerInstallation(sshHost: string = "sagemaker"): Promise<{
    partiallyInstalled: boolean;
    serverDirExists: boolean;
    serverProcessRunning: boolean;
    details: string;
  }> {
    try {
      // Check for server directories (both Cursor and VS Code)
      const checkDirsCommand = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new ${sshHost} "test -d ~/.cursor-server && echo 'CURSOR_DIR_EXISTS' || echo 'CURSOR_DIR_NOT_FOUND'; test -d ~/.vscode-server && echo 'VSCODE_DIR_EXISTS' || echo 'VSCODE_DIR_NOT_FOUND'; ps aux | grep -E '(cursor-server|vscode-server)' | grep -v grep | head -1 && echo 'SERVER_PROCESS_RUNNING' || echo 'SERVER_PROCESS_NOT_RUNNING'" 2>&1`;
      
      const { stdout, stderr } = await execAsync(checkDirsCommand);
      const output = stdout + stderr;
      
      const cursorDirExists = output.includes("CURSOR_DIR_EXISTS");
      const vscodeDirExists = output.includes("VSCODE_DIR_EXISTS");
      const serverProcessRunning = output.includes("SERVER_PROCESS_RUNNING");
      
      const serverDirExists = cursorDirExists || vscodeDirExists;
      const partiallyInstalled = serverDirExists || serverProcessRunning;
      
      let details = "";
      if (cursorDirExists) {
        details += "Cursor server directory exists (~/.cursor-server). ";
      }
      if (vscodeDirExists) {
        details += "VS Code server directory exists (~/.vscode-server). ";
      }
      if (serverProcessRunning) {
        details += "Server process is running. ";
      }
      if (!partiallyInstalled) {
        details = "No server installation detected on remote host.";
      }
      
      return {
        partiallyInstalled,
        serverDirExists,
        serverProcessRunning,
        details: details.trim(),
      };
    } catch (error: any) {
      // If SSH fails, we can't check - assume not installed
      // Provide more detailed error information for debugging
      let errorDetails = error.message || "Unknown error";
      
      // Extract meaningful error information
      const stdout = (error.stdout || "").toString().trim();
      const stderr = (error.stderr || "").toString().trim();
      
      // Prefer stderr for SSH errors (SSH typically outputs errors to stderr)
      if (stderr && stderr.length > 0) {
        // Extract meaningful error lines (filter out debug messages)
        const stderrLines = stderr.split('\n')
          .filter((l: string) => {
            const trimmed = l.trim();
            return trimmed && 
                   !trimmed.includes('debug1:') && 
                   !trimmed.includes('Permission denied') &&
                   (trimmed.includes('timeout') ||
                    trimmed.includes('refused') ||
                    trimmed.includes('error') ||
                    trimmed.includes('Error') ||
                    trimmed.includes('failed') ||
                    trimmed.includes('Connection') ||
                    trimmed.length > 30); // Show substantial error lines
          });
        
        if (stderrLines.length > 0) {
          // Get the last 2-3 meaningful error lines
          const meaningfulErrors = stderrLines.slice(-3);
          errorDetails = meaningfulErrors.join('; ');
          // Limit total length but keep it informative
          if (errorDetails.length > 200) {
            errorDetails = errorDetails.substring(0, 200) + '...';
          }
        } else {
          // If filtering removed everything, show raw stderr (limited)
          errorDetails = stderr.length > 150 
            ? `${error.message} - ${stderr.substring(0, 150)}...`
            : `${error.message} - ${stderr}`;
        }
      } else if (stdout && stdout.length > 0) {
        // Sometimes errors are in stdout (especially with 2>&1 redirection)
        const stdoutLines = stdout.split('\n')
          .filter((l: string) => {
            const trimmed = l.trim();
            return trimmed && 
                   (trimmed.includes('timeout') ||
                    trimmed.includes('refused') ||
                    trimmed.includes('error') ||
                    trimmed.includes('Error') ||
                    trimmed.includes('failed') ||
                    trimmed.includes('Connection') ||
                    trimmed.length > 30);
          });
        
        if (stdoutLines.length > 0) {
          const meaningfulErrors = stdoutLines.slice(-3);
          errorDetails = meaningfulErrors.join('; ');
          if (errorDetails.length > 200) {
            errorDetails = errorDetails.substring(0, 200) + '...';
          }
        } else {
          errorDetails = stdout.length > 150 
            ? `${error.message} - ${stdout.substring(0, 150)}...`
            : `${error.message} - ${stdout}`;
        }
      }
      
      return {
        partiallyInstalled: false,
        serverDirExists: false,
        serverProcessRunning: false,
        details: `Could not check remote server installation: ${errorDetails}`,
      };
    }
  }
}

