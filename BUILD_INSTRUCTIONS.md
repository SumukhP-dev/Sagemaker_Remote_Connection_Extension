# Build Instructions

## Prerequisites

- Node.js 18+ installed
- npm installed

## Local Build

### Step 1: Install Dependencies

```bash
cd sagemaker-remote-extension
npm install
```

This will:
- Install all dependencies
- Generate `package-lock.json`

### Step 2: Compile TypeScript

```bash
npm run compile
```

This compiles TypeScript to JavaScript in the `out/` directory.

### Step 3: Package Extension

```bash
npm run package
```

This creates a `.vsix` file that you can install in Cursor/VS Code.

## Troubleshooting

### "vsce is not recognized"

The `@vscode/vsce` package is installed as a dev dependency. If you get this error:

```bash
npm install --save-dev @vscode/vsce
```

### "TypeScript compilation errors"

Check `tsconfig.json` and ensure all dependencies are installed:

```bash
npm install
npm run compile
```

### "package-lock.json not found"

Generate it:

```bash
npm install
```

Then commit it to git:

```bash
git add package-lock.json
git commit -m "Add package-lock.json"
```

## CI/CD

The GitHub Actions workflows will:
1. Install dependencies (`npm install`)
2. Compile TypeScript (`npm run compile`)
3. Package extension (`npm run package`) - on releases only

## Installation

After building, install the `.vsix` file:

1. In Cursor: `F1` → `Extensions: Install from VSIX...`
2. Select the generated `.vsix` file
3. Reload Cursor

