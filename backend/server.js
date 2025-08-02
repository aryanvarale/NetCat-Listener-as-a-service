const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { path: '/terminal' });

// Only serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  // Fallback to index.html for React Router
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

io.on('connection', (socket) => {
  // Get SSH host from frontend (public DNS or IP)
  const sshHost = socket.handshake.query.host;
  const sshUser = 'ubuntu';
  const keyPath = path.resolve(__dirname, 'netcat-key.pem');

  // Check if key exists
  if (!fs.existsSync(keyPath)) {
    socket.emit('output', 'Server error: SSH key not found.');
    socket.disconnect();
    return;
  }

  // Spawn SSH with PTY
  const ssh = pty.spawn('ssh', [
    '-i', keyPath,
    `${sshUser}@${sshHost}`
  ], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });

  ssh.on('data', (data) => socket.emit('output', data));
  socket.on('input', (data) => ssh.write(data));
  socket.on('resize', ({ cols, rows }) => ssh.resize(cols, rows));
  socket.on('disconnect', () => ssh.kill());
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Node.js SSH server running on port ${PORT}`)); 