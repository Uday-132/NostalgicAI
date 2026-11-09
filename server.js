const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

// Serve static files from the dist-chat directory
app.use(express.static(path.join(__dirname, 'dist-chat')));

// Serve the chat.html file for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist-chat', 'chat.html'));
});

app.listen(PORT, () => {
  console.log(`NostalgicAI Chatbot server running on http://localhost:${PORT}`);
});