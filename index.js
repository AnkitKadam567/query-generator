const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Store credentials and paths securely
let apiToken = undefined;
let sourcePath = undefined;
let destinationPath = undefined;

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
    if (!apiToken) {
      vscode.window.showErrorMessage('Please generate an API token in the Angular to React sidebar first.');
      return;
    }

    if (!sourcePath) {
      sourcePath = await selectFolderPath('Select source directory containing Angular files');
      if (!sourcePath) return; // User cancelled selection
    }

    if (!destinationPath) {
      destinationPath = await selectFolderPath('Select destination directory for React files');
      if (!destinationPath) return; // User cancelled selection
    }

    try {
      await convertAngularToReact(sourcePath, destinationPath);
      vscode.window.showInformationMessage('Angular to React conversion completed!');
    } catch (error) {
      vscode.window.showErrorMessage(`Conversion failed: ${error.message || 'Unknown error'}`);
    }
  });

  // Register the command to select source path
  context.subscriptions.push(
    vscode.commands.registerCommand('angular-to-react.selectSourcePath', async () => {
      sourcePath = await selectFolderPath('Select source directory containing Angular files');
      if (sourcePath) {
        provider.updateSourcePath(sourcePath);
      }
    })
  );

  // Register the command to select destination path
  context.subscriptions.push(
    vscode.commands.registerCommand('angular-to-react.selectDestinationPath', async () => {
      destinationPath = await selectFolderPath('Select destination directory for React files');
      if (destinationPath) {
        provider.updateDestinationPath(destinationPath);
      }
    })
  );

  context.subscriptions.push(disposable);
}

/**
 * Helper function to prompt user to select a folder
 * @param {string} title - Dialog title
 * @returns {Promise<string|undefined>} - Selected folder path or undefined if cancelled
 */
async function selectFolderPath(title) {
  const options = {
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select Folder',
    title: title
  };

  const folderUri = await vscode.window.showOpenDialog(options);
  if (folderUri && folderUri.length > 0) {
    return folderUri[0].fsPath;
  }
  return undefined;
}

