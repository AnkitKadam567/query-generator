// src/writer.js
const fs = require('fs').promises;
const path = require('path');

/**
 * Write all converted files to the output directory
 * @param {string} outputPath - Base output path for React project
 * @param {Array} convertedComponents - Converted React components
 * @param {Array} convertedServices - Converted React services
 * @param {Array} convertedPipes - Converted React pipes/utils
 * @param {Object} routerStructure - Router structure files
 * @param {Object} options - Additional options
 * @returns {Promise<void>}
 */
async function writeOutputFiles(
  outputPath,
  convertedComponents,
  convertedServices,
  convertedPipes,
  routerStructure,
  options
) {
  try {
    // Create base output directory
    await createDirectory(outputPath);
    
    // Write components
    console.log('Writing components...');
    for (const component of convertedComponents) {
      await writeComponentFile(component, outputPath);
    }
    
    // Write services
    console.log('Writing services...');
    for (const service of convertedServices) {
      await writeFile(service.outputPath, service.reactCode);
    }
    
    // Write pipes/utils
    console.log('Writing utility functions...');
    for (const pipe of convertedPipes) {
      await writeFile(pipe.outputPath, pipe.jsFunction);
    }
    
    // Write router files
    console.log('Writing router files...');
    if (routerStructure) {
      if (routerStructure.router) {
        await writeFile(routerStructure.router.outputPath, routerStructure.router.code);
      }
      if (routerStructure.app) {
        await writeFile(routerStructure.app.outputPath, routerStructure.app.code);
      }
    }
    
    // Create package.json
    console.log('Creating package.json...');
    await createPackageJson(outputPath);
    
    // Create basic index.js
    console.log('Creating index.js...');
    await createIndexJs(outputPath);
    
    console.log(`All files written successfully to ${outputPath}`);
  } catch (error) {
    console.error('Error writing output files:', error);
    throw error;
  }
}

/**
 * Create a directory if it doesn't exist
 * @param {string} dirPath - Directory path to create
 * @returns {Promise<void>}
 */
async function createDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Write a component file
 * @param {Object} component - Component data with outputPath and reactComponent
 * @param {string} basePath - Base output path
 * @returns {Promise<void>}
 */
async function writeComponentFile(component, basePath) {
  await writeFile(component.outputPath, component.reactComponent);
}

/**
 * Write a file, creating parent directories if needed
 * @param {string} filePath - Path to write file
 * @param {string} content - File content
 * @returns {Promise<void>}
 */
async function writeFile(filePath, content) {
  // Create parent directory if it doesn't exist
  const dir = path.dirname(filePath);
  await createDirectory(dir);
  
  // Write the file
  await fs.writeFile(filePath, content, 'utf-8');
  console.log(`File written: ${filePath}`);
}

/**
 * Create a basic package.json file for the React project
 * @param {string} outputPath - Output path for the React project
 * @returns {Promise<void>}
 */
