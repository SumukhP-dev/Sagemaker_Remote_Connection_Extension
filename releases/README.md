# Releases

This folder contains all published VSIX files for the SageMaker Remote Connection extension.

## Files

- `sagemaker-remote-connection-1.0.0.vsix` - Initial release
- `sagemaker-remote-connection-1.0.1.vsix` - Fixed publisher name

## Publishing

When you run `npm run package`, the VSIX file will be created in this folder.

To publish to OpenVSX (Cursor marketplace):
```bash
ovsx publish releases/sagemaker-remote-connection-<version>.vsix
```

To publish to VS Code Marketplace:
```bash
vsce publish
```

