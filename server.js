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
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------- In-memory DB -----------------
const claims = {}; // claimId -> {id, name, contact, password, items: [{name, description}]}
const items = {};  // itemId -> {id, name, description, location, status, linkedClaimId}

// ----------------- Admin Dashboard -----------------
app.get('/admin', (req, res) => {
  res.render('dashboard', { claims, items });
});

// Create a new claim
app.post('/admin/claim', (req, res) => {
  const claimId = uuidv4();
  const { name, contact, password, itemsList } = req.body;
  const missingItems = JSON.parse(itemsList || '[]'); // [{name, description}]
  claims[claimId] = { id: claimId, name, contact, password: password || '', items: missingItems };
  res.redirect('/admin');
});

// Add a new warehouse item
app.post('/admin/item', (req, res) => {
  const itemId = uuidv4();
  const { name, description, location } = req.body;
  items[itemId] = { id: itemId, name, description, location, status: 'in warehouse', linkedClaimId: null };
  res.redirect('/admin');
});

// Remove an item
app.post('/admin/item/:id/remove', (req, res) => {
  delete items[req.params.id];
  res.redirect('/admin');
});

// Update item status manually
app.post('/admin/item/:id/status', (req, res) => {
  const { status, linkedClaimId } = req.body;
  if (items[req.params.id]) {
    items[req.params.id].status = status;
    if (linkedClaimId) items[req.params.id].linkedClaimId = linkedClaimId || null;
  }
  res.redirect('/admin');
});

// ----------------- QR Code / Barcode -----------------
// QR code for claim portal
app.get('/claim/:claimId/qr', async (req, res) => {
  const claimUrl = `${req.protocol}://${req.get('host')}/claim/${req.params.claimId}`;
  try {
    const qr = await qrcode.toDataURL(claimUrl);
    res.type('html').send(`<img src="${qr}" />`);
  } catch (e) {
    res.send('Error generating QR code');
  }
});

// Barcode for warehouse item
app.get('/item/:itemId/barcode', (req, res) => {
  const item = items[req.params.itemId];
  if (!item) return res.send('Item not found');
  bwipjs.toBuffer({
    bcid: 'code128',
    text: item.id,
    scale: 3,
    height: 10,
    includetext: true
  }, (err, png) => {
    if (err) res.send('Error generating barcode');
    else {
      res.type('image/png');
      res.send(png);
    }
  });
});

// ----------------- Claim Portal -----------------
app.get('/claim/:claimId', (req, res) => {
  const claim = claims[req.params.claimId];
  if (!claim) return res.send('Claim not found');

  // Password check
  const enteredPassword = req.query.pwd || '';
  if (claim.password && enteredPassword !== claim.password) {
    return res.send(`<form method="get">
      Password required: <input name="pwd" type="password" />
      <button type="submit">Enter</button>
    </form>`);
  }

  // Find matching items
  const claimItems = claim.items.map(missingItem => {
    const matchedItem = Object.values(items).find(i => i.name.toLowerCase() === missingItem.name.toLowerCase());
    return {
      name: missingItem.name,
      description: missingItem.description,
      status: matchedItem ? matchedItem.status : 'not yet found',
      location: matchedItem ? matchedItem.location : 'N/A'
    };
  });

  res.render('claim', { claim, claimItems });
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