async function createPackageJson(outputPath) {
  const packageJson = {
    name: "angular-to-react-conversion",
    version: "1.0.0",
    private: true,
    dependencies: {
      "react": "^18.2.0",
      "react-dom": "^18.2.0",
      "react-router-dom": "^6.15.0",
      "axios": "^1.4.0"
    },
    devDependencies: {
      "@babel/core": "^7.22.11",
      "@babel/preset-env": "^7.22.10",
      "@babel/preset-react": "^7.22.5",
      "babel-loader": "^9.1.3",
      "css-loader": "^6.8.1",
      "html-webpack-plugin": "^5.5.3",
      "style-loader": "^3.3.3",
      "webpack": "^5.88.2",
      "webpack-cli": "^5.1.4",
      "webpack-dev-server": "^4.15.1"
    },
    scripts: {
      "start": "webpack serve --mode development --open",
      "build": "webpack --mode production"
    }
  };
  
  await writeFile(
    path.join(outputPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

/**
 * Create a basic index.js file for the React project
 * @param {string} outputPath - Output path for the React project
 * @returns {Promise<void>}
 */
async function createIndexJs(outputPath) {
  const indexJs = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  
  await writeFile(path.join(outputPath, 'index.js'), indexJs);
  
  // Also create a simple HTML template
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>React App (Converted from Angular)</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;
  
  await writeFile(path.join(outputPath, 'index.html'), indexHtml);
}

module.exports = { writeOutputFiles };








=======================================









// src/converters/router-converter.js
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generate React Router structure from Angular routing modules
 * @param {Array} routingModules - Array of Angular routing modules
 * @param {Array} convertedComponents - Array of converted React components
 * @param {Object} options - Conversion options including OpenAI API key
 * @returns {Promise<Object>} - React Router structure files
 */
async function generateRouterStructure(routingModules, convertedComponents, options) {
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: options.openAiApiKey || process.env.OPENAI_API_KEY
  });

  if (!openai.apiKey) {
    throw new Error('OpenAI API key is required. Provide it in options or set OPENAI_API_KEY environment variable.');
  }

  // Find the main routing module (usually app-routing.module.ts)
  const mainRoutingModule = findMainRoutingModule(routingModules);
  if (!mainRoutingModule) {
    console.warn('Main routing module not found. Creating a basic router configuration.');
    return generateBasicRouterConfig(convertedComponents, options.outputPath);
  }

  console.log(`Generating router structure from ${path.basename(mainRoutingModule.path)}`);

  try {
    // Read all routing module contents
    const modulesWithContent = await Promise.all(
      routingModules.map(async (module) => ({
        ...module,
        content: await fs.readFile(module.path, 'utf-8')
      }))
    );

    // Map component paths to their converted React components
    const componentMap = convertedComponents.reduce((map, component) => {
      const originalName = path.basename(component.originalComponent.basePath);
      map[originalName] = {
        name: originalName,
        reactPath: path.relative(options.outputPath, component.outputPath).replace(/\\/g, '/').replace(/\.jsx$/, '')
      };
      return map;
    }, {});

    // Prepare the prompt for OpenAI
    const prompt = generateRouterConversionPrompt(modulesWithContent, componentMap);

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: options.openAiModel || 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'You are an expert developer specializing in converting Angular routing to React Router. Provide only valid JavaScript code without explanations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 3000
    });

    // Extract the conversion result
    const conversionResult = response.choices[0].message.content.trim();
    
    // Clean up the response to extract clean code
    const routerCode = cleanRouterCode(conversionResult);

    // Create the App.js with router configuration
    const appJsContent = generateAppJsWithRouter(routerCode);

    return {
      router: {
        code: routerCode,
        outputPath: path.join(options.outputPath, 'router.js')
      },
      app: {
        code: appJsContent,
        outputPath: path.join(options.outputPath, 'App.js')
      }
    };

  } catch (error) {
    console.error('Error generating router structure:', error);
    // Return a basic router configuration as fallback
    return generateBasicRouterConfig(convertedComponents, options.outputPath);
  }
}

/**
 * Find the main routing module in an Angular project
 * @param {Array} routingModules - Array of routing modules
 * @returns {Object|null} - Main routing module or null if not found
 */
function findMainRoutingModule(routingModules) {
  // Look for app-routing.module.ts
  const appRoutingModule = routingModules.find(module => 
    module.path.includes('app-routing.module.ts')
  );
  
  if (appRoutingModule) {
    return appRoutingModule;
  }
  
  // If not found, use the first routing module
  if (routingModules.length > 0) {
    return routingModules[0];
  }
  
  return null;
}

/**
 * Generate a prompt for OpenAI to convert Angular routing to React Router
 * @param {Array} routingModules - Array of routing modules with content
 * @param {Object} componentMap - Map of component names to their React paths
 * @returns {string} - Prompt for OpenAI
 */
