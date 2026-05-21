// Application State
let state = {
    title: "",
    items: [],
    exchangeRate: 0,
    activeFilter: 'all', // 'all', 'pending', 'completed'
    displayCurrency: 'bs'  // 'bs' or 'usd'
};

// DOM elements references
const listContainer = document.getElementById('shopping-list-container');
const totalDisplay = document.getElementById('total-display');
const usdTotalWrapper = document.getElementById('usd-total-wrapper');
const usdTotalDisplay = document.getElementById('usd-total-display');
const exchangeRateInput = document.getElementById('exchange-rate-input');
const listTitleInput = document.getElementById('list-title');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressPercentage = document.getElementById('progress-percentage');
let clearAllModal;
let addItemModal;
let fullTotalModal;
let editRateModal;
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let editingItemId = null;

// On window load
window.onload = function () {
    clearAllModal = new bootstrap.Modal(document.getElementById('clearAllModal'));
    addItemModal = new bootstrap.Modal(document.getElementById('addItemModal'));
    fullTotalModal = new bootstrap.Modal(document.getElementById('fullTotalModal'));
    editRateModal = new bootstrap.Modal(document.getElementById('editRateModal'));
    loadFromLocalStorage();
    applySavedTheme();
    renderList();

    // Automatically fetch latest exchange rate
    tasaDeCambio();

    // Add shortcut F1 to add new element easily
    document.addEventListener('keydown', function (e) {
        if (e.key === 'F1') {
            e.preventDefault();
            openAddItemModal();
        }
    });
};

// Load state from LocalStorage
function loadFromLocalStorage() {
    const savedState = localStorage.getItem('supermarket_list_state');
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            state.title = parsed.title || "";
            state.items = parsed.items || [];
            state.exchangeRate = parsed.exchangeRate || 0;

            // Update input values
            listTitleInput.value = state.title;
            if (state.exchangeRate > 0) {
                exchangeRateInput.value = state.exchangeRate;
            }
        } catch (e) {
            console.error("Error cargando LocalStorage", e);
        }
    }
}

// Save state to LocalStorage
function saveToLocalStorage() {
    state.title = listTitleInput.value;
    localStorage.setItem('supermarket_list_state', JSON.stringify({
        title: state.title,
        items: state.items,
        exchangeRate: state.exchangeRate
    }));
}

