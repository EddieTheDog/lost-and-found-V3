const items = [];

const addButton = document.getElementById('addClaimItem');
const itemsListDiv = document.getElementById('claimItemsList');
const itemsListInput = document.getElementById('itemsListInput');

addButton.addEventListener('click', () => {
  const nameInput = document.getElementById('itemName');
  const descInput = document.getElementById('itemDesc');
  const name = nameInput.value.trim();
  const desc = descInput.value.trim();
  if (!name) return alert('Item name required');

  const item = { name, description: desc, linkedItemId: null };
  items.push(item);

  const div = document.createElement('div');
  div.textContent = `${name} - ${desc}`;
  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.type = 'button';
  removeBtn.onclick = () => {
    itemsListDiv.removeChild(div);
    const index = items.indexOf(item);
    if (index > -1) items.splice(index, 1);
    updateHiddenInput();
  };
  div.appendChild(removeBtn);
  itemsListDiv.appendChild(div);

  nameInput.value = '';
  descInput.value = '';
  updateHiddenInput();
});

function updateHiddenInput() {
  itemsListInput.value = JSON.stringify(items);
}