function generateRouterConversionPrompt(routingModules, componentMap) {
  // Create a string with all routing module contents
  const routingModulesStr = routingModules
    .map(module => `FILE: ${path.basename(module.path)}\n\`\`\`typescript\n${module.content}\n\`\`\``)
    .join('\n\n');
  
  // Create a string with component mapping info
  const componentMapStr = Object.entries(componentMap)
    .map(([key, value]) => `"${key}": "${value.reactPath}"`)
    .join(',\n  ');

  return `Convert the following Angular routing modules to React Router v6 configuration:

${routingModulesStr}

Here's a mapping of Angular component names to their React component paths:
\`\`\`json
{
  ${componentMapStr}
}
\`\`\`

Follow these conversion guidelines:
1. Create a React Router v6 configuration file
2. Convert Angular routes to React Router routes
3. Handle nested routes appropriately
4. Convert route guards to React Router protection patterns
5. Handle lazy loading patterns if present
6. Use the provided component mapping to import the correct React components
7. Create a clean, well-structured router configuration file
8. Return only the complete React Router configuration as a JavaScript file.`;
}

/**
 * Clean the OpenAI response to extract clean router code
 * @param {string} response - OpenAI response
 * @returns {string} - Clean router code
 */
function cleanRouterCode(response) {
  // Extract code from markdown code blocks if present
  let code = response;
  
  const codeBlockMatch = response.match(/```(?:jsx?|tsx?|react)?\s*([\s\S]+?)```/);
  if (codeBlockMatch) {
    code = codeBlockMatch[1].trim();
  }
  
  return code;
}

/**
 * Generate a basic router configuration as fallback
 * @param {Array} convertedComponents - Array of converted React components
 * @param {string} outputPath - Output path for React project
 * @returns {Object} - Basic router configuration files
 */
function generateBasicRouterConfig(convertedComponents, outputPath) {
  // Create imports for all components
  const imports = convertedComponents.map(component => {
    const componentName = path.basename(component.originalComponent.basePath);
    const relativePath = path.relative(outputPath, component.outputPath)
      .replace(/\\/g, '/')
      .replace(/\.jsx$/, '');
    return `import ${componentName} from './${relativePath}';`;
  }).join('\n');
  
  // Create routes for all components
  const routes = convertedComponents.map(component => {
    const componentName = path.basename(component.originalComponent.basePath);
    const routePath = `/${componentName.toLowerCase()}`;
    return `    { path: '${routePath}', element: <${componentName} /> }`;
  }).join(',\n');
  
  // Create router code
  const routerCode = `import { createBrowserRouter } from 'react-router-dom';
${imports}

const router = createBrowserRouter([
    { path: '/', element: <div>Home Page</div> },
${routes}
]);

export default router;`;

  // Create App.js with router
  const appJsContent = generateAppJsWithRouter('router');

  return {
    router: {
      code: routerCode,
      outputPath: path.join(outputPath, 'router.js')
    },
    app: {
      code: appJsContent,
      outputPath: path.join(outputPath, 'App.js')
    }
  };
}

/**
 * Generate App.js with router configuration
 * @param {string} routerCode - Router configuration code
 * @returns {string} - App.js content
 */
function generateAppJsWithRouter(routerCode) {
  return `import React from 'react';
import { RouterProvider } from 'react-router-dom';
import router from './router';

function App() {
  return (
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}

export default App;`;
}

module.exports = { generateRouterStructure };



==============================================================================


// src/converters/pipe-converter.js
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');

/**
 * Convert Angular pipes to JavaScript functions
 * @param {Array} pipes - Array of Angular pipes
 * @param {Object} options - Conversion options including OpenAI API key
 * @returns {Promise<Array>} - Converted React pipes as utility functions
 */
