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
const claims = {}; // claimId -> {id, name, contact, password, items: [{name, description, linkedItemId}]}
const items = {};  // itemId -> {id, code, name, description, location, status, linkedClaimId}
const recentlyScanned = []; // {itemId, timestamp}

// ----------------- Helper -----------------
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase(); // short unique code
}

// ----------------- Admin Dashboard -----------------
app.get('/admin', (req, res) => {
  res.render('dashboard', { claims, items, recentlyScanned });
});

// Create a new claim
app.post('/admin/claim', (req, res) => {
  const claimId = uuidv4();
  const { name, contact, password, itemsList } = req.body;
  const missingItems = JSON.parse(itemsList || '[]'); // [{name, description}]
  // Add linkedItemId field
  missingItems.forEach(i => i.linkedItemId = null);
  claims[claimId] = { id: claimId, name, contact, password: password || '', items: missingItems };
  res.redirect('/admin');
});

// Delete claim
app.post('/admin/claim/:id/remove', (req, res) => {
  delete claims[req.params.id];
  res.redirect('/admin');
});

// Add warehouse item
app.post('/admin/item', (req, res) => {
  const itemId = uuidv4();
  const code = generateCode();
  const { name, description, location } = req.body;
  items[itemId] = { id: itemId, code, name, description, location, status: 'in warehouse', linkedClaimId: null };
  res.redirect('/admin');
});

// Remove warehouse item
app.post('/admin/item/:id/remove', (req, res) => {
  delete items[req.params.id];
  res.redirect('/admin');
});

// Update item status or link to claim
app.post('/admin/item/:id/status', (req, res) => {
  const { status, linkedClaimId } = req.body;
  if (items[req.params.id]) {
    items[req.params.id].status = status;
    if (linkedClaimId) items[req.params.id].linkedClaimId = linkedClaimId || null;
  }
  res.redirect('/admin');
});

// Link item to claim manually
app.post('/admin/claim/:claimId/add-item', (req, res) => {
  const { itemCode, missingItemIndex } = req.body;
  const claim = claims[req.params.claimId];
  if (!claim) return res.redirect('/admin');
  const item = Object.values(items).find(i => i.code === itemCode);
  if (!item) return res.redirect('/admin');
  item.linkedClaimId = claim.id;
  item.status = 'waiting for pickup';
  claim.items[missingItemIndex].linkedItemId = item.id;
  res.redirect('/admin');
});

// ----------------- QR / Barcode -----------------
app.get('/claim/:claimId/qr', async (req, res) => {
  const claimUrl = `${req.protocol}://${req.get('host')}/claim/${req.params.claimId}`;
  try {
    const qr = await qrcode.toDataURL(claimUrl);
    res.type('html').send(`<img src="${qr}" />`);
  } catch (e) {
    res.send('Error generating QR code');
  }
});

app.get('/item/:itemId/barcode', (req, res) => {
  const item = items[req.params.itemId];
  if (!item) return res.send('Item not found');
  bwipjs.toBuffer({
    bcid: 'code128',
    text: item.code,
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

  const enteredPassword = req.query.pwd || '';
  if (claim.password && enteredPassword !== claim.password) {
    return res.send(`<form method="get">
      Password required: <input name="pwd" type="password" />
      <button type="submit">Enter</button>
    </form>`);
  }

  const claimItems = claim.items.map((i, idx) => {
    const linkedItem = i.linkedItemId ? items[i.linkedItemId] : null;
    return {
      name: i.name,
      description: i.description,
      status: linkedItem ? linkedItem.status : 'not yet found',
      location: linkedItem ? linkedItem.location : 'N/A',
      code: linkedItem ? linkedItem.code : null,
      index: idx
    };
  });

  res.render('claim', { claim, claimItems });
});

// ----------------- Barcode Scan Page -----------------
app.get('/scan', (req, res) => {
  res.render('scan');
});

app.post('/scan', (req, res) => {
  const { code, mode } = req.body;
  const item = Object.values(items).find(i => i.code === code);
  if (!item) return res.json({ success: false, message: 'Item not found' });

  if (mode === 'recent') {
    recentlyScanned.push({ itemId: item.id, timestamp: Date.now() });
  }

  res.json({ success: true, item });
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