class AngularToReactViewProvider {
  /**
   * @param {vscode.Uri} extensionUri
   */
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
    this._view = undefined;
  }

  /**
   * @param {vscode.WebviewView} webviewView
   * @param {vscode.WebviewViewResolveContext} context
   * @param {vscode.CancellationToken} _token
   */
  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'generateToken':
          this._generateToken(message.username, message.password);
          break;
        case 'selectSourcePath':
          vscode.commands.executeCommand('angular-to-react.selectSourcePath');
          break;
        case 'selectDestinationPath':
          vscode.commands.executeCommand('angular-to-react.selectDestinationPath');
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
   * Generate API token from credentials
   * @param {string} username - User's username
   * @param {string} password - User's password
   */
  async _generateToken(username, password) {
    if (!username || !password) {
      this._sendMessage({ command: 'error', message: 'Username and password are required' });
      return;
    }

    try {
      // Call the token generation API
      const response = await axios.post('https://generate/token', {
        username,
        password
      });

      // Store the token
      apiToken = response.data.token;
      
      // Notify the webview that token was generated successfully
      this._sendMessage({ command: 'tokenGenerated', token: apiToken });
      
      vscode.window.showInformationMessage('API token generated successfully!');
    } catch (error) {
      this._sendMessage({ 
        command: 'error', 
        message: `Failed to generate token: ${error.response?.data?.message || error.message}` 
      });
    }
  }

  /**
   * Send a message to the webview
   * @param {object} message - Message to send to the webview
   */
  _sendMessage(message) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Update the source path in the webview
   * @param {string} path - Selected source path
   */
  updateSourcePath(path) {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateSourcePath',
        path: path
      });
      sourcePath = path;
    }
  }

  /**
   * Update the destination path in the webview
   * @param {string} path - Selected destination path
   */
  updateDestinationPath(path) {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateDestinationPath',
        path: path
      });
      destinationPath = path;
    }
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
      margin-bottom: 16px;
    }

    h4 {
      margin: 12px 0 6px;
      font-size: 1rem;
      color: var(--vscode-editor-foreground);
    }

    p {
      margin-bottom: 8px;
    }

    input[type="password"], input[type="text"] {
      width: 100%;
      padding: 8px 14px 8px 10px;
      font-size: 13px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 4px;
      outline: none;
      margin-bottom: 10px;
    }

    input[type="password"]:focus, input[type="text"]:focus {
      border-color: var(--vscode-focusBorder);
    }

    .path-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .path-input {
      flex-grow: 1;
    }

    .browse-button {
      background-color: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
      border: none;
      padding: 8px 12px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
    }

    .browse-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground, #45494e);
    }

    .consent-group {
      margin-top: 12px;
      margin-bottom: 16px;
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
      transition: background-color 0.2s ease-in-out;
      margin-top: 6px;
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .path-label {
      margin-top: 12px;
      margin-bottom: 6px;
      font-weight: bold;
    }
    
    .section {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .section:last-child {
      border-bottom: none;
    }
    
    .hidden {
      display: none;
    }
    
    .credentials-container {
      margin-bottom: 14px;
    }
    
    .token-container {
      display: flex;
      align-items: center;
      margin-top: 10px;
      padding: 8px 12px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
    }
    
    .token-text {
      flex-grow: 1;
      font-family: monospace;
      word-break: break-all;
      margin: 0;
    }
  </style>
</head>
<body>
  <h3>⚡ Angular to React Converter</h3>

  <!-- Step 1: Credentials -->
  <div id="credentialsSection" class="section">
    <h4>Login Credentials</h4>
    <div class="credentials-container">
      <p>Username:</p>
      <input type="text" id="usernameInput" placeholder="Enter username" />
      
      <p>Password:</p>
      <input type="password" id="passwordInput" placeholder="Enter password" />
    </div>
    
    <button id="generateTokenBtn">Generate API Token</button>
    
    <div id="tokenDisplay" class="token-container hidden">
      <p class="token-text">Token generated successfully!</p>
    </div>
  </div>

  <!-- Step 2: Permissions (initially hidden) -->
  <div id="permissionsSection" class="section hidden">
    <h4>Required Permissions</h4>
    <div class="consent-group">
      <div class="consent">
        <input type="checkbox" id="readConsent" />
        <label for="readConsent">Allow file read access</label>
      </div>
      <div class="consent">
        <input type="checkbox" id="writeConsent" />
        <label for="writeConsent">Allow file write access</label>
      </div>
    </div>
    
    <button id="permissionsConfirmBtn">Confirm Permissions</button>
  </div>

  <!-- Step 3: Path Selection (initially hidden) -->
  <div id="pathsSection" class="section hidden">
    <h4>Select Folders</h4>
    <p class="path-label">Source folder (Angular files):</p>
    <div class="path-row">
      <input type="text" id="sourcePathInput" class="path-input" placeholder="Select source folder..." readonly />
      <button class="browse-button" id="sourcePathButton">Browse</button>
    </div>

    <p class="path-label">Destination folder (React files):</p>
    <div class="path-row">
      <input type="text" id="destPathInput" class="path-input" placeholder="Select destination folder..." readonly />
      <button class="browse-button" id="destPathButton">Browse</button>
    </div>
  </div>
  
  <!-- Step 4: Proceed Button (initially hidden) -->
  <div id="proceedSection" class="section hidden">
    <button id="proceedBtn" disabled>🚀 Start Conversion</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let hasToken = false;
    let permissionsGranted = false;
    let sourceFolderSelected = false;
    let destFolderSelected = false;

    // Generate token button handler
    document.getElementById('generateTokenBtn').addEventListener('click', () => {
      const username = document.getElementById('usernameInput').value;
      const password = document.getElementById('passwordInput').value;
      
      if (!username || !password) {
        vscode.postMessage({ command: 'error', message: 'Username and password are required' });
        return;
      }
      
      // Call the extension to generate token
      vscode.postMessage({ 
        command: 'generateToken', 
        username: username,
        password: password
      });
    });

    // Permissions confirmation button handler
    document.getElementById('permissionsConfirmBtn').addEventListener('click', () => {
      const readConsent = document.getElementById('readConsent').checked;
      const writeConsent = document.getElementById('writeConsent').checked;
      
      if (!readConsent || !writeConsent) {
        vscode.postMessage({ 
          command: 'error', 
          message: 'Both read and write permissions are required' 
        });
        return;
      }
      
      permissionsGranted = true;
      document.getElementById('pathsSection').classList.remove('hidden');
      document.getElementById('proceedSection').classList.remove('hidden');
      checkProceedButtonState();
    });

    // Source path selection button handler
    document.getElementById('sourcePathButton').addEventListener('click', () => {
      vscode.postMessage({ command: 'selectSourcePath' });
    });

    // Destination path selection button handler
    document.getElementById('destPathButton').addEventListener('click', () => {
      vscode.postMessage({ command: 'selectDestinationPath' });
    });

    // Proceed button handler
    document.getElementById('proceedBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'startConversion' });
    });

    // Check if the proceed button should be enabled
    function checkProceedButtonState() {
      const proceedButton = document.getElementById('proceedBtn');
      if (hasToken && permissionsGranted && sourceFolderSelected && destFolderSelected) {
        proceedButton.disabled = false;
      } else {
        proceedButton.disabled = true;
      }
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.command) {
        case 'tokenGenerated':
          // Show token was generated and show next section
          hasToken = true;
          document.getElementById('tokenDisplay').classList.remove('hidden');
          document.getElementById('permissionsSection').classList.remove('hidden');
          checkProceedButtonState();
          break;
          
        case 'updateSourcePath':
          document.getElementById('sourcePathInput').value = message.path;
          sourceFolderSelected = true;
          checkProceedButtonState();
          break;
          
        case 'updateDestinationPath':
          document.getElementById('destPathInput').value = message.path;
          destFolderSelected = true;
          checkProceedButtonState();
          break;
          
        case 'error':
          // Handled by the extension
          break;
      }
    });
  </script>
