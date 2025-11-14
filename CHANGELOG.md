# Change Log

All notable changes to the SageMaker Remote Connection extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2024-12-XX

### Fixed
- Fixed publisher name to match OpenVSX account (SumukhP-dev)

## [1.0.0] - 2024-12-XX

### Added
- Initial release of SageMaker Remote Connection extension
- One-click connection to SageMaker Studio JupyterLab notebooks via Remote-SSH
- Automatic prerequisites checking (AWS CLI, Remote-SSH, AWS Toolkit)
- Automatic setup wizard for configuring SSH and connection parameters
- Quick Start command for automated connection process
- Connection status monitoring and server health checks
- Comprehensive diagnostics and troubleshooting tools
- Auto-fix capabilities for common issues:
  - Code wrapper fixes for Cursor compatibility
  - ARN conversion (App ARN → Space ARN)
  - SSH config formatting and syntax fixes
- SSH config debugging and analysis
- Local server management and startup
- Support for Windows with PowerShell
- Configuration settings for Space ARN, region, and SSH host alias

### Features
- 🔌 Easy Connection: One-click connection to SageMaker Studio spaces
- ✅ Prerequisites Check: Automatically verifies all required tools
- 🛠️ Auto Setup: Configures SSH and installs missing components
- 📊 Status Monitoring: Check connection status and server health
- 🔧 Troubleshooting Tools: Comprehensive diagnostics and fix commands
- 🚀 Quick Start: Automated connection process
- 🐛 Debug Tools: SSH config debugging and connection diagnostics
- 🔄 Auto-Fix: Automatic fixes for common issues