async function convertPipes(pipes, options) {
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: options.openAiApiKey || process.env.OPENAI_API_KEY
  });

  if (!openai.apiKey) {
    throw new Error('OpenAI API key is required. Provide it in options or set OPENAI_API_KEY environment variable.');
  }

  const convertedPipes = [];

  for (const pipe of pipes) {
    console.log(`Converting pipe: ${path.basename(pipe.path)}`);

    try {
      // Read pipe content
      const pipeContent = await fs.readFile(pipe.path, 'utf-8');

      // Prepare the prompt for OpenAI
      const prompt = generatePipeConversionPrompt(pipe.path, pipeContent);

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: options.openAiModel || 'gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are an expert developer specializing in converting Angular pipes to JavaScript utility functions. Provide only valid JavaScript code without explanations.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2000
      });

      // Extract the conversion result
      const conversionResult = response.choices[0].message.content.trim();
      
      // Clean up the response to extract clean code
      const jsFunction = cleanJsCode(conversionResult);

      // Add to converted pipes list
      convertedPipes.push({
        originalPath: pipe.path,
        jsFunction,
        outputPath: generatePipeOutputPath(pipe.path, options.outputPath)
      });

    } catch (error) {
      console.error(`Error converting pipe ${pipe.path}:`, error);
      // Add a placeholder for failed conversions
      convertedPipes.push({
        originalPath: pipe.path,
        jsFunction: `// Error converting pipe: ${path.basename(pipe.path)}\n// ${error.message}`,
        outputPath: generatePipeOutputPath(pipe.path, options.outputPath),
        error: error.message
      });
    }
  }

  return convertedPipes;
}

/**
 * Generate a prompt for OpenAI to convert an Angular pipe
 * @param {string} pipePath - Path to the Angular pipe
 * @param {string} pipeContent - Content of the Angular pipe
 * @returns {string} - Prompt for OpenAI
 */
function generatePipeConversionPrompt(pipePath, pipeContent) {
  return `Convert the following Angular pipe to a JavaScript utility function:

PIPE FILE (${path.basename(pipePath)}):
\`\`\`typescript
${pipeContent}
\`\`\`

Follow these conversion guidelines:
1. Convert the pipe's transform method to a pure JavaScript function
2. Maintain the same functionality and parameters
3. Make sure the function handles all the pipe's use cases
4. Create a named export for the function
5. Return only the complete JavaScript utility function code with appropriate JSDoc comments.`;
}

/**
 * Clean the OpenAI response to extract clean JavaScript code
 * @param {string} response - OpenAI response
 * @returns {string} - Clean JavaScript code
 */
function cleanJsCode(response) {
  // Extract code from markdown code blocks if present
  let code = response;
  
  const codeBlockMatch = response.match(/```(?:js|javascript)?\s*([\s\S]+?)```/);
  if (codeBlockMatch) {
    code = codeBlockMatch[1].trim();
  }
  
  return code;
}

/**
 * Generate output path for a pipe converted to JavaScript function
 * @param {string} pipePath - Original Angular pipe path
 * @param {string} outputBasePath - Base output path for React project
 * @returns {string} - Output path for JavaScript utility function
 */
function generatePipeOutputPath(pipePath, outputBasePath) {
  // Get the relative path from src
  const srcIndex = pipePath.indexOf('/src/');
  if (srcIndex === -1) {
    const baseName = path.basename(pipePath, '.pipe.ts');
    return path.join(outputBasePath, 'utils', baseName + '.js');
  }
  
  const relativePath = pipePath.substring(srcIndex + 5); // Remove /src/ prefix
  
  // Convert to React utils path convention
  const dirName = path.dirname(relativePath);
  const baseName = path.basename(relativePath, '.pipe.ts');
  
  return path.join(outputBasePath, dirName, baseName + '.js');
}

module.exports = { convertPipes };



==============================================================================================






// src/converters/service-converter.js
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');

/**
 * Convert Angular services to React hooks/contexts
 * @param {Array} services - Array of Angular services
 * @param {Object} options - Conversion options including OpenAI API key
 * @returns {Promise<Array>} - Converted React services
 */
