import { execSync } from 'child_process';

console.log('Building NostalgicAI projects...');

try {
  // Build the main Electron app
  console.log('Building Electron app...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Build the chatbot
  console.log('Building Chatbot...');
  execSync('npm run build:chat', { stdio: 'inherit' });
  
  console.log('All builds completed successfully!');
  console.log('Outputs:');
  console.log('- Electron app: dist/ and dist-electron/');
  console.log('- Chatbot: dist-chat/');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}