const API = '/api';

function showMsg(containerId, text, type) {
  const el = document.getElementById(containerId);
  el.innerHTML = '<div class="msg ' + type + '">' + escapeHtml(text) + '</div>';
  setTimeout(() => { el.innerHTML = ''; }, 4000);
}

function escapeHtml(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadProps() {
  const res = await fetch(API + '/properties');
  const props = await res.json();
  const list = document.getElementById('propsList');
  if (props.length === 0) {
    list.innerHTML = '<p>No properties yet. Add one above.</p>';
    return;
  }
  let html = '<table><thead><tr><th>Title</th><th>Rent</th><th>Location</th><th>Beds</th><th>Status</th><th>Photos</th><th>Actions</th></tr></thead><tbody>';
  for (const p of props) {
    const statusClass = p.status === 'available' ? 'status-available' : 'status-rented';
    html += '<tr>';
    html += '<td>' + escapeHtml(p.title || '') + '</td>';
    html += '<td>' + (p.rent || 0) + '</td>';
    html += '<td>' + escapeHtml(p.location || '') + '</td>';
    html += '<td>' + (p.bedrooms || '-') + '</td>';
    html += '<td><span class="status-badge ' + statusClass + '">' + escapeHtml(p.status) + '</span></td>';
    html += '<td>' + p.photo_count + '</td>';
    html += '<td>';
    html += '<button class="secondary" onclick="editProp(' + JSON.stringify(p) + ')">Edit</button> ';
    html += '<button class="secondary" onclick="toggleStatus(\'' + p.id + '\', \'' + (p.status === 'available' ? 'rented' : 'available') + '\')">' + (p.status === 'available' ? 'Rent' : 'Available') + '</button> ';
    html += '<button class="danger" onclick="delProp(\'' + p.id + '\')">Delete</button>';
    html += '</td>';
    html += '</tr>';
    html += '<tr><td colspan="7"><div id="edit-' + p.id + '" class="hidden edit-form"></div></td></tr>';
  }
  html += '</tbody></table>';
  list.innerHTML = html;
}

async function addProp(e) {
  e.preventDefault();
  const form = document.getElementById('addForm');
  const formData = new FormData(form);

  const body = {
    title: formData.get('title'),
    rent: parseInt(formData.get('rent')) || 0,
    location: formData.get('location'),
    bedrooms: parseInt(formData.get('bedrooms')) || null,
    bathrooms: parseInt(formData.get('bathrooms')) || null,
    furnishing: formData.get('furnishing') || null,
    parking: formData.get('parking') ? 1 : 0,
    balcony: formData.get('balcony') ? 1 : 0,
    floor: parseInt(formData.get('floor')) || null,
    facilities: formData.get('facilities') || null,
    availability_date: formData.get('availability_date') || null,
    info: formData.get('info') || null,
    status: 'available',
  };

  try {
    const res = await fetch(API + '/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      var errText = 'Failed to add property';
      try {
        var errJson = await res.json();
        if (errJson.error) errText = errJson.error;
      } catch (e) {}
      throw new Error(errText);
    }
    const prop = await res.json();

    // Upload media
    const photos = formData.getAll('photos');
    const video = formData.get('video');
    const mediaFiles = [];
    for (const p of photos) mediaFiles.append('files', p);
    if (video && video.size > 0) {
      const f = video; f.fieldname = 'video';
      mediaFiles.append('files', f);
    }

    if (mediaFiles.length > 0) {
      const mres = await fetch(API + '/properties/' + prop.id + '/media', {
        method: 'POST',
        body: mediaFiles,
      });
      if (!mres.ok) console.warn('Media upload had issues');
    }

    showMsg('addMsg', 'Property added successfully!', 'success');
    form.reset();
    loadProps();
  } catch (err) {
    showMsg('addMsg', err.message, 'error');
  }
}

async function editProp(p) {
  const container = document.getElementById('edit-' + p.id);
  if (!container.classList.contains('hidden')) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  // Close others
  document.querySelectorAll('.edit-form').forEach(el => { el.classList.add('hidden'); el.innerHTML = ''; });
  container.classList.remove('hidden');

  const mediaRes = await fetch(API + '/properties/' + p.id + '/media');
  const media = await mediaRes.json();

  container.innerHTML = `
    <h3>Edit: ${escapeHtml(p.title)}</h3>
    <div id="editMsg-${p.id}"></div>
    <form id="editForm-${p.id}" class="row" style="flex-direction:column; gap:8px;">
      <input type="text" value="${escapeHtml(p.title || '')}" id="e-title-${p.id}" placeholder="Title">
      <input type="number" value="${p.rent || ''}" id="e-rent-${p.id}" placeholder="Rent">
      <input type="text" value="${escapeHtml(p.location || '')}" id="e-location-${p.id}" placeholder="Location">
      <input type="number" value="${p.bedrooms || ''}" id="e-bedrooms-${p.id}" placeholder="Bedrooms">
      <input type="number" value="${p.bathrooms || ''}" id="e-bathrooms-${p.id}" placeholder="Bathrooms">
      <select id="e-furnishing-${p.id}">
        <option value="">Furnishing</option>
        <option value="furnished" ${p.furnishing === 'furnished' ? 'selected' : ''}>Furnished</option>
        <option value="semi-furnished" ${p.furnishing === 'semi-furnished' ? 'selected' : ''}>Semi-furnished</option>
        <option value="unfurnished" ${p.furnishing === 'unfurnished' ? 'selected' : ''}>Unfurnished</option>
      </select>
      <div style="display:flex;gap:10px;">
        <label><input type="checkbox" id="e-parking-${p.id}" ${p.parking ? 'checked' : ''}> Parking</label>
        <label><input type="checkbox" id="e-balcony-${p.id}" ${p.balcony ? 'checked' : ''}> Balcony</label>
      </div>
      <input type="number" value="${p.floor || ''}" id="e-floor-${p.id}" placeholder="Floor">
      <input type="text" value="${escapeHtml(p.facilities || '')}" id="e-facilities-${p.id}" placeholder="Facilities">
      <input type="text" value="${p.availability_date || ''}" id="e-availability-${p.id}" placeholder="Available date">
      <textarea id="e-info-${p.id}" placeholder="Info">${escapeHtml(p.info || '')}</textarea>
      <div style="margin-top:8px;"><strong>Photos:</strong> ${media.filter(m=>m.type==='photo').length} uploaded</div>
      <div style="margin-top:8px;"><strong>Video:</strong> ${media.filter(m=>m.type==='video').length > 0 ? 'Yes' : 'No'}</div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button type="submit">Save</button>
        <button type="button" class="secondary" onclick="closeEdit('${p.id}')">Cancel</button>
      </div>
    </form>
  `;

  document.getElementById('editForm-' + p.id).onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const updates = {
      title: fd.get('title'),
      rent: parseInt(fd.get('rent')) || 0,
      location: fd.get('location'),
      bedrooms: parseInt(fd.get('bedrooms')) || null,
      bathrooms: parseInt(fd.get('bathrooms')) || null,
      furnishing: fd.get('furnishing') || null,
      parking: fd.get('parking') ? 1 : 0,
      balcony: fd.get('balcony') ? 1 : 0,
      floor: parseInt(fd.get('floor')) || null,
      facilities: fd.get('facilities') || null,
      availability_date: fd.get('availability') || null,
      info: fd.get('info') || null,
    };
    try {
      const res = await fetch(API + '/properties/' + p.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Update failed');
      showMsg('editMsg-' + p.id, 'Saved!', 'success');
      setTimeout(() => { loadProps(); closeEdit(p.id); }, 800);
    } catch (err) {
      showMsg('editMsg-' + p.id, err.message, 'error');
    }
  };
}

function closeEdit(id) {
  const c = document.getElementById('edit-' + id);
  c.classList.add('hidden');
  c.innerHTML = '';
}

async function toggleStatus(id, newStatus) {
  try {
    const res = await fetch(API + '/properties/' + id + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error('Toggle failed');
    loadProps();
  } catch (err) {
    alert(err.message);
  }
}

async function delProp(id) {
  if (!confirm('Delete this property? This cannot be undone.')) return;
  try {
    const res = await fetch(API + '/properties/' + id, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    loadProps();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('quickAddForm').onsubmit = async (e) => {
  e.preventDefault();
  const rent = document.getElementById('q-rent').value;
  const location = document.getElementById('q-location').value;

  try {
    const res = await fetch(API + '/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rent: parseInt(rent), location: location, status: 'available' }),
    });
    if (!res.ok) throw new Error('Failed to add property');
    document.getElementById('quickAddForm').reset();
    loadProps();
    alert('Property added!');
  } catch (err) {
    alert(err.message);
  }
};

document.getElementById('quickAddForm').insertAdjacentHTML('beforebegin', '<div id="quickAddMsg"></div>');

document.getElementById('addForm').onsubmit = addProp;
document.getElementById('addForm').insertAdjacentHTML('beforebegin', '<div id="addMsg"></div>');

loadProps();
checkWhatsApp();

async function checkWhatsApp() {
  try {
    const res = await fetch(API + '/whatsapp/status');
    const data = await res.json();
    const statusEl = document.getElementById('whatsappStatus');
    if (data.linked) {
      statusEl.innerHTML = '<strong style="color:green;">✓ WhatsApp is connected!</strong> Customers can message you now.';
      document.getElementById('qrImage').src = '';
      document.getElementById('qrImage').style.display = 'none';
    } else if (data.hasQr) {
      statusEl.innerHTML = '<strong style="color:orange;">⚠ Scan the QR code below to connect WhatsApp.</strong>';
      const qrRes = await fetch(API + '/whatsapp/qr');
      const qrData = await qrRes.json();
      const img = document.getElementById('qrImage');
      if (qrData.qrImage) {
        img.src = qrData.qrImage;
        img.style.display = 'block';
      } else {
        img.style.display = 'none';
      }
    } else {
      statusEl.innerHTML = '<strong style="color:red;">✗ WhatsApp not initialized.</strong> Restart the server.';
    }
  } catch (e) {
    document.getElementById('whatsappStatus').innerHTML = '<strong style="color:red;">✗ Could not check WhatsApp status.</strong>';
  }
}

async function loadAllowedContacts() {
  const res = await fetch(API + '/allowed-contacts');
  const contacts = await res.json();
  const list = document.getElementById('allowedContactsList');
  if (contacts.length === 0) {
    list.innerHTML = '<p>No contacts added yet. Add a phone number to allow them to use the rental agent.</p>';
    return;
  }
  let html = '<table><thead><tr><th>Phone</th><th>Name</th><th>Action</th></tr></thead><tbody>';
  for (const c of contacts) {
    html += '<tr>';
    html += '<td>' + escapeHtml(c.phone) + '</td>';
    html += '<td>' + escapeHtml(c.name || '-') + '</td>';
    html += '<td><button class="danger" onclick="removeAllowedContact(\'' + c.phone + '\')" style="padding:4px 8px;">Remove</button></td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  list.innerHTML = html;
}

async function addAllowedContact() {
  const phone = document.getElementById('ac-phone').value;
  const name = document.getElementById('ac-name').value;
  if (!phone) { alert('Phone number is required'); return; }
  try {
    const res = await fetch(API + '/allowed-contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name }),
    });
    if (!res.ok) throw new Error('Failed to add contact');
    document.getElementById('ac-phone').value = '';
    document.getElementById('ac-name').value = '';
    loadAllowedContacts();
  } catch (err) {
    alert(err.message);
  }
}

async function removeAllowedContact(phone) {
  if (!confirm('Remove this contact from the whitelist?')) return;
  try {
    const res = await fetch(API + '/allowed-contacts/' + phone, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to remove contact');
    loadAllowedContacts();
  } catch (err) {
    alert(err.message);
  }
}

async function loadVisits() {
  const res = await fetch(API + '/visits');
  const visits = await res.json();
  const list = document.getElementById('visitsList');
  if (visits.length === 0) {
    list.innerHTML = '<p>No visit requests yet.</p>';
    return;
  }
  let html = '<table><thead><tr><th>Phone</th><th>Property</th><th>Rent</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
  for (const v of visits) {
    const statusClass = v.status === 'approved' ? 'status-available' : (v.status === 'rejected' ? 'status-rented' : '');
    html += '<tr>';
    html += '<td>' + escapeHtml(v.phone) + '</td>';
    html += '<td>' + escapeHtml(v.title) + '</td>';
    html += '<td>₹' + (v.rent || 0) + '</td>';
    html += '<td>' + escapeHtml(v.location || '') + '</td>';
    html += '<td><span class="status-badge ' + statusClass + '">' + escapeHtml(v.status) + '</span></td>';
    if (v.status === 'pending') {
      html += '<td>';
      html += '<button onclick="approveVisit(\'' + v.id + '\')" style="padding:4px 8px;background:#1a73e8;color:#fff;border:none;border-radius:4px;">Approve</button> ';
      html += '<button onclick="rejectVisit(\'' + v.id + '\')" style="padding:4px 8px;background:#d32f2f;color:#fff;border:none;border-radius:4px;">Reject</button>';
      html += '</td>';
    } else {
      html += '<td>—</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  list.innerHTML = html;
}

async function approveVisit(id) {
  try {
    const res = await fetch(API + '/visits/' + id + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    if (!res.ok) throw new Error('Failed to approve');
    loadVisits();
    alert('Visit approved!');
  } catch (err) {
    alert(err.message);
  }
}

async function rejectVisit(id) {
  try {
    const res = await fetch(API + '/visits/' + id + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    if (!res.ok) throw new Error('Failed to reject');
    loadVisits();
    alert('Visit rejected!');
  } catch (err) {
    alert(err.message);
  }
}

loadProperties();
checkWhatsApp();
if (isOwner) {
  loadAllowedContacts();
  loadVisits();
}
