# SageMaker Remote Connection Extension

Connect Cursor to AWS SageMaker Studio JupyterLab instances via Remote-SSH.

## Features

- 🔌 **Easy Connection**: One-click connection to SageMaker Studio spaces
- ✅ **Prerequisites Check**: Automatically verifies all required tools
- 🛠️ **Auto Setup**: Configures SSH and installs missing components
- 📊 **Status Monitoring**: Check connection status and server health

## Prerequisites

Before using this extension, ensure you have:

1. **AWS CLI** installed ([Download](https://aws.amazon.com/cli/))
2. **Remote-SSH Extension** installed in Cursor
3. **AWS Toolkit Extension** installed in Cursor
4. **AWS Credentials** configured (via `aws configure` or AWS Toolkit)

## Installation

### Option 1: Install from VSIX (Recommended)

1. Download the latest `.vsix` file from the releases
2. In Cursor, open Command Palette (`F1`)
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

### Initial Setup

1. Open Command Palette (`F1`)
2. Run: `SageMaker: Setup SageMaker Connection`
3. Enter your SageMaker Space ARN when prompted
4. The extension will:
   - Install Session Manager Plugin (if needed)
   - Configure SSH config
   - Set up connection parameters

### Connect to SageMaker

1. **Start the local server** (required):
   - Open AWS Toolkit sidebar
   - Find your SageMaker Space
   - Right-click the **Space** (not the app) → "Open Remote Connection"
   - Wait for server to start (5-10 seconds)

2. **Connect via Extension**:
   - Open Command Palette (`F1`)
   - Run: `SageMaker: Connect to SageMaker`
   - Or use the status check: `SageMaker: Check SageMaker Connection Status`

### Alternative: Direct Remote-SSH

After setup, you can also connect directly:
- Press `F1` → `Remote-SSH: Connect to Host` → `sagemaker`

## Configuration

The extension uses these settings (accessible via Settings UI):

- `sagemakerRemote.spaceArn`: Your SageMaker Space ARN
- `sagemakerRemote.region`: AWS Region (default: us-east-1)
- `sagemakerRemote.sshHostAlias`: SSH host alias (default: sagemaker)

## Troubleshooting

### "Session Manager Plugin not found"

The extension will attempt to install it automatically. If it fails:
1. Download manually: https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe
2. Run the installer
3. Restart Cursor

### "Server not running"

1. Open AWS Toolkit
2. Right-click your SageMaker **Space** → "Open Remote Connection"
3. Wait for server to start
4. Try connecting again

### "Connection failed"

1. Check prerequisites: `SageMaker: Check SageMaker Connection Status`
2. Verify AWS credentials are configured
3. Ensure the Space ARN is correct
4. Check AWS Toolkit logs for errors

### "Invalid ARN format"

Make sure you're using a **Space ARN**, not an App ARN:
- ✅ Correct: `arn:aws:sagemaker:us-east-1:123456789012:space/d-xxx/space-name`
- ❌ Wrong: `arn:aws:sagemaker:us-east-1:123456789012:app/d-xxx/space-name/...`

## How It Works

1. **SSH Config**: Creates an SSH host entry that uses a PowerShell proxy command
2. **Proxy Command**: The `sagemaker_connect.ps1` script:
   - Parses the hostname to extract the Space ARN
   - Connects to the local server started by AWS Toolkit
   - Gets SSM session info from the server
   - Launches Session Manager Plugin to establish the connection
3. **Remote-SSH**: Uses the configured SSH host to connect

## Requirements

- Windows (PowerShell required)
- Cursor or VS Code
- AWS Account with SageMaker Studio access
- IAM permissions for SageMaker and SSM

## License

MIT

## Contributing

Contributions welcome! Please open an issue or pull request.