// Render current list state to the UI
function renderList() {
    listContainer.innerHTML = '';

    // Filter elements based on selection
    const filteredItems = state.items.filter(item => {
        if (state.activeFilter === 'pending') return !item.checked;
        if (state.activeFilter === 'completed') return item.checked;
        return true;
    });

    // Update filter buttons UI
    ['all', 'pending', 'completed'].forEach(filter => {
        const btn = document.getElementById(`btn-filter-${filter}`);
        if (btn) {
            if (btn.classList.contains('dropdown-item')) {
                if (filter === state.activeFilter) {
                    btn.classList.add('active', 'fw-bold');
                } else {
                    btn.classList.remove('active', 'fw-bold');
                }
            } else {
                if (filter === state.activeFilter) {
                    btn.classList.remove('btn-outline-secondary');
                    btn.classList.add('btn-primary');
                } else {
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-outline-secondary');
                }
            }
        }
    });
    
    // Optional: update dropdown text
    const filterLabelMap = { 'all': 'Todos', 'pending': 'Pendientes', 'completed': 'Comprados' };
    const dropdownToggle = document.getElementById('filterDropdown');
    if (dropdownToggle) {
        dropdownToggle.textContent = `${filterLabelMap[state.activeFilter]}`;
    }

    if (filteredItems.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-5 text-muted animate__animated animate__fadeIn">
                <i class="fa-regular fa-folder-open fs-1 mb-3"></i>
                <p class="mb-0">No hay artículos en esta sección.</p>
                <small>Haz clic abajo para añadir tu primer producto.</small>
            </div>
        `;
        calculateTotals();
        return;
    }

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    paginatedItems.forEach((item, index) => {
        // Find actual global index in the state array (important for state mutation)
        const globalIndex = state.items.findIndex(i => i.id === item.id);

        const row = document.createElement('div');
        row.className = `list-group-item list-item-row p-2 animate__animated animate__fadeInUp ${item.checked ? 'checked' : ''}`;
        row.style.animationDelay = `${index * 0.03}s`;
        row.setAttribute('data-id', item.id);

        // Read-only list layout
        row.innerHTML = `
            <div class="d-flex align-items-center justify-content-between mb-2 p-1">
                <div class="d-flex align-items-center overflow-hidden flex-grow-1">
                    <div class="form-check m-0 fs-5 me-3 flex-shrink-0">
                        <input class="form-check-input cursor-pointer m-0" type="checkbox" 
                            ${item.checked ? 'checked' : ''} 
                            onchange="toggleCheck(${item.id})"
                            aria-label="Marcar como comprado">
                    </div>
                    <div class="flex-grow-1 fw-bold item-name fs-5 text-truncate" title="${escapeHtml(item.name)}">
                        ${escapeHtml(item.name) || '<em>Sin nombre</em>'}
                    </div>
                </div>
                
                <!-- Unified Edit Button (Pen Icon) -->
                <button class="btn btn-sm text-primary opacity-75 border-0 p-1 ms-2 flex-shrink-0" 
                    onmouseover="this.classList.remove('opacity-75')"
                    onmouseout="this.classList.add('opacity-75')"
                    onclick="openEditItemModal(${item.id})" 
                    title="Editar artículo"
                    aria-label="Editar">
                    <i class="fa-solid fa-pen fs-5"></i>
                </button>
                <!-- Unified Delete Button (Trash Icon) -->
                <button class="btn btn-sm text-danger opacity-75 border-0 p-1 ms-2 flex-shrink-0" 
                    onmouseover="this.classList.remove('opacity-75')"
                    onmouseout="this.classList.add('opacity-75')"
                    onclick="removeItem(${item.id})" 
                    title="Eliminar artículo"
                    aria-label="Eliminar">
                    <i class="fa-regular fa-trash-can fs-5"></i>
                </button>
            </div>
            
            <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 pb-1" style="padding-left: 2.75rem; padding-right: 0.5rem;">
                <div class="d-flex flex-wrap gap-2">
                    <!-- Quantity Badge -->
                    <div class="bg-body-tertiary px-2 py-1 rounded-pill text-nowrap border d-flex align-items-center">
                        <small class="text-muted me-1"><i class="fa-solid fa-boxes-stacked"></i></small>
                        <span class="fw-bold" style="font-size: 0.85rem;">${item.quantity || 1}</span>
                    </div>

                    <!-- Price Badge Bs -->
                    <div class="bg-body-tertiary px-2 py-1 rounded-pill text-nowrap border d-flex align-items-center">
                        <small class="text-muted me-1">Bs.</small>
                        <span class="fw-bold text-success" style="font-size: 0.85rem;">${item.price !== null ? formatCurrency(item.price) : '0,00'}</span>
                    </div>

                    <!-- Price Badge USD (only if exchange rate is set) -->
                    ${state.exchangeRate > 0 ? `
                    <div class="bg-body-tertiary px-2 py-1 rounded-pill text-nowrap border d-flex align-items-center">
                        <small class="text-muted me-1">$</small>
                        <span class="fw-bold text-primary" style="font-size: 0.85rem;">${item.price !== null ? formatCurrency(item.price / state.exchangeRate) : '0.00'}</span>
                    </div>` : ''}
                </div>
                </div>
            </div>
        `;

        listContainer.appendChild(row);
    });

    if (totalPages > 1) {
        const paginationWrapper = document.createElement('div');
        paginationWrapper.className = "d-flex justify-content-center align-items-center gap-3 mt-4 mb-2 animate__animated animate__fadeIn";
        
        const prevDisabled = currentPage === 1 ? 'disabled' : '';
        const nextDisabled = currentPage === totalPages ? 'disabled' : '';
        
        paginationWrapper.innerHTML = `
            <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" ${prevDisabled} onclick="setPage(${currentPage - 1})">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span class="text-muted small fw-semibold">Página ${currentPage} de ${totalPages}</span>
            <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" ${nextDisabled} onclick="setPage(${currentPage + 1})">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        `;
        
        listContainer.appendChild(paginationWrapper);
    }

    calculateTotals();
}

