(function () {
  const API_BASE = '';

  // Дані приходять з сервера: список зон і поточний стан
  let zones = [];
  let state = {}; // { "zone_4_101-1010": { personName: "Іван Петренко", takenAt: 1741234567890 } }

  function getBundleId(zoneId, tkdRange) {
    return zoneId + '_' + tkdRange;
  }

  function getZoneOrderNumber(name) {
    const match = name.match(/\d+/);
    return match ? parseInt(match[0], 10) : 999;
  }

  function getZonesSorted() {
    return [...zones].sort((a, b) => {
      const numA = getZoneOrderNumber(a.name);
      const numB = getZoneOrderNumber(b.name);
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name, 'uk', { numeric: true });
    });
  }

  async function load() {
    try {
      const res = await fetch(API_BASE + '/api/state');
      if (!res.ok) throw new Error('Failed to load state');
      const data = await res.json();
      zones = Array.isArray(data.zones) ? data.zones : [];
      state = data.state || {};
    } catch (e) {
      console.error('Ошибка загрузки данных с сервера', e);
      zones = [];
      state = {};
    }
    render();
  }

  async function takeKey(bundleId, personName, reload = true, quiet = false) {
    const name = (personName || '').trim();
    if (!bundleId || !name) return;
    try {
      const res = await fetch(API_BASE + '/api/take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId, personName: name }),
      });
      if (!res.ok) throw new Error('Failed take');
      if (reload) await load();
    } catch (e) {
      console.error('Ошибка "взять"', e);
      if (!quiet) {
        alert('Не удалось сохранить на сервере. Попробуй еще раз.');
      }
      throw e;
    }
  }

  function getSelectedBundleIds() {
    return Array.from(selectedBundleIds);
  }

  async function takeKeys(bundleIds, personName) {
    if (!bundleIds || !bundleIds.length) return;
    const name = (personName || '').trim();
    if (!name) return;

    const promises = bundleIds.map((bundleId) => takeKey(bundleId, name, false, true));
    const results = await Promise.allSettled(promises);

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) {
      console.error('Ошибка при взятии связки', failed);
      alert('Некоторые связки не удалось взять. Попробуй еще раз.');
    }

    // Удаляем успешно взятые связки из выбора
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        selectedBundleIds.delete(bundleIds[idx]);
      }
    });

    updateSelectedBundlesDisplay();
    await load();
  }

  async function returnKeys(bundleIds) {
    if (!bundleIds || !bundleIds.length) return;

    const promises = bundleIds.map((bundleId) => returnKey(bundleId, false, true));
    const results = await Promise.allSettled(promises);

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) {
      console.error('Ошибка при возврате связок', failed);
      alert('Некоторые связки не удалось вернуть. Попробуй еще раз.');
    }

    // Удаляем успешно возвращенные связки из выбора
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        selectedBundleIds.delete(bundleIds[idx]);
      }
    });

    updateSelectedBundlesDisplay();
    await load();
  }

  async function returnKey(bundleId, reload = true, quiet = false) {
    if (!bundleId) return;
    try {
      const res = await fetch(API_BASE + '/api/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId }),
      });
      if (!res.ok) throw new Error('Failed return');
      if (reload) await load();
    } catch (e) {
      console.error('Ошибка "вернуть"', e);
      if (!quiet) {
        alert('Не удалось сохранить на сервере. Попробуй еще раз.');
      }
      throw e;
    }
  }

  async function saveComment(bundleId, comment) {
    if (!bundleId) return;
    try {
      const res = await fetch(API_BASE + '/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId, comment }),
      });
      if (!res.ok) throw new Error('Failed to save comment');
      await load();
    } catch (e) {
      console.error('Ошибка сохранения комментария', e);
      alert('Не удалось сохранить комментарий на сервере.');
    }
  }

  async function addZone(name) {
    const n = (name || '').trim();
    if (!n) return;
    try {
      const res = await fetch(API_BASE + '/api/add-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n }),
      });
      if (!res.ok) throw new Error('Failed add zone');
      await load();
    } catch (e) {
      console.error('Ошибка добавления зоны', e);
      alert('Не удалось добавить зону на сервере.');
    }
  }

  async function addBundle(zoneId, tkdRange) {
    const range = (tkdRange || '').trim();
    if (!range) return;
    try {
      const res = await fetch(API_BASE + '/api/add-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId, range }),
      });
      if (!res.ok) throw new Error('Failed add bundle');
      await load();
    } catch (e) {
      console.error('Ошибка добавления связки', e);
      alert('Не удалось добавить связку на сервере.');
    }
  }

  function getAllBundles() {
    const list = [];
    getZonesSorted().forEach((z) => {
      z.bundles.forEach((range) => {
        list.push({ zoneId: z.id, zoneName: z.name, tkdRange: range, bundleId: getBundleId(z.id, range) });
      });
    });
    return list;
  }

  // DOM
  const keySearch = document.getElementById('key-search');
  const btnSearch = document.getElementById('btn-search');
  const searchResults = document.getElementById('search-results');
  const bundleSearch = document.getElementById('bundle-search');
  const zoneSelect = document.getElementById('zone-select');
  const bundleList = document.getElementById('bundle-list');
  const quickBundleSelect = document.getElementById('quick-bundle-select');
  const btnQuickSelect = document.getElementById('btn-quick-select');
  const personName = document.getElementById('person-name');
  const btnTake = document.getElementById('btn-take');
  const btnSelectAll = document.getElementById('btn-select-all');
  const peopleList = document.getElementById('people-list');
  const peopleSection = document.getElementById('people-section');
  const viewPanel = document.getElementById('view-panel');
  const viewPersonName = document.getElementById('view-person-name');
  const viewKeysInfo = document.getElementById('view-keys-info');
  const viewBundles = document.getElementById('view-bundles');
  const viewButtons = document.getElementById('view-buttons');
  const newZoneName = document.getElementById('new-zone-name');
  const btnAddZone = document.getElementById('btn-add-zone');
  const newBundleZone = document.getElementById('new-bundle-zone');
  const newBundleRange = document.getElementById('new-bundle-range');
  const btnAddBundle = document.getElementById('btn-add-bundle');

  let selectedPerson = null;
  let searchQuery = '';
  let bundleSearchQuery = '';

  // Текущий «корзина» выбранных связок (чтобы можно было выбрать из разных зон подряд)
  const selectedBundleIds = new Set();
  const selectedBundlesList = document.getElementById('selected-bundles');

  // Выбор связок для возврата в панели просмотра пользователя
  let selectedReturnBundleIds = new Set();

  function getPeopleWithKeys() {
    const set = new Set();
    Object.values(state).forEach((v) => {
      if (v && v.personName) set.add(v.personName);
    });
    return Array.from(set).sort();
  }

  function filterBundlesBySearch() {
    let list = getAllBundles();
    if (searchQuery) {
      const q = searchQuery.trim();
      const qLower = q.toLowerCase();
      list = list.filter((b) => {
        // Обычный поиск
        if (
          b.zoneName.toLowerCase().includes(qLower) ||
          b.tkdRange.toLowerCase().includes(qLower) ||
          b.bundleId.toLowerCase().includes(qLower)
        ) {
          return true;
        }
        // Специальный поиск по формату зона_связка, например 1_101-105
        if (/^\d+_[^\s]+$/.test(q)) {
          const expectedBundleId = 'zone_' + q;
          if (b.bundleId === expectedBundleId) {
            return true;
          }
        }
        return false;
      });
    }
    if (selectedPerson) {
      list = list.filter((b) => state[b.bundleId] && state[b.bundleId].personName === selectedPerson);
    }
    return list;
  }

  function formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function isOverdue(takenAt) {
    if (!takenAt) return false;
    const now = Date.now();
    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000; // 2 дня в миллисекундах
    return (now - takenAt) > TWO_DAYS;
  }

  function getDaysOverdue(takenAt) {
    if (!takenAt) return 0;
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((now - takenAt) / msPerDay);
  }

  function updateSelectedBundlesDisplay() {
    if (!selectedBundlesList) return;
    const listEl = selectedBundlesList.querySelector('.selected-bundles__list');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (!selectedBundleIds.size) {
      // Скрываем весь блок если нет выбранных связок
      selectedBundlesList.classList.remove('selected-bundles--visible');
      return;
    }

    // Показываем блок если есть выбранные связки
    selectedBundlesList.classList.add('selected-bundles--visible');

    selectedBundleIds.forEach((bundleId) => {
      const parts = bundleId.split('_');
      const zoneId = parts.slice(0, 2).join('_');
      const tkdRange = parts.slice(2).join('_');
      const zone = zones.find((z) => z.id === zoneId);
      const zoneName = zone ? zone.name : 'Зона неизвестна';
      const item = document.createElement('div');
      item.className = 'selected-bundles__item';
      item.innerHTML =
        `<span class="bundle-label">${escapeHtml(zoneName)} — <span class="tkd-label">ТКД ${escapeHtml(tkdRange)}</span></span>` +
        '<button type="button" class="selected-bundles__remove" aria-label="Убрать">×</button>';
      const removeBtn = item.querySelector('.selected-bundles__remove');
      removeBtn.addEventListener('click', () => {
        selectedBundleIds.delete(bundleId);
        updateSelectedBundlesDisplay();
        renderBundleSelect();
      });
      listEl.appendChild(item);
    });
  }

  function renderZoneSelect() {
    zoneSelect.innerHTML = '<option value="">— Зона —</option>';
    getZonesSorted().forEach((z) => {
      const opt = document.createElement('option');
      opt.value = z.id;
      opt.textContent = z.name;
      zoneSelect.appendChild(opt);
    });
  }

  function renderBundleSelect() {
    const zoneId = zoneSelect.value;
    if (!bundleList) return;

    bundleList.innerHTML = '';

    const bundles = zoneId
      ? (zones.find((z) => z.id === zoneId)?.bundles || []).map((range) => ({
          zoneId,
          zoneName: zones.find((z) => z.id === zoneId)?.name || `Зона ${zoneId.split('_')[1] || 'неизвестна'}`,
          tkdRange: range,
          bundleId: getBundleId(zoneId, range),
        }))
      : getAllBundles();

    const sortedBundles = [...bundles].sort((a, b) => {
      const zoneCmp = a.zoneName.localeCompare(b.zoneName, 'uk', { numeric: true });
      if (zoneCmp !== 0) return zoneCmp;
      return a.tkdRange.localeCompare(b.tkdRange, 'uk', { numeric: true });
    });

    const filteredBundles = bundleSearchQuery
      ? sortedBundles.filter((b) => b.tkdRange.toLowerCase().includes(bundleSearchQuery.toLowerCase()))
      : sortedBundles;

    if (!filteredBundles.length) {
      const empty = document.createElement('div');
      empty.className = 'bundle-empty';
      empty.textContent = zoneId ? 'В этой зоне нет связок.' : 'Нет связок для показа.';
      bundleList.appendChild(empty);
      return;
    }

    filteredBundles.forEach((b) => {
      const taken = Boolean(state[b.bundleId]?.personName);
      const bundleState = state[b.bundleId];
      const label = document.createElement('label');
      label.className = 'bundle-item';
      if (selectedBundleIds.has(b.bundleId)) label.classList.add('bundle-item--selected');
      if (taken) label.classList.add('bundle-item--taken');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = b.bundleId;
      checkbox.checked = selectedBundleIds.has(b.bundleId);
      // Отключаем checkbox для взятых связок
      if (taken) checkbox.disabled = true;

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          selectedBundleIds.add(b.bundleId);
          label.classList.add('bundle-item--selected');
        } else {
          selectedBundleIds.delete(b.bundleId);
          label.classList.remove('bundle-item--selected');
        }
        updateSelectedBundlesDisplay();
      });

      let textContent = zoneId ? `ТКД ${b.tkdRange}` : `${b.zoneName} — ТКД ${b.tkdRange}`;
      // Показываем кто взял связку
      if (taken && bundleState && bundleState.personName) {
        textContent += ` (у ${bundleState.personName})`;
      }
      const text = document.createElement('span');
      text.textContent = textContent;

      label.appendChild(checkbox);
      label.appendChild(text);

      // Show comment if exists (even for returned keys)
      if (bundleState && bundleState.comment) {
        const commentSpan = document.createElement('span');
        commentSpan.className = 'bundle-comment';
        commentSpan.textContent = ` [${bundleState.comment}]`;
        label.appendChild(commentSpan);
      }

      bundleList.appendChild(label);
    });
  }

  function renderPeople() {
    const people = getPeopleWithKeys();
    peopleList.innerHTML = '';
    
    // Скрываем секцию если нет людей с ключами
    if (peopleSection) {
      peopleSection.style.display = people.length ? '' : 'none';
    }
    
    people.forEach((name) => {
      const count = Object.values(state).filter((v) => v && v.personName === name).length;
      const personDiv = document.createElement('div');
      personDiv.className = 'person-item';
      const chip = document.createElement('span');
      chip.className = 'person-chip' + (selectedPerson === name ? ' active' : '');
      chip.textContent = name + ' (' + count + ')';
      chip.addEventListener('click', () => {
        selectedPerson = selectedPerson === name ? null : name;
        renderPeople();
        renderViewPanel();
      });
      personDiv.appendChild(chip);
      peopleList.appendChild(personDiv);
    });
  }

  function renderViewPanel() {
    if (!viewPanel || !viewPersonName || !viewKeysInfo || !viewBundles || !viewButtons) return;

    if (!selectedPerson) {
      viewPanel.style.display = 'none';
      return;
    }

    viewPanel.style.display = '';
    viewPersonName.textContent = `Ключи у: ${selectedPerson}`;

    // Get person's bundles
    const personBundles = Object.entries(state)
      .filter(([_, data]) => data && data.personName === selectedPerson)
      .map(([bundleId, data]) => {
        const parts = bundleId.split('_');
        const zoneId = parts.slice(0, 2).join('_');
        const tkdRange = parts.slice(2).join('_');
        const zone = zones.find((z) => z.id === zoneId);
        const zoneName = zone ? zone.name : 'Зона неизвестна';
        return { bundleId, zoneName, tkdRange, takenAt: data.takenAt };
      })
      .sort((a, b) => a.zoneName.localeCompare(b.zoneName) || a.tkdRange.localeCompare(b.tkdRange));

    if (!personBundles.length) {
      viewKeysInfo.textContent = 'У этого человека нет ключей.';
      viewBundles.innerHTML = '';
      viewButtons.innerHTML = '';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn btn-secondary';
      closeBtn.textContent = 'Закрыть';
      closeBtn.addEventListener('click', () => {
        selectedPerson = null;
        renderPeople();
        renderViewPanel();
      });

      viewButtons.appendChild(closeBtn);
      return;
    }

    // По умолчанию помечаем все связки для возврата
    selectedReturnBundleIds = new Set(personBundles.map((b) => b.bundleId));

    viewKeysInfo.textContent = `Всего: ${personBundles.length} связок. Выбери, какие вернуть:`;

    viewBundles.innerHTML = '';

    personBundles.forEach((b) => {
      const item = document.createElement('div');
      item.className = 'return-bundle-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedReturnBundleIds.has(b.bundleId);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          selectedReturnBundleIds.add(b.bundleId);
        } else {
          selectedReturnBundleIds.delete(b.bundleId);
        }
        updateReturnButtons();
      });

      const label = document.createElement('span');
      label.className = 'bundle-label';
      label.textContent = `${b.zoneName} — ТКД ${b.tkdRange}`;

      // Comment input
      const commentInput = document.createElement('input');
      commentInput.type = 'text';
      commentInput.className = 'comment-input';
      commentInput.placeholder = 'Комментарий...';
      commentInput.value = state[b.bundleId]?.comment || '';
      commentInput.addEventListener('change', () => {
        saveComment(b.bundleId, commentInput.value);
      });

      const taken = document.createElement('span');
      taken.className = 'taken-time';
      const overdue = isOverdue(b.takenAt);
      if (overdue) {
        const days = getDaysOverdue(b.takenAt);
        taken.className = 'taken-time taken-time--overdue';
        taken.textContent = `⚠️ взято ${formatTime(b.takenAt)} (${days} дн.)`;
      } else {
        taken.textContent = `взято ${formatTime(b.takenAt)}`;
      }

      item.appendChild(checkbox);
      item.appendChild(label);
      item.appendChild(commentInput);
      item.appendChild(taken);
      viewBundles.appendChild(item);
    });

    viewButtons.innerHTML = '';

    const returnSelectedBtn = document.createElement('button');
    returnSelectedBtn.type = 'button';
    returnSelectedBtn.className = 'btn btn-return';
    returnSelectedBtn.textContent = 'Вернуть выбранные';
    returnSelectedBtn.addEventListener('click', () => {
      const selectedIds = Array.from(selectedReturnBundleIds);
      if (!selectedIds.length) {
        alert('Выбери хотя бы одну связку.');
        return;
      }
      returnKeys(selectedIds);
      selectedPerson = null;
      renderPeople();
      renderViewPanel();
    });

    const returnAllBtn = document.createElement('button');
    returnAllBtn.type = 'button';
    returnAllBtn.className = 'btn btn-return';
    returnAllBtn.textContent = 'Вернуть все';
    returnAllBtn.addEventListener('click', () => {
      returnKeys(personBundles.map((b) => b.bundleId));
      selectedPerson = null;
      renderPeople();
      renderViewPanel();
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-secondary';
    closeBtn.textContent = 'Закрыть';
    closeBtn.addEventListener('click', () => {
      selectedPerson = null;
      renderPeople();
      renderViewPanel();
    });

    function updateReturnButtons() {
      returnSelectedBtn.disabled = selectedReturnBundleIds.size === 0;
    }

    viewButtons.appendChild(returnSelectedBtn);
    viewButtons.appendChild(returnAllBtn);
    viewButtons.appendChild(closeBtn);

    updateReturnButtons();
  }

  function renderSearchResults() {
    const list = filterBundlesBySearch();
    searchResults.innerHTML = '';
    if (!list.length) {
      searchResults.innerHTML = '<p>Ничего не найдено.</p>';
      searchResults.style.display = '';
      return;
    }
    list.forEach((b) => {
      const cur = state[b.bundleId];
      const item = document.createElement('div');
      item.className = 'search-result-item';
      let statusHtml = '';
      if (cur) {
        const overdue = isOverdue(cur.takenAt);
        if (overdue) {
          const days = getDaysOverdue(cur.takenAt);
          statusHtml = `<span class="overdue-badge">⚠️ У ${escapeHtml(cur.personName)} (${days} дн.)</span>`;
        } else {
          statusHtml = `У ${escapeHtml(cur.personName)}`;
        }
      } else {
        statusHtml = 'Свободна';
      }
      item.innerHTML = `
        <div class="bundle-info">${escapeHtml(b.zoneName)} — ТКД ${escapeHtml(b.tkdRange)}</div>
        <div class="bundle-status">${statusHtml}</div>
      `;
      searchResults.appendChild(item);
    });
    searchResults.style.display = '';
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function render() {
    renderZoneSelect();
    renderBundleSelect();
    updateSelectedBundlesDisplay();
    renderPeople();
    renderViewPanel();
    // оновлення select для додавання связки
    if (newBundleZone) {
      newBundleZone.innerHTML = '';
      getZonesSorted().forEach((z) => {
        const opt = document.createElement('option');
        opt.value = z.id;
        opt.textContent = z.name;
        newBundleZone.appendChild(opt);
      });
    }
  }

  keySearch.addEventListener('input', () => {
    searchQuery = keySearch.value;
    if (searchQuery.trim()) {
      renderSearchResults();
    } else {
      searchResults.style.display = 'none';
    }
  });

  keySearch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      keySearch.value = '';
      searchQuery = '';
      searchResults.style.display = 'none';
    }
  });

  if (btnSearch) {
    btnSearch.addEventListener('click', () => {
      searchQuery = keySearch.value;
      if (searchQuery.trim()) {
        renderSearchResults();
      } else {
        searchResults.style.display = 'none';
      }
    });
  }

  if (bundleSearch) {
    bundleSearch.addEventListener('input', () => {
      bundleSearchQuery = bundleSearch.value;
      renderBundleSelect();
    });
    bundleSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        bundleSearch.value = '';
        bundleSearchQuery = '';
        renderBundleSelect();
      }
    });
  }

  zoneSelect.addEventListener('change', () => {
    if (bundleSearch) {
      bundleSearch.value = '';
      bundleSearchQuery = '';
    }
    renderBundleSelect();
  });

  btnTake.addEventListener('click', () => {
    const bundleIds = getSelectedBundleIds();
    const name = personName.value.trim();
    if (!name) {
      alert('Введи ФИО.');
      return;
    }
    if (!bundleIds.length) {
      alert('Выбери связку(и) (ТКД).');
      return;
    }
    takeKeys(bundleIds, name);
    personName.value = '';
  });

  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      const checkboxes = bundleList ? bundleList.querySelectorAll('input[type="checkbox"]') : [];
      checkboxes.forEach((cb) => {
        if (!cb.value) return;
        cb.checked = true;
        selectedBundleIds.add(cb.value);
        const label = cb.closest('.bundle-item');
        if (label) label.classList.add('bundle-item--selected');
      });
      updateSelectedBundlesDisplay();
    });
  }

  if (btnQuickSelect && quickBundleSelect) {
    btnQuickSelect.addEventListener('click', () => {
      const input = quickBundleSelect.value.trim();
      if (!input) {
        alert('Введи зону_связку, напр. 1_101-1010');
        return;
      }
      const parts = input.split('_');
      if (parts.length !== 2) {
        alert('Неправильный формат. Используй: номер_зоны_диапазон, напр. 1_101-1010');
        return;
      }
      const zoneNum = parts[0].trim();
      const bundleRange = parts[1].trim();
      if (!zoneNum || !bundleRange) {
        alert('Неправильний формат.');
        return;
      }
      // Find zone by number
      const zone = zones.find(z => getZoneOrderNumber(z.name) === parseInt(zoneNum, 10));
      if (!zone) {
        alert('Зону с таким номером не найдено.');
        return;
      }
      if (!zone.bundles.includes(bundleRange)) {
        alert('Связку с таким диапазоном в этой зоне не найдено.');
        return;
      }
      const bundleId = getBundleId(zone.id, bundleRange);
      selectedBundleIds.add(bundleId);
      updateSelectedBundlesDisplay();
      renderBundleSelect(); // to update the checkboxes
      quickBundleSelect.value = '';
    });
    quickBundleSelect.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnQuickSelect.click();
    });
  }

  if (btnAddZone && newZoneName) {
    btnAddZone.addEventListener('click', () => {
      const name = newZoneName.value.trim();
      if (!name) {
        alert('Введи название зоны.');
        return;
      }
      addZone(name);
      newZoneName.value = '';
    });
    newZoneName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnAddZone.click();
    });
  }

  if (btnAddBundle && newBundleZone && newBundleRange) {
    btnAddBundle.addEventListener('click', () => {
      const zoneId = newBundleZone.value;
      const range = newBundleRange.value.trim();
      if (!zoneId) {
        alert('Выбери зону.');
        return;
      }
      if (!range) {
        alert('Введи диапазон ТКД (напр. 101-106).');
        return;
      }
      addBundle(zoneId, range);
      newBundleRange.value = '';
    });
    newBundleRange.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnAddBundle.click();
    });
  }

  load();
  render();
})();
