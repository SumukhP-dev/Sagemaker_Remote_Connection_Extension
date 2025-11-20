/**
 * Service for managing the local SageMaker server
 */
import * as path from "path";
import * as fs from "fs";
import { ExecUtils } from "../utils/ExecUtils";
import { ServerStatus } from "../types";

export class ServerManager {
  /**
   * Get the path to the server info file
   */
  static getServerInfoPath(): string {
    return path.join(
      process.env.APPDATA || "",
      "Cursor",
      "User",
      "globalStorage",
      "amazonwebservices.aws-toolkit-vscode",
      "sagemaker-local-server-info.json"
    );
  }

  /**
   * Get the path to the PowerShell connection script
   */
  static getConnectionScriptPath(): string {
    return path.join(
      process.env.APPDATA || "",
      "Cursor",
      "User",
      "globalStorage",
      "amazonwebservices.aws-toolkit-vscode",
      "sagemaker_connect.ps1"
    );
  }

  /**
   * Get the directory path for AWS Toolkit global storage
   */
  static getAwsToolkitStorageDir(): string {
    return path.join(
      process.env.APPDATA || "",
      "Cursor",
      "User",
      "globalStorage",
      "amazonwebservices.aws-toolkit-vscode"
    );
  }

  /**
   * Ensure the AWS Toolkit storage directory exists
   */
  static ensureStorageDirExists(): void {
    const dir = this.getAwsToolkitStorageDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Check if the local server is running and accessible
   */
  static async checkServerStatus(): Promise<ServerStatus> {
    const serverInfoPath = this.getServerInfoPath();

    try {
      if (fs.existsSync(serverInfoPath)) {
        const info = JSON.parse(fs.readFileSync(serverInfoPath, "utf8"));
        const pid = info.pid;
        const port = info.port;

        // Check if the process is actually running
        let processRunning = false;
        if (pid) {
          processRunning = await ExecUtils.isProcessRunning(pid);
        }

        // Try to verify the server is accessible on the port
        let serverAccessible = false;
        if (port) {
          serverAccessible = await ExecUtils.isPortAccessible(port);
        }

        return {
          running: processRunning && serverAccessible,
          pid,
          port,
          accessible: serverAccessible,
          error: !processRunning
            ? "Process not running"
            : !serverAccessible
            ? "Server not accessible on port"
            : undefined,
        };
      }
    } catch (error: any) {
      return { running: false, error: error.message };
    }

    return { running: false, error: "Server info file not found" };
  }

  /**
   * Check if the server HTTP endpoint is ready to handle requests
   * This is more thorough than just checking if the port is open
   */
  static async checkServerEndpointReady(port: number, maxRetries: number = 10, delayMs: number = 2000): Promise<boolean> {
    return await ExecUtils.isHttpEndpointReady(port, maxRetries, delayMs);
  }

  /**
   * Check if the PowerShell connection script exists
   */
  static connectionScriptExists(): boolean {
    return fs.existsSync(this.getConnectionScriptPath());
  }
}

