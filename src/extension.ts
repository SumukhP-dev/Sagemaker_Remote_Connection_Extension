import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function activate(context: vscode.ExtensionContext) {
    console.log('SageMaker Remote Connection extension is now active!');

    // Register commands
    const connectCommand = vscode.commands.registerCommand('sagemaker-remote.connect', async () => {
        await connectToSageMaker(context);
    });

    const checkStatusCommand = vscode.commands.registerCommand('sagemaker-remote.checkStatus', async () => {
        await checkConnectionStatus();
    });

    const setupCommand = vscode.commands.registerCommand('sagemaker-remote.setup', async () => {
        await setupSageMakerConnection(context);
    });

    context.subscriptions.push(connectCommand, checkStatusCommand, setupCommand);
}

async function connectToSageMaker(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('SageMaker Remote');
    outputChannel.show();

    try {
        outputChannel.appendLine('Connecting to SageMaker...');
        
        // Check prerequisites
        const checks = await checkPrerequisites();
        if (!checks.allPassed) {
            vscode.window.showErrorMessage(`Prerequisites not met: ${checks.errors.join(', ')}`);
            return;
        }

        // Get SSH host alias from config
        const config = vscode.workspace.getConfiguration('sagemakerRemote');
        const sshHost = config.get<string>('sshHostAlias', 'sagemaker');

        outputChannel.appendLine(`Using SSH host: ${sshHost}`);

        // Trigger Remote-SSH connection
        await vscode.commands.executeCommand('remote-ssh.connect', sshHost);
        
        outputChannel.appendLine('Connection initiated. Check Remote-SSH output for details.');
        vscode.window.showInformationMessage('Connecting to SageMaker via Remote-SSH...');
    } catch (error: any) {
        const message = error.message || 'Unknown error';
        outputChannel.appendLine(`Error: ${message}`);
        vscode.window.showErrorMessage(`Failed to connect: ${message}`);
    }
}

async function checkConnectionStatus() {
    const outputChannel = vscode.window.createOutputChannel('SageMaker Status');
    outputChannel.show();

    try {
        outputChannel.appendLine('Checking SageMaker connection status...\n');

        // Check prerequisites
        const checks = await checkPrerequisites();
        
        outputChannel.appendLine('Prerequisites:');
        outputChannel.appendLine(`  AWS CLI: ${checks.awsCli ? '✅ Installed' : '❌ Not found'}`);
        outputChannel.appendLine(`  Session Manager Plugin: ${checks.sessionManagerPlugin ? '✅ Installed' : '❌ Not found'}`);
        outputChannel.appendLine(`  Remote-SSH Extension: ${checks.remoteSSH ? '✅ Installed' : '❌ Not found'}`);
        outputChannel.appendLine(`  SSH Config: ${checks.sshConfig ? '✅ Configured' : '❌ Not configured'}`);
        outputChannel.appendLine(`  AWS Toolkit: ${checks.awsToolkit ? '✅ Installed' : '❌ Not found'}`);

        if (!checks.allPassed) {
            outputChannel.appendLine('\n❌ Some prerequisites are missing.');
            outputChannel.appendLine('Run "SageMaker: Setup SageMaker Connection" to fix issues.');
        } else {
            outputChannel.appendLine('\n✅ All prerequisites met!');
        }

        // Check if server is running
        const serverInfo = await checkServerStatus();
        if (serverInfo.running) {
            outputChannel.appendLine(`\n✅ Local server is running (PID: ${serverInfo.pid}, Port: ${serverInfo.port})`);
        } else {
            outputChannel.appendLine('\n⚠️  Local server is not running.');
            outputChannel.appendLine('Start it via AWS Toolkit: Right-click Space → "Open Remote Connection"');
        }

    } catch (error: any) {
        outputChannel.appendLine(`Error: ${error.message}`);
    }
}

async function setupSageMakerConnection(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('SageMaker Setup');
    outputChannel.show();

    try {
        outputChannel.appendLine('Setting up SageMaker connection...\n');

        // Check and install prerequisites
        const checks = await checkPrerequisites();

        if (!checks.awsCli) {
            outputChannel.appendLine('❌ AWS CLI not found. Please install from: https://aws.amazon.com/cli/');
            vscode.window.showErrorMessage('AWS CLI not found. Please install it first.');
            return;
        }

        if (!checks.sessionManagerPlugin) {
            outputChannel.appendLine('Installing Session Manager Plugin...');
            await installSessionManagerPlugin();
            outputChannel.appendLine('✅ Session Manager Plugin installed');
        }

        if (!checks.remoteSSH) {
            outputChannel.appendLine('❌ Remote-SSH extension not found. Please install it from the marketplace.');
            vscode.window.showErrorMessage('Please install the Remote-SSH extension first.');
            return;
        }

        // Setup SSH config
        if (!checks.sshConfig) {
            outputChannel.appendLine('Setting up SSH config...');
            await setupSSHConfig();
            outputChannel.appendLine('✅ SSH config setup complete');
        }

        outputChannel.appendLine('\n✅ Setup complete!');
        vscode.window.showInformationMessage('SageMaker connection setup complete!');

    } catch (error: any) {
        outputChannel.appendLine(`Error: ${error.message}`);
        vscode.window.showErrorMessage(`Setup failed: ${error.message}`);
    }
}

