# Development Guide

## Project Structure

```
sagemaker-remote-extension/
├── src/
│   └── extension.ts          # Main extension code
├── package.json              # Extension manifest
├── tsconfig.json            # TypeScript config
├── README.md                # User documentation
├── INSTALLATION.md          # Installation instructions
└── DEVELOPMENT.md           # This file
```

## Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Compile TypeScript**
   ```bash
   npm run compile
   ```

3. **Watch Mode** (auto-compile on changes)
   ```bash
   npm run watch
   ```

4. **Test in Cursor**
   - Press `F5` to launch Extension Development Host
   - Or use "Run Extension" in VS Code

## Building

```bash
# Compile TypeScript
npm run compile

# Package extension
npm run package
```

This creates a `.vsix` file you can install.

## Key Components

### Extension Entry Point (`extension.ts`)

- **activate()**: Called when extension is activated
- **Commands**:
  - `sagemaker-remote.connect`: Connect to SageMaker
  - `sagemaker-remote.checkStatus`: Check connection status
  - `sagemaker-remote.setup`: Setup connection

### Prerequisites Check

The extension checks for:
- AWS CLI
- Session Manager Plugin
- Remote-SSH extension
- SSH config
- AWS Toolkit extension

### SSH Config Setup

Automatically generates SSH config entry:
```ssh
Host sagemaker
    HostName <generated-hostname>
    User sagemaker-user
    ProxyCommand powershell.exe ...
```

## Testing

1. Install extension in development mode
2. Test each command
3. Verify SSH config is created correctly
4. Test connection flow

## Publishing

1. Update version in `package.json`
2. Build: `npm run package`
3. Test the `.vsix` file
4. Publish to marketplace (if desired)

## Dependencies

- `@types/vscode`: VS Code API types
- `@types/node`: Node.js types
- `typescript`: TypeScript compiler
- `@vscode/vsce`: VS Code Extension Manager

## Notes

- Extension requires Windows (PowerShell)
- Relies on AWS Toolkit for local server
- Uses Remote-SSH extension for connection
- Session Manager Plugin must be installed