async function convertServices(services, options) {
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: options.openAiApiKey || process.env.OPENAI_API_KEY
  });

  if (!openai.apiKey) {
    throw new Error('OpenAI API key is required. Provide it in options or set OPENAI_API_KEY environment variable.');
  }

  const convertedServices = [];

  for (const service of services) {
    console.log(`Converting service: ${path.basename(service.path)}`);

    try {
      // Read service content
      const serviceContent = await fs.readFile(service.path, 'utf-8');

      // Prepare the prompt for OpenAI
      const prompt = generateServiceConversionPrompt(service.path, serviceContent);

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: options.openAiModel || 'gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are an expert developer specializing in converting Angular services to React hooks or context. Provide only valid JavaScript code without explanations.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 3000
      });

      // Extract the conversion result
      const conversionResult = response.choices[0].message.content.trim();
      
      // Clean up the response to extract clean code
      const reactCode = cleanReactCode(conversionResult);
      
      // Determine if we should create a hook or context
      const isContextProvider = shouldBeContextProvider(serviceContent);
      
      // Add to converted services list
      convertedServices.push({
        originalPath: service.path,
        reactCode,
        outputPath: generateServiceOutputPath(service.path, options.outputPath, isContextProvider),
        isContextProvider
      });

    } catch (error) {
      console.error(`Error converting service ${service.path}:`, error);
      // Add a placeholder for failed conversions
      convertedServices.push({
        originalPath: service.path,
        reactCode: `// Error converting service: ${path.basename(service.path)}\n// ${error.message}`,
        outputPath: generateServiceOutputPath(service.path, options.outputPath),
        error: error.message
      });
    }
  }

  return convertedServices;
}

/**
 * Generate a prompt for OpenAI to convert an Angular service
 * @param {string} servicePath - Path to the Angular service
 * @param {string} serviceContent - Content of the Angular service
 * @returns {string} - Prompt for OpenAI
 */
function generateServiceConversionPrompt(servicePath, serviceContent) {
  return `Convert the following Angular service to a React custom hook or Context provider:

SERVICE FILE (${path.basename(servicePath)}):
\`\`\`typescript
${serviceContent}
\`\`\`

Follow these conversion guidelines:
1. If the service manages state that needs to be shared between components, convert it to a React Context provider
2. If the service provides utility functions or API calls, convert it to a custom React hook
3. Convert HttpClient calls to fetch or axios
4. Convert Observable patterns to async/await or Promise-based code
5. Convert state management to React useState or useReducer hooks
6. Return only the complete React hook or Context code as a JavaScript file.`;
}

/**
 * Clean the OpenAI response to extract clean React code
 * @param {string} response - OpenAI response
 * @returns {string} - Clean React code
 */
function cleanReactCode(response) {
  // Extract code from markdown code blocks if present
  let code = response;
  
  const codeBlockMatch = response.match(/```(?:jsx?|tsx?|react)?\s*([\s\S]+?)```/);
  if (codeBlockMatch) {
    code = codeBlockMatch[1].trim();
  }
  
  return code;
}

/**
 * Determine if a service should be converted to a Context provider
 * @param {string} serviceContent - Content of the Angular service
 * @returns {boolean} - True if should be Context provider
 */
function shouldBeContextProvider(serviceContent) {
  // Simple heuristic - check if service likely manages state
  const stateIndicators = [
    'BehaviorSubject',
    'Subject',
    'ReplaySubject',
    'Observable',
    'subscribe',
    'private _',
    'state',
    'store',
    'private data'
  ];
  
  return stateIndicators.some(indicator => serviceContent.includes(indicator));
}

/**
 * Generate output path for a React service
 * @param {string} servicePath - Original Angular service path
 * @param {string} outputBasePath - Base output path for React project
 * @param {boolean} isContextProvider - Whether it's a context provider
 * @returns {string} - Output path for React service
 */
