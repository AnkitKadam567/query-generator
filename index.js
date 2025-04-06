// File: extension.js
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Store API key securely
let openAIKey = undefined;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Angular to React Converter is now active');

  // Create sidebar webview provider
  const provider = new AngularToReactViewProvider(context.extensionUri);
  
  // Register the sidebar view
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('angular-to-react-sidebar-view', provider)
  );

  // Register the command to start conversion
  const disposable = vscode.commands.registerCommand('angular-to-react.convert', async () => {
    if (!openAIKey) {
      vscode.window.showErrorMessage('Please enter your OpenAI API key in the Angular to React sidebar first.');
      return;
    }

    try {
      await convertAngularToReact();
      vscode.window.showInformationMessage('Angular to React conversion completed!');
    } catch (error) {
      vscode.window.showErrorMessage(`Conversion failed: ${error.message || 'Unknown error'}`);
    }
  });

  context.subscriptions.push(disposable);
}

class AngularToReactViewProvider {
  /**
   * @param {vscode.Uri} extensionUri
   */
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
  }

  /**
   * @param {vscode.WebviewView} webviewView
   * @param {vscode.WebviewViewResolveContext} context
   * @param {vscode.CancellationToken} _token
   */
  resolveWebviewView(webviewView, context, _token) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'saveApiKey':
          // Store API key (in production, use a more secure approach)
          openAIKey = message.apiKey;
          vscode.window.showInformationMessage('API key saved!');
          break;
        case 'startConversion':
          vscode.commands.executeCommand('angular-to-react.convert');
          break;
        case 'error':
          vscode.window.showErrorMessage(message.message);
          break;
      }
    });
  }

  /**
   * @param {vscode.Webview} webview
   * @returns {string}
   */
  _getHtmlForWebview(webview) {
    return `
	<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Angular to React Converter</title>
  <style>
    body {
      padding: 16px;
      margin: 0 20px 0 0;
      font-family: var(--vscode-font-family);
      font-size: 14px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }

    h3 {
      margin-top: 0;
      font-size: 1.2rem;
      font-weight: bold;
      color: var(--vscode-editor-foreground);
    }

    h4 {
      margin: 12px 0 6px;
      font-size: 1rem;
      color: var(--vscode-editor-foreground);
    }

    p {
      margin-bottom: 8px;
    }

	input[type="password"] {
		width: 100%;
		padding: 8px 14px 8px 10px;
		font-size: 13px;
		background-color: var(--vscode-input-background);
		color: var(--vscode-input-foreground);
		border: 1px solid var(--vscode-input-border, #444);
		border-radius: 4px;
		outline: none;
	}

    input[type="password"]:focus {
      border-color: var(--vscode-focusBorder);
    }

    .consent-group {
      margin-top: 12px;
    }

    .consent {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 13px;
    }

    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 14px;
      font-weight: bold;
      font-size: 13px;
      border-radius: 5px;
      cursor: pointer;
      margin-top: 14px;
      transition: background-color 0.2s ease-in-out;
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <h3>⚡ Angular to React Converter</h3>

  <p>Enter your OpenAI API key:</p>
  <input type="password" id="apiKeyInput" placeholder="sk-..." />

  <div class="consent-group">
    <h4>Permissions</h4>
    <div class="consent">
      <input type="checkbox" id="readConsent" />
      <label for="readConsent">Allow file read access</label>
    </div>
    <div class="consent">
      <input type="checkbox" id="writeConsent" />
      <label for="writeConsent">Allow file write access</label>
    </div>
  </div>

  <button id="proceed">🚀 Proceed</button>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById('proceed').addEventListener('click', () => {
      const apiKey = document.getElementById('apiKeyInput').value;
      const readConsent = document.getElementById('readConsent').checked;
      const writeConsent = document.getElementById('writeConsent').checked;

      if (!apiKey) {
        vscode.postMessage({ command: 'error', message: 'API key is required' });
        return;
      }

      if (!readConsent) {
        vscode.postMessage({ command: 'error', message: 'Read file permission is required' });
        return;
      }

      if (!writeConsent) {
        vscode.postMessage({ command: 'error', message: 'Write file permission is required' });
        return;
      }

      vscode.postMessage({ command: 'saveApiKey', apiKey });
      vscode.postMessage({ command: 'startConversion' });
    });
  </script>
</body>
</html>


	`;
  }
}

