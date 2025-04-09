// angularjs-to-react-converter/src/index.ts
import { writeOutputFiles } from './writer';
import path from 'path';
import fs from 'fs';

// Hardcoded paths for the project
const ANGULARJS_PROJECT_PATH = './angularjs-project';
const REACT_OUTPUT_PATH = './react-app';

async function main() {
  try {c
    console.log('Starting AngularJS to React conversion process...');
    
    // Step 1: Scan AngularJS project and classify files
    console.log('Scanning AngularJS project...');
    const files = await scanAngularJSProject(ANGULARJS_PROJECT_PATH);
    console.log(`Found ${files.length} files to process`);
    
    // Step 2: Group related files
    console.log('Grouping and categorizing files...');
    const groupedFiles = groupAngularJSFiles(files);
    
    // Ensure output directory exists
    if (!fs.existsSync(REACT_OUTPUT_PATH)) {
      fs.mkdirSync(REACT_OUTPUT_PATH, { recursive: true });
    }
    
    // Step 3: Convert controllers to React components
    console.log('Converting controllers to React components...');
    const convertedControllers = await convertControllers(groupedFiles.controllers);
    
    // Step 4: Convert directives to React components
    console.log('Converting directives to React components...');
    const convertedDirectives = await convertDirectives(groupedFiles.directives);
    
    // Step 5: Convert services to JS modules or React Context
    console.log('Converting services...');
    const convertedServices = await convertServices(groupedFiles.services);
    
    // Step 6: Convert filters to JS functions
    console.log('Converting filters...');
    const convertedFilters = await convertFilters(groupedFiles.filters);
    
    // Step 7: Generate React Router structure from ngRoute or ui-router
    console.log('Generating React Router structure...');
    const routerConfig = await generateReactRouter(groupedFiles.routeConfigs);
    
    // Step 8: Output all converted files
    console.log('Writing output files...');
    await writeOutputFiles({
      components: [...convertedControllers, ...convertedDirectives],
      services: convertedServices,
      filters: convertedFilters,
      router: routerConfig
    }, REACT_OUTPUT_PATH);
    
    console.log('Conversion completed successfully!');
  } catch (error) {
    console.error('Conversion failed:', error);
    process.exit(1);
  }
}

main();

// scanner.ts
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export interface AngularJSFile {
  path: string;
  type: 'controller' | 'directive' | 'service' | 'filter' | 'config' | 'route' | 'html' | 'js' | 'css' | 'unknown';
  content?: string;
  moduleName?: string;
}

export async function scanAngularJSProject(projectPath: string): Promise<AngularJSFile[]> {
  const files: AngularJSFile[] = [];
  
  async function scanDirectory(dirPath: string) {
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('node_modules') && !entry.name.startsWith('.')) {
          await scanDirectory(fullPath);
        }
      } else {
        if (entry.name.endsWith('.js') || entry.name.endsWith('.html') || 
            entry.name.endsWith('.css') || entry.name.endsWith('.less') || 
            entry.name.endsWith('.scss')) {
          
          const content = fs.readFileSync(fullPath, 'utf-8');
          const fileType = classifyAngularJSFile(fullPath, content);
          
          files.push({
            path: fullPath,
            type: fileType,
            content: content,
            moduleName: extractModuleName(content, fileType)
          });
        }
      }
    }
  }
  
  await scanDirectory(projectPath);
  return files;
}

function classifyAngularJSFile(filePath: string, content: string): AngularJSFile['type'] {
  const fileName = path.basename(filePath).toLowerCase();
  
  if (filePath.endsWith('.html')) return 'html';
  if (filePath.endsWith('.css') || filePath.endsWith('.scss') || filePath.endsWith('.less')) return 'css';
  
  // For JavaScript files, try to determine the AngularJS type based on content
  if (filePath.endsWith('.js')) {
    // Check for controller
    if (content.includes('.controller(') || 
        content.includes('$controller') || 
        fileName.includes('controller')) {
      return 'controller';
    }
    
    // Check for directive
    if (content.includes('.directive(') || 
        content.includes('$compile') || 
        fileName.includes('directive')) {
      return 'directive';
    }
    
    // Check for service/factory/provider
    if (content.includes('.service(') || 
        content.includes('.factory(') || 
        content.includes('.provider(') || 
        fileName.includes('service') || 
        fileName.includes('factory') || 
        fileName.includes('provider')) {
      return 'service';
    }
    
    // Check for filter
    if (content.includes('.filter(') || fileName.includes('filter')) {
      return 'filter';
    }
    
    // Check for config
    if (content.includes('.config(')) {
      return 'config';
    }
    
    // Check for route config
    if (content.includes('$routeProvider') || 
        content.includes('$stateProvider') || 
        fileName.includes('route') || 
        fileName.includes('routes')) {
      return 'route';
    }
    
    // Default for JS files we can't specifically identify
    return 'js';
  }/
  
  return 'unknown';
}