function setPage(page) {
    currentPage = page;
    renderList();
    document.getElementById('shopping-list-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openAddItemModal() {
    editingItemId = null;
    document.getElementById('addItemModalLabel').textContent = "Añadir Nuevo Artículo";
    document.querySelector('#addItemModal .modal-footer .btn-primary').textContent = "Guardar Artículo";
    
    document.getElementById('add-item-form').reset();
    document.getElementById('modal-item-quantity').value = 1;
    document.getElementById('modal-item-name').classList.remove('is-invalid');
    document.getElementById('modal-item-quantity').classList.remove('is-invalid');
    document.getElementById('modal-item-price').classList.remove('is-invalid');
    
    const currencySelect = document.getElementById('modal-item-currency');
    if (currencySelect) currencySelect.value = 'Bs';

    updateModalEquivalent();
    addItemModal.show();
    setTimeout(() => {
        document.getElementById('modal-item-name').focus();
    }, 400);
}

function openEditItemModal(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    
    editingItemId = id;
    
    document.getElementById('addItemModalLabel').textContent = "Editar Artículo";
    document.querySelector('#addItemModal .modal-footer .btn-primary').textContent = "Actualizar Artículo";
    
    document.getElementById('modal-item-name').value = item.name;
    document.getElementById('modal-item-quantity').value = item.quantity;
    document.getElementById('modal-item-name').classList.remove('is-invalid');
    document.getElementById('modal-item-quantity').classList.remove('is-invalid');
    document.getElementById('modal-item-price').classList.remove('is-invalid');
    
    const currencySelect = document.getElementById('modal-item-currency');
    if (currencySelect) currencySelect.value = 'Bs';
    
    document.getElementById('modal-item-price').value = item.price !== null ? item.price : '';
    
    updateModalEquivalent();
    addItemModal.show();
    setTimeout(() => {
        document.getElementById('modal-item-name').focus();
    }, 400);
}

function updateModalEquivalent() {
    const equivalentLabel = document.getElementById('modal-price-equivalent');
    if (!equivalentLabel) return;

    if (state.exchangeRate <= 0) {
        equivalentLabel.textContent = '';
        return;
    }

    const priceInput = document.getElementById('modal-item-price');
    const currencySelect = document.getElementById('modal-item-currency');
    const currency = currencySelect ? currencySelect.value : 'Bs';
    
    let price = parseFloat(priceInput.value);
    if (isNaN(price) || price <= 0) {
        equivalentLabel.textContent = '';
        return;
    }

    if (currency === 'Bs') {
        const usd = price / state.exchangeRate;
        equivalentLabel.textContent = `≈ $${formatCurrency(usd)}`;
    } else {
        const bs = price * state.exchangeRate;
        equivalentLabel.textContent = `≈ Bs. ${formatCurrency(bs)}`;
    }
}

function submitNewItem() {
    const nameInput = document.getElementById('modal-item-name');
    const qtyInput = document.getElementById('modal-item-quantity');
    const priceInput = document.getElementById('modal-item-price');
    const currencySelect = document.getElementById('modal-item-currency');

    nameInput.classList.remove('is-invalid');
    qtyInput.classList.remove('is-invalid');
    priceInput.classList.remove('is-invalid');

    let isValid = true;

    const name = nameInput.value.trim();
    if (!name) {
        nameInput.classList.add('is-invalid');
        isValid = false;
    }

    let qtyText = qtyInput.value.trim();
    let quantity = parseInt(qtyText);
    if (qtyText === "" || isNaN(quantity) || quantity < 1) {
        qtyInput.classList.add('is-invalid');
        isValid = false;
    }

    let priceText = priceInput.value.trim();
    if (priceText === "") {
        priceInput.classList.add('is-invalid');
        isValid = false;
    }

    if (!isValid) {
        return;
    }

    // Avoid duplicate items (case-insensitive)
    const isDuplicate = state.items.some(i => i.name.toLowerCase() === name.toLowerCase() && i.id !== editingItemId);
    if (isDuplicate) {
        showToast("⚠️ Este artículo ya está en la lista");
        nameInput.focus();
        return;
    }

    const currency = currencySelect ? currencySelect.value : 'Bs';

    let price = parseFloat(priceText);
    price = Math.max(0, price); // Nunca menos de 0
    
    if (currency === 'USD') {
        if (state.exchangeRate > 0) {
            price = price * state.exchangeRate;
        } else {
            showToast("⚠️ Define la tasa de cambio primero para usar $");
            return;
        }
    }

    if (editingItemId !== null) {
        const itemIndex = state.items.findIndex(i => i.id === editingItemId);
        if (itemIndex !== -1) {
            state.items[itemIndex].name = name;
            state.items[itemIndex].quantity = quantity;
            state.items[itemIndex].price = price;
        }
        showToast("Artículo actualizado");
        editingItemId = null;
    } else {
        state.items.push({
            id: Date.now(),
            name: name,
            price: price,
            quantity: quantity,
            checked: false
        });
        showToast("Artículo añadido");
        
        // Jump to the last page when a new item is added
        currentPage = Math.ceil(state.items.length / ITEMS_PER_PAGE);
    }

    saveToLocalStorage();
    
    renderList();
    addItemModal.hide();
}

// Toggle Buy Status
function toggleCheck(id) {
    const index = state.items.findIndex(item => item.id === id);
    if (index !== -1) {
        state.items[index].checked = !state.items[index].checked;
        saveToLocalStorage();
        renderList();
    }
}

let lastDeletedItem = null;
let lastDeletedIndex = null;

// Remove single item from the index
function removeItem(id) {
    const index = state.items.findIndex(item => item.id === id);
    if (index !== -1) {
        lastDeletedItem = state.items[index];
        lastDeletedIndex = index;
        
        state.items.splice(index, 1);
        
        saveToLocalStorage();
        renderList();
        showToast("Artículo eliminado", undoDelete);
    }
}

// Undo the last deletion
function undoDelete() {
    if (lastDeletedItem !== null && lastDeletedIndex !== null) {
        state.items.splice(lastDeletedIndex, 0, lastDeletedItem);
        saveToLocalStorage();
        renderList();
        
        lastDeletedItem = null;
        lastDeletedIndex = null;
        
        const toastEl = document.getElementById('feedback-toast');
        const toast = bootstrap.Toast.getInstance(toastEl);
        if (toast) {
            toast.hide();
        }
    }
}

// Calculate Totals, Percentages and progress metrics
function calculateTotals() {
    let totalBs = 0;
    let totalCheckedCount = 0;
    let totalCount = state.items.length;

    state.items.forEach(item => {
        const price = item.price && !isNaN(item.price) ? item.price : 0;
        const quantity = item.quantity && !isNaN(item.quantity) ? item.quantity : 1;

        if (!item.checked) {
            totalBs += price * quantity;
        }

        if (item.checked) {
            totalCheckedCount++;
        }
    });

    const fullBs = formatCurrency(totalBs);
    const totalUSD = state.exchangeRate > 0 ? totalBs / state.exchangeRate : 0;
    const fullUSD = formatCurrency(totalUSD);

    // Determine which currency to display
    const showUsd = state.displayCurrency === 'usd' && state.exchangeRate > 0;

    // Update the toggle button label
    const toggleBtn = document.getElementById('currency-toggle-label');
    if (toggleBtn) {
        toggleBtn.textContent = showUsd ? '$ ⇄ Bs' : 'Bs ⇄ $';
    }
    // Show/hide toggle button only when a rate is available
    const currencyBtn = document.getElementById('currency-toggle-btn');
    if (currencyBtn) {
        currencyBtn.style.visibility = state.exchangeRate > 0 ? 'visible' : 'hidden';
    }

    if (showUsd) {
        // --- Dollar mode ---
        if (totalUSD >= 1000000) {
            const truncatedUSD = fullUSD.substring(0, 7) + '...';
            totalDisplay.innerHTML = `$${truncatedUSD} <button class="btn btn-light text-primary py-0 px-2 ms-2 rounded-pill shadow-sm" onclick="showFullTotalModal()" style="font-size: 0.5em; vertical-align: middle;">Ver más</button>`;
        } else {
            totalDisplay.innerHTML = `$${fullUSD}`;
        }
        // Show Bs equivalent below
        usdTotalWrapper.classList.remove('d-none');
        usdTotalDisplay.innerHTML = `Bs. ${totalBs >= 1000000 ? fullBs.substring(0, 7) + '...' : fullBs}`;
        usdTotalWrapper.querySelector('span')?.previousSibling?.remove?.();
        // Fix the label text
        usdTotalWrapper.innerHTML = `Equiv: <span id="usd-total-display">Bs. ${totalBs >= 1000000 ? fullBs.substring(0, 7) + '...' : fullBs}</span>`;
    } else {
        // --- Bolívar mode ---
        if (totalBs >= 1000000) {
            const truncatedBs = fullBs.substring(0, 7) + '...';
            totalDisplay.innerHTML = `Bs. ${truncatedBs} <button class="btn btn-light text-primary py-0 px-2 ms-2 rounded-pill shadow-sm" onclick="showFullTotalModal()" style="font-size: 0.5em; vertical-align: middle;">Ver más</button>`;
        } else {
            totalDisplay.innerHTML = `Bs. ${fullBs}`;
        }
        if (state.exchangeRate > 0) {
            usdTotalWrapper.classList.remove('d-none');
            usdTotalWrapper.innerHTML = `Equiv: <span id="usd-total-display">$${totalUSD >= 1000000 ? fullUSD.substring(0, 7) + '...' : fullUSD}</span>`;
        } else {
            usdTotalWrapper.classList.add('d-none');
        }
    }

    // Update Modal Display
    const modalTotalBs = document.getElementById('modal-total-bs');
    if (modalTotalBs) modalTotalBs.textContent = `Bs. ${fullBs}`;
    const modalTotalUsd = document.getElementById('modal-total-usd');
    if (modalTotalUsd) {
        if (state.exchangeRate > 0) {
            modalTotalUsd.textContent = `Equivalente: $${fullUSD}`;
            modalTotalUsd.classList.remove('d-none');
        } else {
            modalTotalUsd.classList.add('d-none');
        }
    }

    // Update Progress Trackers
    const percentage = totalCount > 0 ? Math.round((totalCheckedCount / totalCount) * 100) : 0;
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage);
    progressText.textContent = `${totalCheckedCount} de ${totalCount} productos comprados`;
    progressPercentage.textContent = `${percentage}%`;
}