/**
 * Converts Angular files to React in the workspace
 */
async function convertAngularToReact() {
  // Get workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error('No workspace folder is open');
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  
  // Find Angular files
  const angularFiles = await findAngularFiles(workspaceRoot);
  
  if (angularFiles.length === 0) {
    throw new Error('No Angular files found in the workspace');
  }
  
  // Process each file
  for (const file of angularFiles) {
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Converting ${path.basename(file)}`,
        cancellable: true
      }, async (progress, token) => {
        const fileContent = fs.readFileSync(file, 'utf8');
        const reactCode = await convertToReact(fileContent, file);
        
        // Create a new file with the React code
        const reactFilePath = createReactFilePath(file);
        fs.writeFileSync(reactFilePath, reactCode);
        
        progress.report({ increment: 100 });
      });
    } catch (error) {
      vscode.window.showWarningMessage(`Failed to convert ${file}: ${error.message || 'Unknown error'}`);
    }
  }
}

/**
 * Find Angular files in the workspace
 * @param {string} rootPath - Root path to search in
 * @returns {Promise<string[]>} - Array of file paths
 */
async function findAngularFiles(rootPath) {
  const angularFiles = [];
  
  // Find .ts/.html files that might be Angular components
  const tsFiles = await vscode.workspace.findFiles('**/*.ts', '**/node_modules/**');
  const htmlFiles = await vscode.workspace.findFiles('**/*.html', '**/node_modules/**');
  
  // Filter for Angular component files
  for (const file of tsFiles) {
    const content = fs.readFileSync(file.fsPath, 'utf8');
    if (content.includes('@Component') || content.includes('@NgModule') || content.includes('@Injectable')) {
      angularFiles.push(file.fsPath);
    }
  }
  
  // Add template files
  for (const file of htmlFiles) {
    const content = fs.readFileSync(file.fsPath, 'utf8');
    if (content.includes('*ngIf') || content.includes('*ngFor') || content.includes('[(ngModel)]')) {
      angularFiles.push(file.fsPath);
    }
  }
  
  return angularFiles;
}

/**
 * Convert Angular code to React using OpenAI API
 * @param {string} content - File content
 * @param {string} filePath - File path
 * @returns {Promise<string>} - Converted React code
 */
async function convertToReact(content, filePath) {
  try {
    // Call OpenAI API to convert the code
    const extension = path.extname(filePath);
    const fileType = extension === '.ts' ? 'TypeScript' : extension === '.html' ? 'HTML' : 'Unknown';
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: "You are a code conversion assistant that specializes in converting Angular code to React. Provide only the converted code without explanations."
          },
          {
            role: "user",
            content: `Convert this Angular ${fileType} code to React:\n\n${content}`
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    if (error.response) {
      throw new Error(`OpenAI API error: ${error.response.data.error?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Create file path for the React version of an Angular file
 * @param {string} angularFilePath - Angular file path
 * @returns {string} - React file path
 */
function createReactFilePath(angularFilePath) {
  const dir = path.dirname(angularFilePath);
  const fileName = path.basename(angularFilePath, path.extname(angularFilePath));
  
  // For .ts files, create .jsx files
  if (path.extname(angularFilePath) === '.ts') {
    return path.join(dir, `${fileName}.jsx`);
  }
  
  // For .html files, create a separate .jsx file
  if (path.extname(angularFilePath) === '.html') {
    return path.join(dir, `${fileName}-view.jsx`);
  }
  
  // Default case
  return path.join(dir, `${fileName}.react${path.extname(angularFilePath)}`);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