function generateServiceOutputPath(servicePath, outputBasePath, isContextProvider = false) {
  // Get the relative path from src
  const srcIndex = servicePath.indexOf('/src/');
  if (srcIndex === -1) {
    const baseName = path.basename(servicePath, '.service.ts');
    const suffix = isContextProvider ? '.context.js' : '.hooks.js';
    return path.join(outputBasePath, 'services', baseName + suffix);
  }
  
  const relativePath = servicePath.substring(srcIndex + 5); // Remove /src/ prefix
  
  // Change extension based on whether it's a context or hook
  const dirName = path.dirname(relativePath);
  const baseName = path.basename(relativePath, '.service.ts');
  const suffix = isContextProvider ? '.context.js' : '.hooks.js';
  
  return path.join(outputBasePath, dirName, baseName + suffix);
}

module.exports = { convertServices };










=================================================





// src/converters/component-converter.js
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');

/**
 * Convert Angular components to React components using OpenAI
 * @param {Array} groupedComponents - Array of grouped component files
 * @param {Object} options - Conversion options including OpenAI API key
 * @returns {Promise<Array>} - Converted React components
 */
async function convertComponents(groupedComponents, options) {
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: options.openAiApiKey || process.env.OPENAI_API_KEY
  });

  if (!openai.apiKey) {
    throw new Error('OpenAI API key is required. Provide it in options or set OPENAI_API_KEY environment variable.');
  }

  const convertedComponents = [];

  for (const component of groupedComponents) {
    console.log(`Converting component: ${component.name}`);

    try {
      // Prepare the prompt for OpenAI
      const prompt = generateComponentConversionPrompt(component);

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: options.openAiModel || 'gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are an expert developer specializing in converting Angular components to React components. Provide only valid JavaScript/JSX code without explanations.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 4000
      });

      // Extract the conversion result
      const conversionResult = response.choices[0].message.content.trim();
      
      // Clean up the response to extract clean code
      const reactCode = cleanReactCode(conversionResult);

      // Add to converted components list
      convertedComponents.push({
        originalComponent: component,
        reactComponent: reactCode,
        outputPath: generateOutputPath(component.basePath, options.outputPath)
      });

    } catch (error) {
      console.error(`Error converting component ${component.name}:`, error);
      // Add a placeholder for failed conversions
      convertedComponents.push({
        originalComponent: component,
        reactComponent: `// Error converting component: ${component.name}\n// ${error.message}`,
        outputPath: generateOutputPath(component.basePath, options.outputPath),
        error: error.message
      });
    }
  }

  return convertedComponents;
}

/**
 * Generate a prompt for OpenAI to convert an Angular component
 * @param {Object} component - Angular component data
 * @returns {string} - Prompt for OpenAI
 */
function generateComponentConversionPrompt(component) {
  return `Convert the following Angular component to a React functional component using hooks:

COMPONENT TS FILE (${path.basename(component.component.path)}):
\`\`\`typescript
${component.component.content}
\`\`\`

${component.template ? `HTML TEMPLATE (${path.basename(component.template.path)}):
\`\`\`html
${component.template.content}
\`\`\`` : 'NO HTML TEMPLATE'}

${component.style ? `STYLES (${path.basename(component.style.path)}):
\`\`\`scss
${component.style.content}
\`\`\`` : 'NO STYLES'}