// Toggle between Bs and USD display with a flip animation
function toggleCurrencyDisplay() {
    if (state.exchangeRate <= 0) return;

    const flipText = document.getElementById('total-display');
    flipText.classList.add('flipping');

    setTimeout(() => {
        state.displayCurrency = state.displayCurrency === 'bs' ? 'usd' : 'bs';
        calculateTotals();
        flipText.classList.remove('flipping');
    }, 180);
}

function showFullTotalModal() {
    if (fullTotalModal) fullTotalModal.show();
}

function openEditRateModal() {
    document.getElementById('custom-rate-input').value = state.exchangeRate || '';
    editRateModal.show();
    setTimeout(() => document.getElementById('custom-rate-input').focus(), 500);
}

function submitCustomRate() {
    const val = parseFloat(document.getElementById('custom-rate-input').value);
    if (!isNaN(val) && val > 0) {
        state.exchangeRate = val;
        saveToLocalStorage();
        document.getElementById('exchange-rate-input').value = val;
        calculateTotals();
        editRateModal.hide();
        showToast("Tasa de cambio actualizada");
    }
}

// Fetch latest Exchange Rate from BCV
async function tasaDeCambio() {
    const rateInput = document.getElementById('exchange-rate-input');
    const refreshBtn = document.querySelector('button[onclick="tasaDeCambio()"]');
    const refreshIcon = refreshBtn ? refreshBtn.querySelector('i') : null;

    // Spinner animation while loading
    if (refreshBtn) refreshBtn.disabled = true;
    if (refreshIcon) {
        refreshIcon.classList.add('fa-spin');
    }

    if (rateInput && !rateInput.value) {
        rateInput.placeholder = "Consultando...";
    }

    const previousRate = state.exchangeRate;

    try {
        const respuesta = await fetch("https://ve.dolarapi.com/v1/dolares");
        if (!respuesta.ok) {
            throw new Error(`Error HTTP: ${respuesta.status}`);
        }

        const datos = await respuesta.json();
        // Obtener la tasa oficial del BCV
        const bcv = datos.find(d => d.fuente === 'oficial');
        
        if (bcv && bcv.promedio) {
            const newRate = bcv.promedio.toFixed(2);

            if (previousRate > 0 && previousRate === newRate) {
                showToast(`✓ Tasa ya actualizada: Bs. ${formatCurrency(newRate)}`);
            } else {
                state.exchangeRate = newRate;
                if (rateInput) {
                    rateInput.value = newRate;
                }
                saveToLocalStorage();
                calculateTotals();
                showToast(`🔄 Tasa actualizada: Bs. ${formatCurrency(newRate)} por $`);
            }
        } else {
            showToast("⚠️ No se pudo obtener la tasa BCV");
        }
    } catch (error) {
        console.error("Error al obtener la tasa de cambio:", error);
        showToast("❌ Error al consultar la tasa BCV");
        if (rateInput && !rateInput.value) {
            rateInput.placeholder = "Error al consultar";
        }
    } finally {
        // Remove spinner and re-enable button
        if (refreshIcon) {
            refreshIcon.classList.remove('fa-spin');
        }
        if (refreshBtn) refreshBtn.disabled = false;
    }
}