function extractModuleName(content: string, fileType: AngularJSFile['type']): string | undefined {
  // Try to extract the module name from angular.module(...) declaration
  const moduleMatch = content.match(/angular\.module\(['"]([^'"]+)['"]/);
  if (moduleMatch && moduleMatch[1]) {
    return moduleMatch[1];
  }
  
  return undefined;
}



export interface DirectiveGroup {
  directive: AngularJSFile;
  template?: AngularJSFile;
  css?: AngularJSFile;
  name?: string;
}

export interface ControllerGroup {
  controller: AngularJSFile;
  template?: AngularJSFile;t
  css?: AngularJSFile;
  name?: string;
}

export interface GroupedFiles {
  controllers: ControllerGroup[];
  directives: DirectiveGroup[];
  services: AngularJSFile[];
  filters: AngularJSFile[];
  routeConfigs: AngularJSFile[];
  configs: AngularJSFile[];
  others: AngularJSFile[]
}

export function groupAngularJSFiles(files: AngularJSFile[]): GroupedFiles {
  const result: GroupedFiles = {
    controllers: [],
    directives: [],
    services: [],
    filters: [],
    routeConfigs: [],
    configs: [],
    others: []
  };
  
  // First, separate files by type
  const controllers = files.filter(f => f.type === 'controller');
  const directives = files.filter(f => f.type === 'directive');
  const htmlFiles = files.filter(f => f.type === 'html');
  const cssFiles = files.filter(f => f.type === 'css');
  
  // Add services, filters, and routes directly
  result.services = files.filter(f => f.type === 'service');
  result.filters = files.filter(f => f.type === 'filter');
  result.routeConfigs = files.filter(f => f.type === 'route');
  result.configs = files.filter(f => f.type === 'config');
  
  // Collect other files
  result.others = files.filter(f => 
    f.type !== 'controller' && 
    f.type !== 'directive' && 
    f.type !== 'service' && 
    f.type !== 'filter' && 
    f.type !== 'route' && 
    f.type !== 'config' && 
    f.type !== 'html' && 
    f.type !== 'css'
  );
  
  // Group controllers with their templates (based on naming conventions and content)
  controllers.forEach(controller => {
    const controllerName = extractNameFromAngularJSFile(controller);
    const baseName = path.basename(controller.path, '.js');
    const dirName = path.dirname(controller.path);
    
    // Look for associated template (by naming convention or references in the code)
    let template: AngularJSFile | undefined;
    let css: AngularJSFile | undefined;
    
    // Check for templateUrl in the controller file
    const templateUrlMatch = controller.content?.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/);
    if (templateUrlMatch && templateUrlMatch[1]) {
      const templatePath = templateUrlMatch[1];
      template = htmlFiles.find(html => {
        // Try to match the template URL to an actual file
        const htmlBasePath = html.path.replace(ANGULARJS_PROJECT_PATH, '').replace(/^\//, '');
        return htmlBasePath === templatePath || html.path.endsWith(templatePath);
      });
    }
    
    // If template not found by templateUrl, try naming convention
    if (!template) {
      // Try to find by naming convention (e.g., controller-name.html or views/controller-name.html)
      template = htmlFiles.find(html => {
        const htmlBaseName = path.basename(html.path, '.html');
        return (
          htmlBaseName === baseName || 
          html.path.includes(`/${baseName}.html`) || 
          html.path.includes(`/views/${baseName}.html`) ||
          html.path.includes(`/templates/${baseName}.html`) ||
          html.path.includes(`/partials/${baseName}.html`)
        );
      });
    }
    
    // Look for associated CSS
    css = cssFiles.find(cssFile => {
      const cssBaseName = path.basename(cssFile.path, path.extname(cssFile.path));
      return (
        cssBaseName === baseName || 
        cssFile.path.includes(`/${baseName}.css`) || 
        cssFile.path.includes(`/${baseName}.scss`) || 
        cssFile.path.includes(`/${baseName}.less`)
      );
    });
    
    result.controllers.push({
      controller,
      template,
      css,
      name: controllerName || baseName
    });
  });
  
  // Group directives with their templates
  directives.forEach(directive => {
    const directiveName = extractNameFromAngularJSFile(directive);
    const baseName = path.basename(directive.path, '.js');
    
    // Look for template in the directive (could be inline or templateUrl)
    let template: AngularJSFile | undefined;
    let css: AngularJSFile | undefined;
    
    // Check for templateUrl in the directive file
    const templateUrlMatch = directive.content?.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/);
    if (templateUrlMatch && templateUrlMatch[1]) {
      const templatePath = templateUrlMatch[1];
      template = htmlFiles.find(html => {
        // Try to match the template URL to an actual file
        const htmlBasePath = html.path.replace(ANGULARJS_PROJECT_PATH, '').replace(/^\//, '');
        return htmlBasePath === templatePath || html.path.endsWith(templatePath);
      });
    }
    
    // If template not found by templateUrl, try naming convention
    if (!template) {
      template = htmlFiles.find(html => {
        const htmlBaseName = path.basename(html.path, '.html');
        return (
          htmlBaseName === baseName || 
          html.path.includes(`/${baseName}.html`) || 
          html.path.includes(`/directives/${baseName}.html`) ||
          html.path.includes(`/templates/${baseName}.html`)
        );
      });
    }
    
    // Look for associated CSS
    css = cssFiles.find(cssFile => {
      const cssBaseName = path.basename(cssFile.path, path.extname(cssFile.path));
      return (
        cssBaseName === baseName || 
        cssFile.path.includes(`/${baseName}.css`) || 
        cssFile.path.includes(`/${baseName}.scss`) || 
        cssFile.path.includes(`/${baseName}.less`)
      );
    });
    
    result.directives.push({
      directive,
      template,
      css,
      name: directiveName || baseName
    });
  });
  
  return result;
}

function extractNameFromAngularJSFile(file: AngularJSFile): string | undefined {
  if (file.type === 'controller') {
    // Try to extract controller name
    const match = file.content?.match(/\.controller\(['"]([^'"]+)['"]/);
    if (match && match[1]) {
      return match[1];
    }
  } else if (file.type === 'directive') {
    // Try to extract directive name
    const match = file.content?.match(/\.directive\(['"]([^'"]+)['"]/);
    if (match && match[1]) {
      return match[1];
    }
  } else if (file.type === 'service') {
    // Try to extract service name
    const serviceMatch = file.content?.match(/\.service\(['"]([^'"]+)['"]/);
    const factoryMatch = file.content?.match(/\.factory\(['"]([^'"]+)['"]/);
    const providerMatch = file.content?.match(/\.provider\(['"]([^'"]+)['"]/);
    
    if (serviceMatch && serviceMatch[1]) return serviceMatch[1];
    if (factoryMatch && factoryMatch[1]) return factoryMatch[1];
    if (providerMatch && providerMatch[1]) return providerMatch[1];
  } else if (file.type === 'filter') {
    // Try to extract filter name
    const match = file.content?.match(/\.filter\(['"]([^'"]+)['"]/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return undefined;
}

// converters/controller-converter.ts
import { ControllerGroup } from '../grouper';
import { Configuration, OpenAIApi } from 'openai';
import path from 'path';

// Initialize OpenAI API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export interface ConvertedComponent {
  name: string;
  code: string;
  originalPath: string;
  outputPath: string;
}

export async function convertControllers(controllerGroups: ControllerGroup[]): Promise<ConvertedComponent[]> {
  const convertedComponents: ConvertedComponent[] = [];
  
  for (const group of controllerGroups) {
    console.log(`Converting controller: ${group.name || path.basename(group.controller.path)}`);
    
    try {
      const controllerContent = group.controller.content || '';
      const templateContent = group.template?.content || '';
      const cssContent = group.css?.content || '';
      
      const prompt = `
Convert this AngularJS (Angular 1.x) controller and template to a React functional component:

AngularJS Controller:
\`\`\`javascript
${controllerContent}
\`\`\`

${templateContent ? `AngularJS Template:
\`\`\`html
${templateContent}
\`\`\`` : 'No template found for this controller.'}

${cssContent ? `CSS/SCSS:
\`\`\`css
${cssContent}
\`\`\`` : 'No CSS found for this controller.'}

Please convert this to a React functional component that:
1. Uses React hooks instead of AngularJS controller patterns
2. Replaces $scope with React state and props
3. Converts AngularJS template syntax (ng-repeat, ng-if, ng-model, etc.) to JSX
4. Handles any AngularJS directives appropriately
5. Transforms AngularJS service dependencies (like $http) to appropriate React/JavaScript equivalents
6. Uses modern React patterns and practices
7. Manages CSS appropriately (as CSS modules or inline styles)
8. Makes sure to handle any event bindings and two-way data binding
`;

      const response = await openai.createCompletion({
        model: "gpt-4",
        prompt: prompt,
        max_tokens: 2048,
        temperature: 0.2,
      });

      const reactCode = response.data.choices[0].text?.trim() || '';
      
      // Extract the actual component code from the response
      const codeMatch = reactCode.match(/```(?:jsx|tsx)\s*([\s\S]*?)```/) || 
                        reactCode.match(/```(?:javascript|typescript)\s*([\s\S]*?)```/);
      
      const cleanCode = codeMatch ? codeMatch[1] : reactCode;
      
      // Create output path based on original path
      const controllerName = group.name || path.basename(group.controller.path, '.js');
      const outputPath = `components/${controllerName}.jsx`;
      
      convertedComponents.push({
        name: controllerName,
        code: cleanCode,
        originalPath: group.controller.path,
        outputPath: outputPath
      });
      
    } catch (error) {
      console.error(`Error converting controller ${group.name || group.controller.path}:`, error);
    }
  }
  
  return convertedComponents;
}

// converters/directive-converter.ts
import { DirectiveGroup } from '../grouper';
import { OpenAIApi } from 'openai';
import path from 'path';
import { ConvertedComponent } from './controller-converter';

export async function convertDirectives(directiveGroups: DirectiveGroup[]): Promise<ConvertedComponent[]> {
  const convertedComponents: ConvertedComponent[] = [];
  
  for (const group of directiveGroups) {
    console.log(`Converting directive: ${group.name || path.basename(group.directive.path)}`);
    
    try {
      const directiveContent = group.directive.content || '';
      const templateContent = group.template?.content || '';
      const cssContent = group.css?.content || '';
      
      const prompt = `
Convert this AngularJS (Angular 1.x) directive to a React component:

AngularJS Directive:
\`\`\`javascript
${directiveContent}
\`\`\`

${templateContent ? `Directive Template:
\`\`\`html
${templateContent}
\`\`\`` : 'No template found for this directive.'}

${cssContent ? `CSS/SCSS:
\`\`\`css
${cssContent}
\`\`\`` : 'No CSS found for this directive.'}

Please convert this to a React component that:
1. Uses React hooks or class components as appropriate
2. Properly handles directive's scope/bindings as React props
3. Converts the template to JSX
4. Handles any directive-specific behavior (like link function, compile function)
5. Transforms directive's lifecycle hooks to React lifecycle methods or hooks
6. Uses modern React patterns and practices
7. Manages CSS appropriately (as CSS modules or inline styles)
8. Preserves the original functionality as much as possible
`;

      const openai = new OpenAIApi(configuration);
      const response = await openai.createCompletion({
        model: "gpt-4",
        prompt: prompt,
        max_tokens: 2048,
        temperature: 0.2,
      });

      const reactCode = response.data.choices[0].text?.trim() || '';
      
      // Extract the actual component code from the response
      const codeMatch = reactCode.match(/```(?:jsx|tsx)\s*([\s\S]*?)```/) || 
                        reactCode.match(/```(?:javascript|typescript)\s*([\s\S]*?)```/);
      
      const cleanCode = codeMatch ? codeMatch[1] : reactCode;
      
      // Create output path based on original path
      const directiveName = group.name || path.basename(group.directive.path, '.js');
      // Convert directive name to PascalCase for React component
      const componentName = directiveName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      const pascalCaseName = componentName.charAt(0).toUpperCase() + componentName.slice(1);
      
      const outputPath = `components/${pascalCaseName}.jsx`;
      
      convertedComponents.push({
        name: pascalCaseName,
        code: cleanCode,
        originalPath: group.directive.path,
        outputPath: outputPath
      });
      
    } catch (error) {
      console.error(`Error converting directive ${group.name || group.directive.path}:`, error);
    }
  }
  
  return convertedComponents;
}

// converters/service-converter.ts
import { AngularJSFile } from '../scanner';
import { OpenAIApi } from 'openai';
import path from 'path';

export interface ConvertedService {
  name: string;
  code: string;
  originalPath: string;
  outputPath: string;
}

export async function convertServices(services: AngularJSFile[]): Promise<ConvertedService[]> {
  const convertedServices: ConvertedService[] = [];
  
  for (const service of services) {
    console.log(`Converting service: ${path.basename(service.path)}`);
    
    try {
      const content = service.content || '';
      
      // Determine if this is a service, factory, or provider
      let serviceType = "service";
      if (content.includes(".factory(")) {
        serviceType = "factory";
      } else if (content.includes(".provider(")) {
        serviceType = "provider";
      }
      
      const prompt = `
Convert this AngularJS ${serviceType} to a React/JavaScript equivalent:

AngularJS ${serviceType}:
\`\`\`javascript
${content}
\`\`\`

Please convert this to one of the following based on what makes the most sense:
1. A JavaScript module with exported functions if it's mostly stateless
2. A React Context provider if it manages state
3. A custom React Hook if it provides UI-related functionality
4. A class for complex stateful logic

For AngularJS specific functionality:
- Replace $http with fetch or axios
- Replace $q promises with native JavaScript Promises
- Replace $timeout with setTimeout
- Replace $interval with setInterval
- Handle AngularJS dependency injection by importing the required functionality

Focus on preserving the functionality while using modern JavaScript/React patterns.
`;

      const openai = new OpenAIApi(configuration);
      const response = await openai.createCompletion({
        model: "gpt-4",
        prompt: prompt,
        max_tokens: 1500,
        temperature: 0.2,
      });

      const jsCode = response.data.choices[0].text?.trim() || '';
      
      // Extract code from the response
      const codeMatch = jsCode.match(/```(?:jsx|tsx|javascript|typescript)\s*([\s\S]*?)```/);
      const cleanCode = codeMatch ? codeMatch[1] : jsCode;
      
      // Extract service name from file or content
      let serviceName = path.basename(service.path, '.js');
      const nameMatch = content.match(/\.(service|factory|provider)\(['"]([^'"]+)['"]/);
      if (nameMatch && nameMatch[2]) {
        serviceName = nameMatch[2];
      }
      
      // Determine if it's a context/hook or regular service
      const isContextOrHook = 
        cleanCode.includes('createContext') || 
        cleanCode.includes('useContext') || 
        cleanCode.includes('function use');
      
      // Create output path based on service type
      let outputPath: string;
      if (isContextOrHook) {
        // If it's a context or hook, place in appropriate directory
        outputPath = `hooks/${serviceName}.js`;
      } else {
        // Otherwise, treat as a regular service
        outputPath = `services/${serviceName}.js`;
      }
      
      convertedServices.push({
        name: serviceName,
        code: cleanCode,
        originalPath: service.path,
        outputPath: outputPath
      });
      
    } catch (error) {
      console.error(`Error converting service ${service.path}:`, error);
    }
  }
  
  return convertedServices;
}

// converters/filter-converter.ts
import { AngularJSFile } from '../scanner';
import { OpenAIApi } from 'openai';
import path from 'path';

export interface ConvertedFilter {
  name: string;
  code: string;
  originalPath: string;
  outputPath: string;
}

export async function convertFilters(filters: AngularJSFile[]): Promise<ConvertedFilter[]> {
  const convertedFilters: ConvertedFilter[] = [];
  
  for (const filter of filters) {
    console.log(`Converting filter: ${path.basename(filter.path)}`);
    
    try {
      const content = filter.content || '';
      
      const prompt = `
Convert this AngularJS filter to a JavaScript function:

AngularJS Filter:
\`\`\`javascript
${content}
\`\`\`

Please convert this to:
1. A pure JavaScript function that performs the same transformation
2. Export it as a named export
3. If it has dependencies, handle them appropriately in the JavaScript context
4. Make sure it handles all the same use cases as the original filter
`;

      const openai = new OpenAIApi(configuration);
      const response = await openai.createCompletion({
        model: "gpt-4",
        prompt: prompt,
        max_tokens: 1000,
        temperature: 0.2,
      });

      const jsCode = response.data.choices[0].text?.trim() || '';
      
      // Extract code from the response
      const codeMatch = jsCode.match(/```(?:javascript|typescript)\s*([\s\S]*?)```/);
      const cleanCode = codeMatch ? codeMatch[1] : jsCode;
      
      // Extract filter name
      let filterName = path.basename(filter.path, '.js');
      const nameMatch = content.match(/\.filter\(['"]([^'"]+)['"]/);
      if (nameMatch && nameMatch[1]) {
        filterName = nameMatch[1];
      }
      
      // Create output path
      const outputPath = `utils/filters/${filterName}.js`;
      
      convertedFilters.push({
        name: filterName,
        code: cleanCode,
        originalPath: filter.path,
        outputPath: outputPath
      });
      
    } catch (error) {
      console.error(`Error converting filter ${filter.path}:`, error);
    }
  }
  
  return convertedFilters;
}

// converters/router-converter.ts
import { AngularJSFile } from '../scanner';
import { OpenAIApi } from 'openai';

export interface RouterConfig {
  code: string;
  imports: string[];
}

export async function generateReactRouter(routeConfigs: AngularJSFile[]): Promise<RouterConfig> {
  console.log('Generating React Router configuration...');
  
  if (routeConfigs.length === 0) {
    console.log('No route configurations found, creating basic router setup');
    return {
      code: `
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// You'll need to import your page components here
// import HomePage from './components/HomePage';
// import AboutPage from './components/AboutPage';

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Add your routes here based on your AngularJS routes */}
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/about" element={<div>About Page</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
`,
      imports: ['react-router-dom']
    };
  }
  
  // Combine all route configurations for analysis
  let combinedRouteConfig = '';
  
  for (const config of routeConfigs) {
    combinedRouteConfig += config.content + '\n\n';
  }
  
  // Determine if the app uses ngRoute or ui-router
  const routingType = combinedRouteConfig.includes('$stateProvider') ? 'ui-router' : 'ngRoute';
  
  const prompt = `
Convert this AngularJS routing configuration (using ${routingType}) to React Router v6:

AngularJS Routes:
\`\`\`javascript
${combinedRouteConfig}
\`\`\`

Please:
1. Create a React component that sets up React Router v6
2. Convert all AngularJS routes to equivalent React Router routes
3. Handle any nested routes or states (for ui-router)
4. Handle route parameters
5. If there are resolve properties, suggest how to handle data fetching
6. Map any URL parameters
7. Handle any route authentication logic

The output should be a clean React Router v6 configuration that preserves the original routing structure.
`;

  try {
    const openai = new OpenAIApi(configuration);
    const response = await openai.createCompletion({
      model: "gpt-4",
      prompt: prompt,
      max_tokens: 1500,
      temperature: 0.2,
    });

    const routerCode = response.data.choices[0].text?.trim() || '';
    
    // Extract code from the response
    const codeMatch = routerCode.match(/```(?:jsx|tsx|javascript|typescript)\s*([\s\S]*?)```/);
    const cleanCode = codeMatch ? codeMatch[1] : routerCode;
    
    // Extract imports from the generated code
    const importLines = cleanCode.match(/import.*?from\s+['"].*?['"]/g) || [];
    const imports: string[] = [];
    
    importLines.forEach(line => {
      const match = line.match(/from\s+['"](.+?)['"]/);
      if (match && match[1] && !match[1].startsWith('.')) {
        imports.push(match[1]);
      }
    });
    
    return {
      code: cleanCode,
      imports: [...new Set(imports)] // Remove duplicates
    };
  }
