const express = require('express');
const bodyParser = require('body-parser');
const qrcode = require('qrcode');
const bwipjs = require('bwip-js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (replace with DB later)
const claims = {};
const items = {};

// ---------- Admin Dashboard ----------
app.get('/admin', (req, res) => {
  res.render('dashboard', { claims, items });
});

// Create a claim
app.post('/admin/claim', (req, res) => {
  const claimId = uuidv4();
  const { name, contact, password } = req.body;
  claims[claimId] = { id: claimId, name, contact, password: password || '', itemIds: [] };
  res.redirect('/admin');
});

// Add an item to a claim
app.post('/admin/item', (req, res) => {
  const itemId = uuidv4();
  const { claimId, description, location } = req.body;
  const item = { id: itemId, claimId, description, location, status: 'new' };
  items[itemId] = item;
  if (claims[claimId]) claims[claimId].itemIds.push(itemId);
  res.redirect('/admin');
});

// Generate QR code for claim
app.get('/claim/:claimId/qr', async (req, res) => {
  const url = `${req.protocol}://${req.get('host')}/claim/${req.params.claimId}`;
  try {
    const qr = await qrcode.toDataURL(url);
    res.type('html').send(`<img src="${qr}"/>`);
  } catch (e) {
    res.send('Error generating QR code');
  }
});

// Generate barcode for item
app.get('/item/:itemId/barcode', (req, res) => {
  const item = items[req.params.itemId];
  if (!item) return res.send('Item not found');
  bwipjs.toBuffer({
    bcid: 'code128',       
    text: item.id,          
    scale: 3,              
    height: 10,            
    includetext: true,     
  }, (err, png) => {
    if (err) res.send('Error generating barcode');
    else {
      res.type('image/png');
      res.send(png);
    }
  });
});

// ---------- Claim Portal ----------
app.get('/claim/:claimId', (req, res) => {
  const claim = claims[req.params.claimId];
  if (!claim) return res.send('Claim not found');
  res.render('claim', { claim, items });
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