// Toggle Items Filter view
function filterList(filter) {
    state.activeFilter = filter;
    currentPage = 1;
    renderList();
}

// Display Confirm Modal for clearing list
function confirmClearAll() {
    clearAllModal.show();
}

// Execute absolute wipeout
function executeClearAll() {
    state.items = [];
    saveToLocalStorage();
    clearAllModal.hide();
    renderList();
    showToast("Lista vaciada correctamente");
}

// Utility: Number formatter (Venezuelan and international currency format style)
function formatCurrency(num) {
    return num.toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Utility: Escape malicious HTML entries
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Utility: Toast feedback indicator
function showToast(msg, undoCallback = null) {
    const toastEl = document.getElementById('feedback-toast');
    document.getElementById('toast-message').textContent = msg;
    
    const actionContainer = document.getElementById('toast-action');
    const undoBtn = document.getElementById('toast-undo-btn');
    
    let toast = bootstrap.Toast.getInstance(toastEl);
    if (toast) {
        toast.dispose();
    }
    
    if (undoCallback) {
        actionContainer.classList.remove('d-none');
        undoBtn.onclick = undoCallback;
        toast = new bootstrap.Toast(toastEl, { delay: 5000 }); // Mayor tiempo para permitir deshacer
    } else {
        actionContainer.classList.add('d-none');
        undoBtn.onclick = null;
        toast = new bootstrap.Toast(toastEl, { delay: 2500 });
    }
    
    toast.show();
}

// Dark/Light Theme Handler
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeUI(newTheme);
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    // If user has system preference
    if (!savedTheme) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const active = prefersDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-bs-theme', active);
        updateThemeUI(active);
    } else {
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
        updateThemeUI(savedTheme);
    }
}

