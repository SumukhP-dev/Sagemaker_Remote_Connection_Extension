/**
 * Main entry point for the SageMaker Remote Connection extension
 */
import * as vscode from "vscode";
import { ConnectionManager } from "./services/ConnectionManager";
import { StatusService } from "./services/StatusService";
import { SetupService } from "./services/SetupService";
import { ServerStartService } from "./services/ServerStartService";
import { SSHConfigManager } from "./services/SSHConfigManager";
import { DiagnosticsService } from "./services/DiagnosticsService";
import { FixService } from "./services/FixService";
import { QuickStartService } from "./services/QuickStartService";
import { CleanupService } from "./services/CleanupService";
import { MonitorService } from "./services/MonitorService";

export function activate(context: vscode.ExtensionContext) {
  console.log("SageMaker Remote Connection extension is now active!");

  // Register commands
  const connectCommand = vscode.commands.registerCommand(
    "sagemaker-remote.connect",
    async () => {
      await ConnectionManager.connectToSageMaker(context);
    }
  );

  const checkStatusCommand = vscode.commands.registerCommand(
    "sagemaker-remote.checkStatus",
    async () => {
      await StatusService.checkConnectionStatus();
    }
  );

  const debugSSHConfigCommand = vscode.commands.registerCommand(
    "sagemaker-remote.debugSSHConfig",
    async () => {
      await SSHConfigManager.debugSSHConfig();
    }
  );

  const setupCommand = vscode.commands.registerCommand(
    "sagemaker-remote.setup",
    async () => {
      await SetupService.setupSageMakerConnection(context);
    }
  );

  const startServerCommand = vscode.commands.registerCommand(
    "sagemaker-remote.startServer",
    async () => {
      await ServerStartService.startLocalServer();
    }
  );

  const diagnoseCommand = vscode.commands.registerCommand(
    "sagemaker-remote.diagnose",
    async () => {
      await DiagnosticsService.diagnoseConnection();
    }
  );

  const fixArnConversionCommand = vscode.commands.registerCommand(
    "sagemaker-remote.fixArnConversion",
    async () => {
      await FixService.fixArnConversion();
    }
  );

  const fixCodeWrapperCommand = vscode.commands.registerCommand(
    "sagemaker-remote.fixCodeWrapper",
    async () => {
      await FixService.fixCodeWrapper();
    }
  );

  const fixSshConfigCommand = vscode.commands.registerCommand(
    "sagemaker-remote.fixSshConfig",
    async () => {
      await FixService.fixSSHConfig();
    }
  );

  const fixPowerShellDebugOutputCommand = vscode.commands.registerCommand(
    "sagemaker-remote.fixPowerShellDebugOutput",
    async () => {
      await FixService.fixPowerShellDebugOutput();
    }
  );

  const applyAllFixesCommand = vscode.commands.registerCommand(
    "sagemaker-remote.applyAllFixes",
    async () => {
      await FixService.applyAllFixes();
    }
  );

  const quickStartCommand = vscode.commands.registerCommand(
    "sagemaker-remote.quickStart",
    async () => {
      await QuickStartService.quickStart(context);
    }
  );

  const cleanupRemoteServerCommand = vscode.commands.registerCommand(
    "sagemaker-remote.cleanupRemoteServer",
    async () => {
      await CleanupService.cleanupRemoteServer("sagemaker");
    }
  );

  const monitorRemoteServerCommand = vscode.commands.registerCommand(
    "sagemaker-remote.monitorRemoteServer",
    async () => {
      await MonitorService.monitorRemoteServer("sagemaker");
    }
  );

  const quickStatusCheckCommand = vscode.commands.registerCommand(
    "sagemaker-remote.quickStatusCheck",
    async () => {
      await MonitorService.quickStatusCheck("sagemaker");
    }
  );

  context.subscriptions.push(
    connectCommand,
    checkStatusCommand,
    setupCommand,
    debugSSHConfigCommand,
    startServerCommand,
    diagnoseCommand,
    fixArnConversionCommand,
    fixCodeWrapperCommand,
    fixSshConfigCommand,
    fixPowerShellDebugOutputCommand,
    applyAllFixesCommand,
    quickStartCommand,
    cleanupRemoteServerCommand,
    monitorRemoteServerCommand,
    quickStatusCheckCommand
  );
}

export function deactivate() {
  // Clean up any active monitoring intervals
  MonitorService.stopAllMonitoring();
}
