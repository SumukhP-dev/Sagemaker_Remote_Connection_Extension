# GitHub Repository Setup Guide

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `sagemaker-remote-connection` (or your preferred name)
3. Description: "Connect Cursor/VS Code to AWS SageMaker Studio via Remote-SSH"
4. Choose: **Public** (recommended) or Private
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 2: Initialize Git and Push

```bash
cd sagemaker-remote-extension

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: SageMaker Remote Connection Extension"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/sagemaker-remote-connection.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Update Repository Settings

1. Go to your repository on GitHub
2. Click **Settings**
3. Under **Features**:
   - ✅ Enable Issues
   - ✅ Enable Discussions (optional)
   - ✅ Enable Wiki (optional)

## Step 4: Add Repository Badges (Optional)

Add to README.md:

```markdown
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.80.0+-blue)
![License](https://img.shields.io/badge/license-MIT-green)
```

## Step 5: Create First Release

1. Go to **Releases** → **Create a new release**
2. Tag: `v1.0.0`
3. Title: `v1.0.0 - Initial Release`
4. Description:
   ```markdown
   ## Initial Release
   
   - Connect to SageMaker Studio via Remote-SSH
   - Automatic prerequisites check
   - Auto-install Session Manager Plugin
   - Auto-configure SSH
   - Status monitoring
   ```
5. Upload the `.vsix` file (build it first with `npm run package`)
6. Click **Publish release**

## Step 6: Add Topics/Tags

On your repository page, click the gear icon next to "About" and add:
- `vscode-extension`
- `sagemaker`
- `aws`
- `remote-ssh`
- `jupyter`
- `notebook`

## Publishing to VS Code Marketplace (Optional)

If you want to publish to the marketplace:

1. Install `vsce`: `npm install -g @vscode/vsce`
2. Create a publisher account: https://marketplace.visualstudio.com/manage
3. Get a Personal Access Token
4. Login: `vsce login YOUR_PUBLISHER_NAME`
5. Publish: `vsce publish`

## Repository Structure

```
sagemaker-remote-connection/
├── .github/
│   └── workflows/          # CI/CD workflows
├── src/
│   └── extension.ts        # Main code
├── package.json            # Extension manifest
├── tsconfig.json          # TypeScript config
├── README.md              # User documentation
├── INSTALLATION.md        # Installation guide
├── DEVELOPMENT.md        # Dev guide
├── CONTRIBUTING.md        # Contributing guide
├── LICENSE                # MIT License
└── .gitignore            # Git ignore rules
```

## Next Steps

1. ✅ Create GitHub repo
2. ✅ Push code
3. ✅ Create first release
4. ⬜ (Optional) Publish to VS Code Marketplace
5. ⬜ Share with community!

## Benefits of GitHub Repo

- ✅ Version control
- ✅ Issue tracking
- ✅ Community contributions
- ✅ Releases and downloads
- ✅ Documentation hosting
- ✅ CI/CD automation
- ✅ Professional appearance