Follow these conversion guidelines:
1. Convert to functional component with React hooks
2. Convert Angular lifecycle hooks to appropriate React hooks
3. Convert input/output decorators to props
4. Convert services injections to imports and React hooks
5. Convert Angular template syntax to JSX
6. Convert Angular bindings ([property], (event)) to React props and event handlers
7. Convert ngIf to conditional rendering
8. Convert ngFor to Array.map()
9. Convert Angular pipes to JavaScript functions
10. Import necessary hooks from React
11. Use CSS modules or styled-components for styles
12. Add proper prop-types
13. Return only the complete React component code as a JavaScript file that uses JSX.`;
}

/**
 * Clean the OpenAI response to extract clean React code
 * @param {string} response - OpenAI response
 * @returns {string} - Clean React code
 */
function cleanReactCode(response) {
  // Extract code from markdown code blocks if present
  let code = response;
  
  const codeBlockMatch = response.match(/```(?:jsx?|tsx?|react)?\s*([\s\S]+?)```/);
  if (codeBlockMatch) {
    code = codeBlockMatch[1].trim();
  }
  
  return code;
}

/**
 * Generate output path for a React component
 * @param {string} basePath - Original Angular component base path
 * @param {string} outputBasePath - Base output path for React project
 * @returns {string} - Output path for React component
 */
function generateOutputPath(basePath, outputBasePath) {
  // Get the relative path from src
  const srcIndex = basePath.indexOf('/src/');
  if (srcIndex === -1) {
    return path.join(outputBasePath, path.basename(basePath) + '.jsx');
  }
  
  const relativePath = basePath.substring(srcIndex + 5); // Remove /src/ prefix
  
  // Convert to React path convention
  return path.join(outputBasePath, relativePath + '.jsx');
}

module.exports = { convertComponents };




====================================



// src/grouper.js
const path = require('fs').promises;

/**
 * Group component files (.ts, .html, .scss) based on their base names
 * @param {Array} classifiedFiles - Array of classified files
 * @returns {Promise<Array>} - Grouped component files
 */
async function groupComponentFiles(classifiedFiles) {
  const components = classifiedFiles.filter(file => file.type === 'component');
  const templates = classifiedFiles.filter(file => file.type === 'template');
  const styles = classifiedFiles.filter(file => file.type === 'style');
  
  const groupedComponents = [];
  
  for (const component of components) {
    const componentPath = component.path;
    const basePath = componentPath.replace('.component.ts', '');
    
    // Find matching template
    const template = templates.find(t => 
      t.path.startsWith(basePath) && 
      (t.path.endsWith('.component.html') || t.path === `${basePath}.html`)
    );
    
    // Find matching style files (could be .scss or .css)
    const style = styles.find(s => 
      s.path.startsWith(basePath) && 
      (s.path.endsWith('.component.scss') || 
       s.path.endsWith('.component.css') || 
       s.path === `${basePath}.scss` || 
       s.path === `${basePath}.css`)
    );
    
    // Read the content of each file
    const componentContent = await readFileContent(componentPath);
    const templateContent = template ? await readFileContent(template.path) : '';
    const styleContent = style ? await readFileContent(style.path) : '';
    
    // Get component name from path
    const componentName = path.basename(basePath);
    
    groupedComponents.push({
      name: componentName,
      basePath,
      component: {
        path: componentPath,
        content: componentContent
      },
      template: template ? {
        path: template.path,
        content: templateContent
      } : null,
      style: style ? {
        path: style.path,
        content: styleContent
      } : null
    });
  }
  
  console.log(`Grouping complete: Found ${groupedComponents.length} components`);
  return groupedComponents;
}

/**
 * Read content of a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - File content
 */
async function readFileContent(filePath) {
  try {
    return await path.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`);
    return '';
  }
}

module.exports = { groupComponentFiles };








===========================================







// src/scanner.js
const fs = require('fs').promises;
const path = require('path');

/**
 * Recursively scan a directory and classify Angular files
 * @param {string} dir - Directory to scan
 * @param {Array} results - Accumulator for results
 * @returns {Promise<Array>} - Classified files
 */
async function scanDirectory(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and dist directories
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        await scanDirectory(fullPath, results);
      }
    } else {
      const fileInfo = classifyFile(fullPath);
      if (fileInfo) {
        results.push(fileInfo);
      }
    }
  }
  
  return results;
}

/**
 * Classify an Angular file based on its path and name
 * @param {string} filePath - Path to the file
 * @returns {Object|null} - Classified file info or null if not relevant
 */
