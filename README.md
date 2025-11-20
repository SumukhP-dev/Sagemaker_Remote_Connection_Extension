# SageMaker Remote Connection Extension

**Connect Cursor/VS Code to AWS SageMaker Studio JupyterLab notebooks via Remote-SSH**

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/SumukhP-dev/Sagemaker_Remote_Connection_Extension)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.80.0+-blue)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/SumukhP-dev/Sagemaker_Remote_Connection_Extension/blob/main/LICENSE)

> **Looking to connect Cursor to SageMaker?** This extension makes it easy! Connect to your SageMaker Studio JupyterLab instances with one click.

## 🔍 Who is this for?

- **Data Scientists** working with SageMaker Studio notebooks
- **ML Engineers** who want to use Cursor/VS Code with SageMaker
- **Developers** looking to connect to remote SageMaker environments
- **Anyone** asking: _"How do I connect Cursor to SageMaker?"_ or _"Can I use VS Code with SageMaker Studio?"_

## Features

- 🔌 **Easy Connection**: One-click connection to SageMaker Studio spaces
- ✅ **Prerequisites Check**: Automatically verifies all required tools
- 🛠️ **Auto Setup**: Configures SSH and installs missing components
- 📊 **Status Monitoring**: Check connection status and server health
- 🔧 **Troubleshooting Tools**: Comprehensive diagnostics and fix commands
- 🚀 **Quick Start**: Automated connection process
- 🐛 **Debug Tools**: SSH config debugging and connection diagnostics
- 🔄 **Auto-Fix**: Automatic fixes for common issues (code wrapper, ARN conversion, SSH config)

## Prerequisites

Before using this extension, ensure you have:

