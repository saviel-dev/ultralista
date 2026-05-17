// Application State
let state = {
    title: "Mi Lista de Compras",
    items: [],
    exchangeRate: 0,
    activeFilter: 'all' // 'all', 'pending', 'completed'
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

// On window load
window.onload = function () {
    clearAllModal = new bootstrap.Modal(document.getElementById('clearAllModal'));
    loadFromLocalStorage();
    applySavedTheme();
    renderList();

    // Automatically fetch latest exchange rate
    tasaDeCambio();

    // Add shortcut F1 to add new element easily
    document.addEventListener('keydown', function (e) {
        if (e.key === 'F1') {
            e.preventDefault();
            addNewItem(true);
        }
    });
};

// Load state from LocalStorage
function loadFromLocalStorage() {
    const savedState = localStorage.getItem('supermarket_list_state');
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            state.title = parsed.title || "Mi Lista de Compras";
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

    // If empty, initialize with an empty item row with quantity
    if (state.items.length === 0) {
        state.items.push({
            id: Date.now(),
            name: "",
            price: null,
            quantity: 1,
            checked: false
        });
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
        if (filter === state.activeFilter) {
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-primary');
        } else {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-secondary');
        }
    });

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

    filteredItems.forEach((item, index) => {
        // Find actual global index in the state array (important for state mutation)
        const globalIndex = state.items.findIndex(i => i.id === item.id);

        const row = document.createElement('div');
        row.className = `list-group-item list-item-row p-2 animate__animated animate__fadeInUp ${item.checked ? 'checked' : ''}`;
        row.style.animationDelay = `${index * 0.03}s`;
        row.setAttribute('data-id', item.id);

        // Reverted to traditional Bootstrap input-group layout
        row.innerHTML = `
            <div class="row g-2 align-items-center m-0">
                <!-- Checkbox & Name (Full width on mobile, sharing space on md) -->
                <div class="col-12 col-md-5 d-flex align-items-center">
                    <div class="form-check m-0 fs-5 me-2">
                        <input class="form-check-input cursor-pointer m-0" type="checkbox" 
                            ${item.checked ? 'checked' : ''} 
                            onchange="toggleCheck(${item.id})"
                            aria-label="Marcar como comprado">
                    </div>
                    
                    <input type="text" 
                        id="name-${globalIndex}" 
                        class="form-control border-0 bg-transparent fw-semibold shadow-none item-name px-0 flex-grow-1" 
                        placeholder="Nombre del producto" 
                        value="${escapeHtml(item.name)}" 
                        oninput="updateItem(${globalIndex}, 'name', this.value)"
                        onkeydown="handleKeyDown(event, ${globalIndex}, 'name')"
                        aria-label="Nombre del producto">
                        
                    <!-- Mobile Delete Button -->
                    <button class="btn btn-sm text-danger border-0 d-md-none ms-2 px-2" 
                        onclick="removeItem(${item.id})" 
                        title="Eliminar artículo"
                        aria-label="Eliminar">
                        <i class="fa-solid fa-xmark fs-5"></i>
                    </button>
                </div>
                
                <!-- Quantity & Price Fields -->
                <div class="col-12 col-md-7">
                    <div class="row g-2 align-items-center">
                        <!-- Quantity -->
                        <div class="col-6 col-md-5">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text bg-body-tertiary"><i class="fa-solid fa-boxes-stacked text-muted"></i></span>
                                <input type="number" 
                                    id="quantity-${globalIndex}" 
                                    class="form-control text-center fw-bold" 
                                    placeholder="1" min="1" step="1"
                                    value="${item.quantity || 1}" 
                                    oninput="updateItem(${globalIndex}, 'quantity', this.value)"
                                    onkeydown="handleKeyDown(event, ${globalIndex}, 'quantity')"
                                    aria-label="Cantidad">
                            </div>
                        </div>

                        <!-- Price -->
                        <div class="col-6 col-md-5">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text bg-body-tertiary fw-bold">Bs.</span>
                                <input type="number" 
                                    id="price-${globalIndex}"
                                    class="form-control text-end fw-bold text-success" 
                                    placeholder="0,00" step="any" min="0"
                                    value="${item.price !== null ? item.price : ''}" 
                                    oninput="updateItem(${globalIndex}, 'price', this.value)"
                                    onkeydown="handleKeyDown(event, ${globalIndex}, 'price')"
                                    aria-label="Precio unitario en Bolívares">
                            </div>
                        </div>

                        <!-- Desktop Delete Button -->
                        <div class="col-md-2 d-none d-md-block text-end">
                            <button class="btn btn-sm btn-outline-danger border-0" 
                                onclick="removeItem(${item.id})" 
                                title="Eliminar artículo"
                                aria-label="Eliminar">
                                <i class="fa-solid fa-xmark fs-5"></i>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Subtotal Display -->
                <div class="col-12 d-none d-md-block text-end mt-1">
                    <span class="text-muted" style="font-size: 0.7rem; text-transform: uppercase;">Subtotal:</span>
                    <span class="fw-bold ms-1" id="subtotal-${globalIndex}">Bs. ${formatCurrency((item.price || 0) * (item.quantity || 1))}</span>
                </div>
            </div>
        `;

        listContainer.appendChild(row);
    });

    calculateTotals();
}