async function checkPrerequisites(): Promise<{
    allPassed: boolean;
    awsCli: boolean;
    sessionManagerPlugin: boolean;
    remoteSSH: boolean;
    sshConfig: boolean;
    awsToolkit: boolean;
    errors: string[];
}> {
    const errors: string[] = [];
    
    // Check AWS CLI
    let awsCli = false;
    try {
        await execAsync('aws --version');
        awsCli = true;
    } catch {
        errors.push('AWS CLI not found');
    }

    // Check Session Manager Plugin
    let sessionManagerPlugin = false;
    const pluginPath = 'C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin\\session-manager-plugin.exe';
    if (fs.existsSync(pluginPath)) {
        sessionManagerPlugin = true;
    } else {
        try {
            await execAsync('session-manager-plugin --version');
            sessionManagerPlugin = true;
        } catch {
            errors.push('Session Manager Plugin not found');
        }
    }

    // Check Remote-SSH extension
    const remoteSSH = vscode.extensions.getExtension('ms-vscode-remote.remote-ssh') !== undefined;

    // Check SSH config
    const sshConfigPath = path.join(process.env.USERPROFILE || '', '.ssh', 'config');
    let sshConfig = false;
    if (fs.existsSync(sshConfigPath)) {
        const configContent = fs.readFileSync(sshConfigPath, 'utf8');
        sshConfig = configContent.includes('Host sagemaker');
    }

    // Check AWS Toolkit
    const awsToolkit = vscode.extensions.getExtension('amazonwebservices.aws-toolkit-vscode') !== undefined;

    return {
        allPassed: errors.length === 0 && remoteSSH && sshConfig,
        awsCli,
        sessionManagerPlugin,
        remoteSSH,
        sshConfig,
        awsToolkit,
        errors
    };
}

async function checkServerStatus(): Promise<{ running: boolean; pid?: number; port?: number }> {
    const serverInfoPath = path.join(
        process.env.APPDATA || '',
        'Cursor',
        'User',
        'globalStorage',
        'amazonwebservices.aws-toolkit-vscode',
        'sagemaker-local-server-info.json'
    );

    try {
        if (fs.existsSync(serverInfoPath)) {
            const info = JSON.parse(fs.readFileSync(serverInfoPath, 'utf8'));
            return { running: true, pid: info.pid, port: info.port };
        }
    } catch {
        // Ignore errors
    }

    return { running: false };
}

async function installSessionManagerPlugin(): Promise<void> {
    const downloadUrl = 'https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe';
    const installerPath = path.join(process.env.TEMP || '', 'SessionManagerPluginSetup.exe');

    // Download and install
    await execAsync(`powershell -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile '${installerPath}'"`);
    await execAsync(`"${installerPath}" /S`);
}

async function setupSSHConfig(): Promise<void> {
    const sshDir = path.join(process.env.USERPROFILE || '', '.ssh');
    const sshConfigPath = path.join(sshDir, 'config');

    // Create .ssh directory if it doesn't exist
    if (!fs.existsSync(sshDir)) {
        fs.mkdirSync(sshDir, { recursive: true });
    }

    // Read existing config
    let configContent = '';
    if (fs.existsSync(sshConfigPath)) {
        configContent = fs.readFileSync(sshConfigPath, 'utf8');
    }

    // Check if sagemaker host already exists
    if (configContent.includes('Host sagemaker')) {
        vscode.window.showInformationMessage('SSH config already contains SageMaker host');
        return;
    }

    // Get configuration
    const spaceArn = await vscode.window.showInputBox({
        prompt: 'Enter SageMaker Space ARN',
        placeHolder: 'arn:aws:sagemaker:us-east-1:123456789012:space/d-xxx/space-name'
    });

    if (!spaceArn) {
        throw new Error('Space ARN is required');
    }

    // Generate hostname from ARN
    const hostname = generateHostname(spaceArn);
    const serverInfoPath = path.join(
        process.env.APPDATA || '',
        'Cursor',
        'User',
        'globalStorage',
        'amazonwebservices.aws-toolkit-vscode',
        'sagemaker-local-server-info.json'
    );

    // Add SSH config entry
    const sshEntry = `
Host sagemaker
    HostName ${hostname}
    User sagemaker-user
    ForwardAgent yes
    AddKeysToAgent yes
    StrictHostKeyChecking accept-new
    ProxyCommand powershell.exe -NoProfile -Command "$env:SAGEMAKER_LOCAL_SERVER_FILE_PATH='${serverInfoPath}'; & '${path.join(process.env.APPDATA || '', 'Cursor', 'User', 'globalStorage', 'amazonwebservices.aws-toolkit-vscode', 'sagemaker_connect.ps1')}' %h"
`;

    configContent += sshEntry;
    fs.writeFileSync(sshConfigPath, configContent, 'utf8');
}

function generateHostname(arn: string): string {
    // Convert ARN to hostname format: sm_lc_arn_._aws_._sagemaker_._region_._account_._space__domain__space-name
    const parts = arn.split(':');
    const resource = parts[5]; // space/d-xxx/space-name
    const resourceParts = resource.split('/');
    
    const region = parts[3];
    const account = parts[4];
    const domain = resourceParts[1];
    const spaceName = resourceParts[2];

    return `sm_lc_arn_._aws_._sagemaker_._${region}._${account}_._space__${domain}__${spaceName}`;
}

export function deactivate() {}

