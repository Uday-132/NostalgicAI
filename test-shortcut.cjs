const { app, globalShortcut } = require('electron');

app.whenReady().then(() => {
  // Register a simple shortcut
  const success = globalShortcut.register('F12', () => {
    console.log('F12 Shortcut triggered!');
  });

  if (success) {
    console.log('F12 Shortcut registered successfully');
  } else {
    console.log('Failed to register F12 shortcut');
  }

  // Keep the app running
  setInterval(() => {}, 1000);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});