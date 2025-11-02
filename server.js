const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const path = require('path');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// In-memory storage
let items = [];
let claims = [];

// Routes
app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', (req, res) => {
  res.render('dashboard', { items, claims });
});

app.post('/items', (req, res) => {
  const { name, description, location } = req.body;
  if (!name) return res.status(400).send('Name required');
  const id = uuidv4();
  items.push({ id, name, description, location, claimId: null });
  res.redirect('/dashboard');
});

app.post('/claims', (req, res) => {
  const { name, contact, password } = req.body;
  if (!name || !contact) return res.status(400).send('Name and contact required');
  const id = uuidv4();
  claims.push({ id, name, contact, password, items: [] });
  res.redirect('/dashboard');
});

app.post('/link', (req, res) => {
  const { itemId, claimId } = req.body;
  const item = items.find(i => i.id === itemId);
  const claim = claims.find(c => c.id === claimId);
  if (!item || !claim) return res.status(404).send('Item or Claim not found');
  item.claimId = claimId;
  claim.items.push(itemId);
  res.redirect('/dashboard');
});

app.post('/delete-claim', (req, res) => {
  const { id } = req.body;
  claims = claims.filter(c => c.id !== id);
  items.forEach(i => { if (i.claimId === id) i.claimId = null; });
  res.redirect('/dashboard');
});

app.post('/edit-item', (req, res) => {
  const { id, name, description, location } = req.body;
  const item = items.find(i => i.id === id);
  if (!item) return res.status(404).send('Item not found');
  item.name = name; item.description = description; item.location = location;
  res.redirect('/dashboard');
});

app.get('/scan', (req, res) => {
  res.render('scan');
});

app.get('/lookup/:code', (req, res) => {
  const item = items.find(i => i.id === req.params.code);
  if (!item) return res.json({ error: 'Item not found' });
  res.json({ item });
});

// Socket.IO for real-time scans
io.on('connection', socket => {
  socket.on('scan', code => {
    io.emit('scan', code);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