function updateThemeUI(theme) {
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    if (theme === 'dark') {
        icon.className = 'fa-solid fa-sun me-1';
        text.textContent = 'Modo Claro';
    } else {
        icon.className = 'fa-solid fa-moon me-1';
        text.textContent = 'Modo Oscuro';
    }
}

// Copy total to clipboard
function copyTotalToClipboard() {
    let totalBs = 0;
    state.items.forEach(item => {
        const price = item.price && !isNaN(item.price) ? item.price : 0;
        const quantity = item.quantity && !isNaN(item.quantity) ? item.quantity : 1;
        if (!item.checked) totalBs += price * quantity;
    });

    const showUsd = state.displayCurrency === 'usd' && state.exchangeRate > 0;
    let textToCopy = "";
    
    if (showUsd) {
        const totalUSD = totalBs / state.exchangeRate;
        textToCopy = `$${formatCurrency(totalUSD)}`;
    } else {
        textToCopy = `Bs. ${formatCurrency(totalBs)}`;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast(`📋 Copiado al portapapeles: ${textToCopy}`);
        
        // Add visual animation effect to the button
        const btn = document.getElementById('copy-total-btn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                // Change to check icon
                icon.className = 'fa-solid fa-check text-success';
                
                // Add rubberBand bounce effect
                btn.classList.add('animate__animated', 'animate__rubberBand');
                
                // Reset after 1.5 seconds
                setTimeout(() => {
                    icon.className = 'fa-regular fa-copy';
                    btn.classList.remove('animate__animated', 'animate__rubberBand');
                }, 1500);
            }
        }
    }).catch(err => {
        console.error("Error al copiar: ", err);
        showToast("❌ Error al copiar el monto");
    });
}