</body>
</html>
	`;
  }
}

/**
 * Converts Angular files to React in the workspace
 * @param {string} sourcePath - Source directory containing Angular files
 * @param {string} destinationPath - Destination directory for React files
 */
async function convertAngularToReact(sourcePath, destinationPath) {
  // Find Angular files in the source path
  const angularFiles = await findAngularFiles(sourcePath);
  
  if (angularFiles.length === 0) {
    throw new Error('No Angular files found in the selected source folder');
  }
  
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destinationPath)) {
    fs.mkdirSync(destinationPath, { recursive: true });
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
        
        // Create the appropriate directory structure in the destination folder
        const relativePath = path.relative(sourcePath, file);
        const reactFilePath = createReactFilePath(destinationPath, relativePath);
        
        // Ensure the directory exists
        const reactFileDir = path.dirname(reactFilePath);
        if (!fs.existsSync(reactFileDir)) {
          fs.mkdirSync(reactFileDir, { recursive: true });
        }
        
        // Write the converted React code to the destination file
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
  const tsFilesPattern = new vscode.RelativePattern(rootPath, '**/*.ts');
  const htmlFilesPattern = new vscode.RelativePattern(rootPath, '**/*.html');
  
  const tsFiles = await vscode.workspace.findFiles(tsFilesPattern, '**/node_modules/**');
  const htmlFiles = await vscode.workspace.findFiles(htmlFilesPattern, '**/node_modules/**');
  
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
          'Authorization': `Bearer ${apiToken}`, // Using the generated token instead of OpenAI key
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    if (error.response) {
      throw new Error(`API error: ${error.response.data.error?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Create file path for the React version of an Angular file
 * @param {string} destRoot - Destination root directory
 * @param {string} relativePath - Relative path from source root
 * @returns {string} - React file path
 */
function createReactFilePath(destRoot, relativePath) {
  const fileName = path.basename(relativePath, path.extname(relativePath));
  const relativeDir = path.dirname(relativePath);
  
  // For .ts files, create .jsx files
  if (path.extname(relativePath) === '.ts') {
    return path.join(destRoot, relativeDir, `${fileName}.jsx`);
  }
  
  // For .html files, create a separate .jsx file
  if (path.extname(relativePath) === '.html') {
    return path.join(destRoot, relativeDir, `${fileName}-view.jsx`);
  }
  
  // Default case
  return path.join(destRoot, relativeDir, `${fileName}.react${path.extname(relativePath)}`);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
