const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

// In-memory database
let items = [];   // { id, name, description, location, claimId }
let claims = [];  // { id, name, email, phone, password, itemIds: [] }

// --- Routes ---

// Admin Dashboard
app.get('/dashboard', (req, res) => {
  res.render('dashboard', { claims, items });
});

// Scanner Page
app.get('/scan', (req, res) => {
  res.render('scan');
});

// Lookup API
app.get('/lookup/:code', (req, res) => {
  const code = req.params.code;
  const item = items.find(i => i.id === code);
  if (!item) return res.json({ error: 'Item not found' });

  const claim = claims.find(c => c.id === item.claimId) || null;
  res.json({
    item,
    claim
  });
});

// Add claim
app.post('/claims', (req, res) => {
  const { name, email, phone, password } = req.body;
  const claim = { id: uuidv4(), name, email, phone, password, itemIds: [] };
  claims.push(claim);
  res.redirect('/dashboard');
});

// Add item
app.post('/items', (req, res) => {
  const { name, description, location } = req.body;
  const item = { id: uuidv4(), name, description, location, claimId: null };
  items.push(item);
  res.redirect('/dashboard');
});

// Link item to claim
app.post('/link', (req, res) => {
  const { itemId, claimId } = req.body;
  const item = items.find(i => i.id === itemId);
  const claim = claims.find(c => c.id === claimId);
  if (item && claim) {
    item.claimId = claim.id;
    if (!claim.itemIds.includes(item.id)) claim.itemIds.push(item.id);
  }
  res.redirect('/dashboard');
});

// Delete claim
app.post('/delete-claim', (req, res) => {
  const { claimId } = req.body;
  claims = claims.filter(c => c.id !== claimId);
  items.forEach(i => { if (i.claimId === claimId) i.claimId = null; });
  res.redirect('/dashboard');
});

// Edit item
app.post('/edit-item', (req, res) => {
  const { id, name, description, location } = req.body;
  const item = items.find(i => i.id === id);
  if (item) {
    item.name = name;
    item.description = description;
    item.location = location;
  }
  res.redirect('/dashboard');
});

// --- Socket.io for real-time scanning ---
io.on('connection', socket => {
  console.log('Socket connected');

  socket.on('scan', code => {
    console.log('Scanned code:', code);
    io.emit('scan', code); // send to all dashboard clients
  });

  socket.on('disconnect', () => console.log('Socket disconnected'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