// Generate and Share the formatted list
function shareList() {
    if (state.items.length === 0) {
        showToast("⚠️ La lista está vacía");
        return;
    }

    const title = state.title.trim() || "Lista Pendiente";
    let text = `${title} - Ultralista App:\n`;
    
    state.items.forEach((item, index) => {
        const priceBs = item.price ? formatCurrency(item.price) : '0,00';
        let pricePart = `${priceBs} Bs.`;
        if (state.exchangeRate > 0) {
            const usdVal = item.price ? (item.price / state.exchangeRate).toFixed(2) : 0;
            pricePart = `${priceBs} Bs. / $${formatCurrency(usdVal)}`;
        }
        
        const qtyText = item.quantity > 1 ? ` (x${item.quantity})` : '';
        text += `- ${item.name}${qtyText} - ${pricePart}.\n`;
        if (index < state.items.length - 1) {
            text += `-----------\n`;
        }
    });

    if (navigator.share) {
        navigator.share({
            title: title,
            text: text
        }).catch(err => {
            console.error("Error al compartir (o usuario canceló):", err);
            // Intentamos copiar como fallback
            copyToClipboardShare(text);
        });
    } else {
        copyToClipboardShare(text);
    }
}

function copyToClipboardShare(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("📋 Lista copiada al portapapeles");
    }).catch(err => {
        console.error("Error al copiar lista: ", err);
        showToast("❌ Error al copiar la lista");
    });
}
