# Installation Instructions

## Quick Start

### Step 1: Install Prerequisites

1. **AWS CLI**
   - Download: https://aws.amazon.com/cli/
   - Install and verify: `aws --version`

2. **Remote-SSH Extension**
   - Open Cursor
   - Go to Extensions (`Ctrl+Shift+X`)
   - Search: "Remote - SSH"
   - Install: `ms-vscode-remote.remote-ssh`

3. **AWS Toolkit Extension**
   - In Extensions, search: "AWS Toolkit"
   - Install: `amazonwebservices.aws-toolkit-vscode`

4. **Configure AWS Credentials**
   ```bash
   aws configure
   ```
   Or use AWS Toolkit to connect to your AWS account.

### Step 2: Install Extension

#### Option A: From VSIX File

1. Download `sagemaker-remote-connection-1.0.0.vsix`
2. In Cursor, press `F1`
3. Type: `Extensions: Install from VSIX...`
4. Select the downloaded file
5. Reload Cursor if prompted

#### Option B: Build from Source

```bash
# Clone or download the extension
cd sagemaker-remote-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension
npm run package

# Install the generated .vsix file
# In Cursor: F1 → "Extensions: Install from VSIX..."
```

### Step 3: Setup Connection

1. Press `F1` → `SageMaker: Setup SageMaker Connection`
2. Enter your SageMaker Space ARN:
   ```
   arn:aws:sagemaker:us-east-1:123456789012:space/d-xxx/space-name
   ```
3. The extension will:
   - Install Session Manager Plugin (if needed)
   - Configure SSH config
   - Set up connection files

### Step 4: Connect

1. **Start Local Server**:
   - Open AWS Toolkit sidebar
   - Navigate to your SageMaker Space
   - Right-click the **Space** (not app) → "Open Remote Connection"
   - Wait 5-10 seconds for server to start

2. **Connect**:
   - Press `F1` → `SageMaker: Connect to SageMaker`
   - Or: `F1` → `Remote-SSH: Connect to Host` → `sagemaker`

## Verification

Check if everything is set up correctly:

1. Press `F1` → `SageMaker: Check SageMaker Connection Status`
2. Verify all prerequisites show ✅
3. Check that local server is running

## Troubleshooting

### Extension Not Found

- Make sure you installed the `.vsix` file correctly
- Reload Cursor: `F1` → `Developer: Reload Window`

### Setup Fails

- Check that AWS CLI is installed: `aws --version`
- Verify AWS credentials: `aws sts get-caller-identity`
- Ensure Remote-SSH extension is installed

### Connection Fails

- Verify local server is running (check status command)
- Check AWS Toolkit logs for errors
- Ensure you're using Space ARN, not App ARN
- Try restarting the local server

## Next Steps

Once connected:
- Your SageMaker home directory: `/home/sagemaker-user/`
- Create notebooks there or upload existing ones
- Use JupyterLab features through Cursor

## Support

For issues:
1. Check the status command output
2. Review AWS Toolkit logs
3. Check SSH config at `~/.ssh/config`
4. Open an issue on GitHub