// Navigation and Fluid row creation logic using keyboard
function handleKeyDown(event, index, field) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Stop submitting form actions

        if (field === 'name') {
            // Focus the quantity field on the SAME row
            const quantityField = document.getElementById(`quantity-${index}`);
            if (quantityField) {
                quantityField.focus();
                quantityField.select(); // auto highlight
            }
        } else if (field === 'quantity') {
            // Focus the price field on the SAME row
            const priceField = document.getElementById(`price-${index}`);
            if (priceField) {
                priceField.focus();
                priceField.select(); // auto highlight
            }
        } else if (field === 'price') {
            // If we are at the very last element of the list, add a new one
            if (index === state.items.length - 1) {
                addNewItem(false); // Add internally

                // Wait for render to finish, then focus the new Name field
                setTimeout(() => {
                    const newNameField = document.getElementById(`name-${state.items.length - 1}`);
                    if (newNameField) {
                        newNameField.focus();
                        newNameField.select();
                    }
                }, 50);
            } else {
                // If there are more elements below, focus the next row's name field
                const nextNameField = document.getElementById(`name-${index + 1}`);
                if (nextNameField) {
                    nextNameField.focus();
                    nextNameField.select();
                }
            }
        }
    }
}

// Add blank product item to state with default quantity of 1
function addNewItem(shouldFocus = false) {
    const newItemId = Date.now();
    state.items.push({
        id: newItemId,
        name: "",
        price: null,
        quantity: 1,
        checked: false
    });

    saveToLocalStorage();
    renderList();

    if (shouldFocus) {
        setTimeout(() => {
            const lastIndex = state.items.length - 1;
            const newNameField = document.getElementById(`name-${lastIndex}`);
            if (newNameField) {
                newNameField.focus();
            }
        }, 50);
    }
}

// Update single key values inside state
function updateItem(index, key, value) {
    if (key === 'price') {
        // Parse number safely
        const numValue = value === '' ? null : parseFloat(value);
        state.items[index].price = numValue;
    } else if (key === 'quantity') {
        const intValue = value === '' ? 1 : parseInt(value);
        state.items[index].quantity = !isNaN(intValue) && intValue > 0 ? intValue : 1;
    } else {
        state.items[index].name = value;
    }
    saveToLocalStorage();

    // Dynamic Subtotal display update directly in the DOM for fast responsiveness
    const subtotalLabel = document.getElementById(`subtotal-${index}`);
    if (subtotalLabel) {
        const price = state.items[index].price || 0;
        const quantity = state.items[index].quantity || 1;
        subtotalLabel.textContent = `Bs. ${formatCurrency(price * quantity)}`;
    }

    calculateTotals(); // quick reactive total calculation
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

// Remove single item from the index
function removeItem(id) {
    state.items = state.items.filter(item => item.id !== id);

    // Ensure there is always at least one editable row
    if (state.items.length === 0) {
        state.items.push({
            id: Date.now(),
            name: "",
            price: null,
            quantity: 1,
            checked: false
        });
    }

    saveToLocalStorage();
    renderList();
    showToast("Artículo eliminado");
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

    // Update Header Display (Bolívares)
    totalDisplay.textContent = `Bs. ${formatCurrency(totalBs)}`;

    // Handle optional Dollar Exchange Rate conversion
    if (state.exchangeRate > 0) {
        usdTotalWrapper.classList.remove('d-none');
        const totalUSD = totalBs / state.exchangeRate;
        usdTotalDisplay.textContent = `$${formatCurrency(totalUSD)}`;
    } else {
        usdTotalWrapper.classList.add('d-none');
    }

    // Update Progress Trackers
    const percentage = totalCount > 0 ? Math.round((totalCheckedCount / totalCount) * 100) : 0;
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage);
    progressText.textContent = `${totalCheckedCount} de ${totalCount} productos comprados`;
    progressPercentage.textContent = `${percentage}%`;
}

// Fetch latest Exchange Rate from BCV
async function tasaDeCambio() {
    const rateInput = document.getElementById('exchange-rate-input');
    if (rateInput && !rateInput.value) {
        rateInput.placeholder = "Consultando...";
    }

    try {
        const respuesta = await fetch("https://ve.dolarapi.com/v1/dolares");
        if (!respuesta.ok) {
            throw new Error(`Error HTTP: ${respuesta.status}`);
        }

        const datos = await respuesta.json();
        // Obtener la tasa oficial del BCV
        const bcv = datos.find(d => d.fuente === 'oficial');
        
        if (bcv && bcv.promedio) {
            state.exchangeRate = bcv.promedio;
            if (rateInput) {
                rateInput.value = state.exchangeRate;
            }
            saveToLocalStorage();
            calculateTotals();
        }
    } catch (error) {
        console.error("Error al obtener la tasa de cambio:", error);
        if (rateInput && !rateInput.value) {
            rateInput.placeholder = "Error al consultar";
        }
    }
}

// Toggle Items Filter view
function filterList(filter) {
    state.activeFilter = filter;
    renderList();
}

// Display Confirm Modal for clearing list
function confirmClearAll() {
    clearAllModal.show();
}

// Execute absolute wipeout
function executeClearAll() {
    state.items = [{
        id: Date.now(),
        name: "",
        price: null,
        quantity: 1,
        checked: false
    }];
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
function showToast(msg) {
    const toastEl = document.getElementById('feedback-toast');
    document.getElementById('toast-message').textContent = msg;
    const toast = new bootstrap.Toast(toastEl, { delay: 2000 });
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