1. **AWS CLI** installed ([Download](https://aws.amazon.com/cli/))
2. **Remote-SSH Extension** installed:
   - For Cursor: `anysphere.remote-ssh`
   - For VS Code: `ms-vscode-remote.remote-ssh`
3. **AWS Toolkit Extension** installed (`amazonwebservices.aws-toolkit-vscode`)
4. **AWS Credentials** configured (via `aws configure` or AWS Toolkit)
5. **SageMaker Studio Space** with remote connections enabled:
   - In AWS Console: SageMaker → Studio → Your Domain → Your Space
   - Ensure "Remote Connection" or "VS Code Connection" is enabled for your Space
   - You should see an "Open in VS Code" option available in the Space details

## Installation

### Option 1: Install from VSIX (Recommended)

1. Download the latest `.vsix` file from the releases
2. In Cursor/VS Code, open Command Palette (`F1`)
3. Type: `Extensions: Install from VSIX...`
4. Select the downloaded `.vsix` file

### Option 2: Build from Source

```bash
cd sagemaker-remote-extension
npm install
npm run compile
npm run package
```

This creates a `.vsix` file in the root directory.

## Usage

### Quick Start (Recommended)

**Important Prerequisites**: Before running Quick Start, you must first start the local server:

1. **Open VS Code Version from Website GUI**:

   - Go to AWS Console → SageMaker → Studio → Your Domain → Your Space
   - In the SageMaker Studio web interface, click on your Space
   - Look for "Open in VS Code" or "Remote Connection" option in the Space details
   - Click to open the VS Code version (this will launch VS Code/Cursor with a remote connection attempt)
   - **Leave the Remote window open** even if it shows an error or fails to connect
   - Wait ~10-15 seconds for the local server to start in the background

2. **Try Connecting via AWS Toolkit Extension** (optional but recommended):

   - In VS Code/Cursor, open AWS Toolkit sidebar (click AWS icon in left sidebar)
   - Navigate to: SageMaker AI → Studio → Domain → SPACES
   - Right-click your **Space** (NOT the app) → "Open Remote Connection" or "Connect"
   - This will attempt to connect and help ensure the local server is running
   - The connection may fail, but the local server should start in the background

3. **Run Quick Start**:

   - Open Command Palette (`F1`)
   - Run: `SageMaker: Quick Start: Connect to SageMaker`
   - Follow the prompts

4. **Connect Manually**:
   - When setup completes, connect manually:
   - Press `F1` → `Remote-SSH: Connect to Host` → Select `sagemaker`

**Note**: The Quick Start command automates the setup process: checks prerequisites, fixes common issues, verifies server status, and prepares everything for connection. However, the local server must be started first via AWS Toolkit as described above.

### Step-by-Step Setup

#### 1. Initial Setup

1. Open Command Palette (`F1`)
2. Run: `SageMaker: Setup SageMaker Connection`
3. Enter your SageMaker Space ARN when prompted
4. The extension will:
   - Install Session Manager Plugin (if needed)
   - Configure SSH config
   - Set up connection parameters

#### 2. Start Local Server

**Important**: The local server must be running before connecting or running Quick Start.

**Recommended Method: Open from Website GUI, then Connect via AWS Toolkit**

1. **Open VS Code Version from SageMaker Studio Website**:

   - Go to AWS Console → SageMaker → Studio → Your Domain → Your Space
   - In the SageMaker Studio web interface, find your Space
   - Click "Open in VS Code" or "Remote Connection" option
   - This will launch VS Code/Cursor with a remote connection attempt
   - **Leave the Remote window open** even if it shows an error or fails to connect
   - Wait ~10-15 seconds for the local server to start in the background

2. **Try Connecting via AWS Toolkit Extension**:
   - In VS Code/Cursor, open AWS Toolkit sidebar (click AWS icon in left sidebar)
   - Navigate to: SageMaker AI → Studio → Domain → SPACES
   - Right-click your **Space** (NOT the app) → "Open Remote Connection" or "Connect"
   - The connection may fail, but this helps ensure the local server is running
   - You can close the Remote window once the server has started (the server continues running)

**Alternative Method: Using Extension Command**

- Press `F1` → `SageMaker: Start Local Server`
- Note: This may not work if AWS Toolkit hasn't been initialized yet. Use the website GUI method above if this fails.

#### 3. Connect to SageMaker

After setup is complete, connect manually using Remote-SSH:

1. Press `F1` (or `Ctrl+Shift+P`)
2. Type: `Remote-SSH: Connect to Host`
3. Select `sagemaker` from the list (or type it if it doesn't appear)

The connection will establish via SSH using the configured proxy command.

## Available Commands

All commands are accessible via Command Palette (`F1` → type "SageMaker"):

| Command                               | Description                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Quick Start: Connect to SageMaker** | Automated setup process (recommended) - prepares everything, then connect manually via Remote-SSH |
| **Check SageMaker Connection Status** | Verify prerequisites and server status                                                            |
| **Setup SageMaker Connection**        | Initial setup wizard                                                                              |
| **Start Local Server**                | Attempt to start the local server                                                                 |
| **Diagnose Connection**               | Comprehensive diagnostics report                                                                  |
| **Debug SSH Config**                  | Detailed SSH config analysis                                                                      |
| **Fix ARN Conversion**                | Fix ARN conversion in connection script                                                           |
| **Fix Code Wrapper**                  | Fix code command wrapper for Cursor                                                               |
| **Fix SSH Config**                    | Fix common SSH config issues                                                                      |
| **Apply All Fixes**                   | Apply all available fixes at once                                                                 |

## Configuration

The extension uses these settings (accessible via Settings UI):

- `sagemakerRemote.spaceArn`: Your SageMaker Space ARN
- `sagemakerRemote.region`: AWS Region (default: us-east-1)
- `sagemakerRemote.sshHostAlias`: SSH host alias (default: sagemaker)

## Troubleshooting

### Quick Troubleshooting

1. **Run Diagnostics**: `SageMaker: Diagnose Connection`

   - Provides comprehensive system check
   - Identifies common issues
   - Suggests fixes

2. **Apply All Fixes**: `SageMaker: Apply All Fixes`
   - Fixes code wrapper issues
   - Fixes ARN conversion
   - Fixes SSH config problems

### Common Issues

#### "Session Manager Plugin not found"

The extension will attempt to install it automatically. If it fails:

1. Download manually: https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe
2. Run the installer
3. Restart Cursor/VS Code

#### "Server not running"

1. **Check server status**: `SageMaker: Check SageMaker Connection Status`
2. **Start server**: `SageMaker: Start Local Server` or use AWS Toolkit UI
3. **If server won't start**: Check for code wrapper issues:
   - Run: `SageMaker: Diagnose Connection`
   - If code wrapper issue detected, run: `SageMaker: Fix Code Wrapper`
   - Restart Cursor/VS Code

#### "Connection failed"

1. **Check prerequisites**: `SageMaker: Check SageMaker Connection Status`
2. **Run diagnostics**: `SageMaker: Diagnose Connection`
3. **Debug SSH config**: `SageMaker: Debug SSH Config`
4. **Verify AWS credentials** are configured
5. **Ensure the Space ARN is correct**
6. **Check AWS Toolkit logs** for errors

#### "Invalid ARN format"

Make sure you're using a **Space ARN**, not an App ARN:

- ✅ Correct: `arn:aws:sagemaker:us-east-1:123456789012:space/d-xxx/space-name`
- ❌ Wrong: `arn:aws:sagemaker:us-east-1:123456789012:app/d-xxx/space-name/...`

**Note**: The extension can automatically convert App ARNs to Space ARNs. Run `SageMaker: Fix ARN Conversion` if needed.

#### "Host not appearing in picker" (Cursor)

If the `sagemaker` host doesn't appear in the Remote-SSH picker:

1. **Debug SSH config**: `SageMaker: Debug SSH Config`
2. **Reload window**: Press `Ctrl+R` or `F1` → "Developer: Reload Window"
3. **Manual connection**: Use `F1` → `Remote-SSH: Connect to Host` → type `sagemaker`

#### "Code wrapper issue" (Cursor)

If AWS Toolkit can't start the server due to code command issues:

1. Run: `SageMaker: Fix Code Wrapper`
2. Restart Cursor completely
3. Try starting the server again

#### "remote.SSH.useLocalServer" setting error

This is a harmless warning from Remote-SSH. You can ignore it, or add this to your `settings.json`:

```json
"remote.SSH.useLocalServer": true
```

## How It Works

1. **SSH Config**: Creates an SSH host entry that uses a PowerShell proxy command
2. **Proxy Command**: The `sagemaker_connect.ps1` script:
   - Parses the hostname to extract the Space ARN
   - Connects to the local server started by AWS Toolkit
   - Gets SSM session info from the server
   - Launches Session Manager Plugin to establish the connection
3. **Remote-SSH**: Uses the configured SSH host to connect
4. **Auto-Fixes**: Extension can automatically fix common issues:
   - Code wrapper for Cursor compatibility
   - ARN conversion (App ARN → Space ARN)
   - SSH config formatting and syntax

## Requirements

- **OS**: Windows (PowerShell required)
- **Editor**: Cursor or VS Code 1.80.0+
- **AWS**: Account with SageMaker Studio access
- **IAM**: Permissions for SageMaker and SSM
- **Extensions**: Remote-SSH and AWS Toolkit

## License

MIT

## Contributing

Contributions welcome! Please open an issue or pull request.