function classifyFile(filePath) {
  const ext = path.extname(filePath);
  const fileName = path.basename(filePath);
  
  // Only process TypeScript, HTML, and SCSS files
  if (!['.ts', '.html', '.scss', '.css'].includes(ext)) {
    return null;
  }
  
  let type = null;
  
  if (ext === '.ts') {
    if (fileName.endsWith('.component.ts')) {
      type = 'component';
    } else if (fileName.endsWith('.service.ts')) {
      type = 'service';
    } else if (fileName.endsWith('.pipe.ts')) {
      type = 'pipe';
    } else if (fileName.endsWith('.module.ts')) {
      type = 'module';
    } else if (fileName.endsWith('.directive.ts')) {
      type = 'directive';
    } else if (fileName.endsWith('.guard.ts')) {
      type = 'guard';
    } else if (fileName.endsWith('.interceptor.ts')) {
      type = 'interceptor';
    } else if (fileName.includes('model') || fileName.includes('interface') || fileName.includes('.type.')) {
      type = 'model';
    } else {
      type = 'other-ts';
    }
  } else if (ext === '.html') {
    type = 'template';
  } else if (ext === '.scss' || ext === '.css') {
    type = 'style';
  }
  
  return { path: filePath, type };
}

/**
 * Scan an Angular project and classify all files
 * @param {string} projectPath - Path to the Angular project
 * @returns {Promise<Array>} - Classified files
 */
async function scanProject(projectPath) {
  try {
    // Verify the project path exists
    await fs.access(projectPath);
    
    // Scan the project directory
    const classifiedFiles = await scanDirectory(projectPath);
    
    console.log(`Scan complete: Found ${classifiedFiles.length} relevant files`);
    return classifiedFiles;
  } catch (error) {
    console.error(`Error scanning project: ${error.message}`);
    throw error;
  }
}

module.exports = { scanProject };









=================================================






// src/index.js
const fs = require('fs').promises;
const path = require('path');
const { scanProject } = require('./scanner');
const { groupComponentFiles } = require('./grouper');
const { convertComponents } = require('./converters/component-converter');
const { convertServices } = require('./converters/service-converter');
const { convertPipes } = require('./converters/pipe-converter');
const { generateRouterStructure } = require('./converters/router-converter');
const { writeOutputFiles } = require('./writer');

/**
 * Main function to convert an Angular project to React
 * @param {string} angularProjectPath - Path to the Angular project
 * @param {string} outputPath - Path to output the React project
 * @param {Object} options - Additional options for conversion
 * @returns {Promise<void>}
 */
async function convertAngularToReact(angularProjectPath, outputPath, options = {}) {
  try {
    console.log('Starting Angular to React conversion...');
    
    // Step 1: Scan Angular project and classify files
    console.log('Scanning Angular project...');
    const classifiedFiles = await scanProject(angularProjectPath);
    
    // Step 2: Group component files (.ts, .html, .scss)
    console.log('Grouping component files...');
    const groupedComponents = await groupComponentFiles(classifiedFiles);
    
    // Step 3: Convert components using OpenAI
    console.log('Converting components...');
    const convertedComponents = await convertComponents(groupedComponents, options);
    
    // Step 4: Convert services to JS modules or React Context
    console.log('Converting services...');
    const services = classifiedFiles.filter(file => file.type === 'service');
    const convertedServices = await convertServices(services, options);
    
    // Step 5: Convert pipes to JS functions
    console.log('Converting pipes...');
    const pipes = classifiedFiles.filter(file => file.type === 'pipe');
    const convertedPipes = await convertPipes(pipes, options);
    
    // Step 6: Generate React Router structure from routing modules
    console.log('Generating router structure...');
    const routingModules = classifiedFiles.filter(file => 
      file.type === 'module' && file.path.includes('routing')
    );
    const routerStructure = await generateRouterStructure(routingModules, convertedComponents, options);
    
    // Step 7: Output all converted files into the react-app/ directory
    console.log('Writing output files...');
    await writeOutputFiles(
      outputPath,
      convertedComponents,
      convertedServices,
      convertedPipes,
      routerStructure,
      options
    );
    
    console.log('Conversion completed successfully!');
  } catch (error) {
    console.error('Error during conversion:', error);
    throw error;
  }
}

module.exports = { convertAngularToReact };

