// renderer.js

// Global variable to store fetched case data (now includes ROI, csroiImageUrl, steamImageUrl)
let availableCaseData = []; 
// Global variable to manage sorting of available cases
let currentSort = { type: 'roi', order: 'desc' }; // Default sort by ROI descending

// Key Cost constant - ensure this matches the actual key cost
const KEY_COST = 2.49; // From your HTML span#keyCostDisplay

// --- DOM Element Selections ---
const tableBody = document.getElementById('caseTableBody');
const addCaseBtn = document.getElementById('addCaseBtn');
const refreshPricesBtn = document.getElementById('refreshPricesBtn');
const totalSpentEl = document.getElementById('totalSpent');
const leftoverEl = document.getElementById('leftover');
const deficitMsg = document.getElementById('deficitMessage');
const taxRateInput = document.getElementById('taxRate');
const budgetInput = document.getElementById('budget');
const totalCasesEl = document.getElementById('totalCases');
const keyCostDisplay = document.getElementById('keyCostDisplay'); // Ensure this matches the ID in HTML

// Available Cases Grid & Sort Buttons
const availableCasesGrid = document.getElementById('availableCasesGrid');
const sortNameAscBtn = document.getElementById('sortNameAsc');
const sortNameDescBtn = document.getElementById('sortNameDesc');
const sortPriceAscBtn = document.getElementById('sortPriceAsc');
const sortPriceDescBtn = document.getElementById('sortPriceDesc');
const sortRoiBtn = document.getElementById('sortRoiBtn'); // NEW: Sort by ROI button

// --- Initial Data for Planner (will be updated by live prices) ---
// This 'cases' array is specifically for managing the planner's dropdown and current selections.
// Its prices will be updated by 'updateLivePrices'.
let cases = [
    { name: "CS:GO Weapon Case", price: 0, roi: null }, // Price will be updated dynamically
    { name: "CS:GO Weapon Case 2", price: 0, roi: null },
    { name: "CS:GO Weapon Case 3", price: 0, roi: null },
    { name: "eSports 2013 Case", price: 0, roi: null },
    { name: "eSports 2013 Winter Case", price: 0, roi: null },
    { name: "eSports 2014 Summer Case", price: 0, roi: null },
    { name: "Operation Bravo Case", price: 0, roi: null },
    { name: "Operation Phoenix Case", price: 0, roi: null },
    { name: "Operation Breakout Case", price: 0, roi: null },
    { name: "Operation Vanguard Case", price: 0, roi: null },
    { name: "Chroma Case", price: 0, roi: null },
    { name: "Chroma 2 Case", price: 0, roi: null },
    { name: "Falchion Case", price: 0, roi: null },
    { name: "Shadow Case", price: 0, roi: null },
    { name: "Revolver Case", price: 0, roi: null },
    { name: "Operation Wildfire Case", price: 0, roi: null },
    { name: "Chroma 3 Case", price: 0, roi: null },
    { name: "Gamma Case", price: 0, roi: null },
    { name: "Gamma 2 Case", price: 0, roi: null },
    { name: "Glove Case", price: 0, roi: null },
    { name: "Spectrum Case", price: 0, roi: null },
    { name: "Operation Hydra Case", price: 0, roi: null },
    { name: "Spectrum 2 Case", price: 0, roi: null },
    { name: "Clutch Case", price: 0, roi: null },
    { name: "Horizon Case", price: 0, roi: null },
    { name: "Danger Zone Case", price: 0, roi: null },
    { name: "Prisma Case", price: 0, roi: null },
    { name: "CS20 Case", price: 0, roi: null },
    { name: "Shattered Web Case", price: 0, roi: null },
    { name: "Prisma 2 Case", price: 0, roi: null },
    { name: "Fracture Case", price: 0, roi: null },
    { name: "Snakebite Case", price: 0, roi: null },
    { name: "Operation Riptide Case", price: 0, roi: null },
    { name: "Dreams & Nightmares Case", price: 0, roi: null },
    { name: "Recoil Case", price: 0, roi: null },
    { name: "Revolution Case", price: 0, roi: null },
    { name: "Anubis Collection Package", price: 0, roi: null },
    { name: "Kilowatt Case", price: 0, roi: null }
];

// --- Event Listeners ---
window.addEventListener('DOMContentLoaded', async () => {
    // Initial fetch and render when the app starts
    await updateLivePrices();
    if (tableBody.children.length === 0) {
        createRow(); // Add an initial row to the planner if none exist
    }
    updateTotals(); // Calculate initial totals
});

addCaseBtn.addEventListener('click', () => createRow());
refreshPricesBtn.addEventListener('click', () => updateLivePrices());

budgetInput.addEventListener('input', updateTotals);
taxRateInput.addEventListener('input', updateTotals);

// Sort button event listeners
sortNameAscBtn.addEventListener('click', () => {
    currentSort = { type: 'name', order: 'asc' };
    sortAndRenderAvailableCases();
});
sortNameDescBtn.addEventListener('click', () => {
    currentSort = { type: 'name', order: 'desc' };
    sortAndRenderAvailableCases();
});
sortPriceAscBtn.addEventListener('click', () => {
    currentSort = { type: 'price', order: 'asc' };
    sortAndRenderAvailableCases();
});
sortPriceDescBtn.addEventListener('click', () => {
    currentSort = { type: 'price', order: 'desc' };
    sortAndRenderAvailableCases();
});
// NEW: Sort by ROI button listener
sortRoiBtn.addEventListener('click', () => {
    // Toggle ROI sort order
    if (currentSort.type === 'roi' && currentSort.order === 'desc') {
        currentSort = { type: 'roi', order: 'asc' };
    } else {
        currentSort = { type: 'roi', order: 'desc' }; // Default to descending if not currently ROI or if ascending
    }
    sortAndRenderAvailableCases();
});


// --- Core Functions ---

/**
 * Updates the live prices of all cases by fetching them from Steam
 * via the main process.
 * Then, it rebuilds both tables to reflect the new prices.
 */
async function updateLivePrices() {
    refreshPricesBtn.disabled = true; // Disable button during fetch
    refreshPricesBtn.textContent = 'Refreshing...';
    availableCasesGrid.innerHTML = '<p>Fetching latest prices...</p>'; // Show loading message

    try {
        const rawFetchedCaseData = await window.electronAPI.fetchAllCasePrices(); 
        
        // --- NEW: Deduplicate fetchedCaseData ---
        const uniqueCasesMap = new Map(); // Map to store unique cases by name
        rawFetchedCaseData.forEach(caseItem => {
            // Use caseItem.name as the key to ensure uniqueness.
            // If there are duplicates, the last one processed will overwrite previous ones.
            uniqueCasesMap.set(caseItem.name, caseItem); 
        });
        availableCaseData = Array.from(uniqueCasesMap.values()); // Convert Map values back to an array
        // --- END Deduplication ---

        // Optional: Log the data to console to verify duplicates before/after deduplication
        // console.log("Raw fetched data (may contain duplicates):", rawFetchedCaseData);
        // console.log("Deduplicated data for grid:", availableCaseData);

        // Update prices in the 'cases' array (for the planner table's dropdowns)
        // Also, add new cases to 'cases' array if they weren't predefined
        for (const fetchedCase of availableCaseData) { // Use the deduplicated data here
            let found = false;
            for (let i = 0; i < cases.length; i++) { // Iterate using index for modification
                if (cases[i].name === fetchedCase.name) {
                    cases[i].price = fetchedCase.price;
                    cases[i].roi = fetchedCase.roi; // Also update ROI in the planner's 'cases' array
                    found = true;
                    break;
                }
            }
            if (!found) {
                // Add new cases found during scrape to the 'cases' array for planner dropdowns
                cases.push({ name: fetchedCase.name, price: fetchedCase.price, roi: fetchedCase.roi });
            }
        }

        // Apply the current sort order and render the available cases grid
        sortAndRenderAvailableCases();
        
        // Rebuild the planner table to reflect any price updates
        rebuildTable();
        
        // Update totals after all prices are refreshed
        updateTotals();

    } catch (error) {
        console.error('Failed to fetch case data:', error);
        availableCasesGrid.innerHTML = `<p>Error loading cases: ${error.message}. Check console for details.</p>`;
    } finally {
        refreshPricesBtn.disabled = false;
        refreshPricesBtn.textContent = '🔄 Refresh Prices';
    }
}

/**
 * Sorts the availableCaseData based on currentSort state and then renders the grid.
 */
function sortAndRenderAvailableCases() {
    availableCaseData.sort((a, b) => {
        switch (currentSort.type) {
            case 'name':
                const nameA = a.name.toLowerCase();
                const nameB = b.name.toLowerCase();
                if (currentSort.order === 'asc') {
                    return nameA.localeCompare(nameB);
                } else {
                    return nameB.localeCompare(nameA);
                }
            case 'price':
                if (currentSort.order === 'asc') {
                    return a.price - b.price;
                } else {
                    return b.price - a.price;
                }
            case 'roi': // NEW: ROI sorting logic
                const roiA = a.roi;
                const roiB = b.roi;

                // Handle null/N/A ROIs: N/A values always go to the end
                if (roiA === null && roiB === null) {
                    return 0; // Both N/A, keep original relative order
                }
                if (roiA === null) {
                    return 1; // A is N/A, send A to the end
                }
                if (roiB === null) {
                    return -1; // B is N/A, send B to the end
                }

                // Compare numerical ROIs
                if (currentSort.order === 'desc') {
                    return roiB - roiA; // Descending order (higher ROI first)
                } else {
                    return roiA - roiB; // Ascending order (lower ROI first)
                }
            default:
                return 0; // No specific sort
        }
    });
    renderAvailableCasesGrid(); // Always re-render after sort
}

/**
 * Renders the available cases in the grid format.
 * Assumes availableCaseData contains objects with name, price, roi, csroiImageUrl, and steamImageUrl.
 */
/**
 * Renders the available cases in the grid format.
 * Assumes availableCaseData contains objects with name, price, roi, csroiImageUrl, and steamImageUrl.
 */
function renderAvailableCasesGrid() {
    availableCasesGrid.innerHTML = '';
    if (availableCaseData.length === 0) {
        availableCasesGrid.innerHTML = '<p>No case prices available. Try refreshing.</p>';
        return;
    }

    availableCaseData.forEach(caseItem => {
        const card = document.createElement('div');
        card.classList.add('case-card');

        // Construct the Steam Market URL
        // We need to encode the case name to be URL-safe
        const encodedCaseName = encodeURIComponent(caseItem.name);
        const steamMarketUrl = `https://steamcommunity.com/market/listings/730/${encodedCaseName}`;

        card.innerHTML = `
            <h4>
                <a href="${steamMarketUrl}" target="_blank" rel="noopener noreferrer" class="case-link">
                    ${caseItem.name}
                </a>
            </h4>
            <img 
                src="${caseItem.csroiImageUrl || caseItem.steamImageUrl || ''}" 
                alt="${caseItem.name}" 
                class="case-image"
                onerror="this.onerror=null; this.src='${caseItem.steamImageUrl || ''}'; console.error('Image load failed for ${caseItem.name}, falling back to Steam image.');"
            >
            <p class="case-roi">${caseItem.roi !== null ? `ROI: ${caseItem.roi.toFixed(2)}%` : 'ROI: N/A'}</p>
            <p class="case-price">$${caseItem.price.toFixed(2)}</p>
            <button class="add-to-planner-btn" data-case-name="${caseItem.name}" data-case-price="${caseItem.price}">Add to Planner</button>
        `;
        availableCasesGrid.appendChild(card);
    });

    // Add event listeners for "Add to Planner" buttons after rendering
    document.querySelectorAll('.add-to-planner-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const caseName = event.target.dataset.caseName;
            
            // Find the full case data from availableCaseData to ensure all properties are included
            const fullCaseData = availableCaseData.find(item => item.name === caseName);
            
            if (fullCaseData) {
                // Find or add the case to the main 'cases' array if it's not there
                let caseIndex = cases.findIndex(c => c.name === caseName);
                if (caseIndex === -1) {
                    // Add all relevant properties (name, price, roi for now)
                    cases.push({ 
                        name: fullCaseData.name, 
                        price: fullCaseData.price, 
                        roi: fullCaseData.roi 
                    });
                    caseIndex = cases.length - 1; // Get the index of the newly added case
                } else {
                    // Update price and ROI in case it changed (for existing cases in 'cases' array)
                    cases[caseIndex].price = fullCaseData.price;
                    cases[caseIndex].roi = fullCaseData.roi;
                }
                
                // Now create the row in the planner table
                createRow(caseIndex, 1);
            } else {
                console.error("Failed to find case data for planner after click:", caseName);
            }
        });
    });
}

/**
 * Rebuilds the planner table, preserving quantities and selected cases
 * if possible, otherwise resetting.
 */
function rebuildTable() {
    const existingRowsData = [];
    tableBody.querySelectorAll('tr').forEach(row => {
        const caseSelect = row.children[0].querySelector('select'); // Use querySelector for robustness
        const qtyInput = row.children[2].querySelector('input'); // Use querySelector for robustness
        const selectedCaseName = caseSelect.options[caseSelect.selectedIndex].textContent; // Get name, not just index

        // Find the case's current index in the updated 'cases' array
        const newIndex = cases.findIndex(c => c.name === selectedCaseName);
        
        if (newIndex !== -1) {
            existingRowsData.push({
                caseIndex: newIndex, // Store the new index
                quantity: parseInt(qtyInput.value) || 0
            });
        } else {
            console.warn(`Previously selected case "${selectedCaseName}" not found in updated price list. Skipping.`);
        }
    });

    tableBody.innerHTML = ''; // Clear existing rows

    if (existingRowsData.length > 0) {
        existingRowsData.forEach(data => {
            createRow(data.caseIndex, data.quantity);
        });
    } else {
        createRow(); // Add an empty row if no existing data or all failed to map
    }
    updateTotals(); // Recalculate totals after rebuilding
}


/**
 * Creates a new row in the planner table.
 * @param {number} initialCaseIndex - The index of the case in the 'cases' array to pre-select.
 * @param {number} initialQuantity - The initial quantity for the case.
 */
function createRow(initialCaseIndex = 0, initialQuantity = 1) {
    const row = document.createElement('tr');

    const caseCell = document.createElement('td');
    const caseSelect = document.createElement('select');
    cases.forEach((cs, i) => { // Populate options from the 'cases' array
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = cs.name;
        caseSelect.appendChild(opt);
    });
    // Ensure initialCaseIndex is valid
    if (initialCaseIndex >= 0 && initialCaseIndex < cases.length) {
        caseSelect.value = initialCaseIndex;
    } else {
        caseSelect.value = 0; // Default to first item if invalid index
        console.warn(`Invalid initialCaseIndex: ${initialCaseIndex}. Defaulting to 0.`);
    }
    caseCell.appendChild(caseSelect);

    const costCell = document.createElement('td');
    const costInput = document.createElement('input');
    costInput.type = 'number';
    // Ensure cases[caseSelect.value] exists before accessing price
    costInput.value = cases[parseInt(caseSelect.value)] ? cases[parseInt(caseSelect.value)].price.toFixed(2) : '0.00';
    costInput.disabled = true; // Price should be display-only
    costCell.appendChild(costInput);

    const qtyCell = document.createElement('td');
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = 0;
    qtyInput.value = initialQuantity;
    qtyCell.appendChild(qtyInput);

    const totalCaseCostCell = document.createElement('td');
    totalCaseCostCell.classList.add('total-case-cost');

    const totalWithKeysCell = document.createElement('td');
    totalWithKeysCell.classList.add('total-with-keys-cost');

    const removeCell = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.classList.add('remove-row-btn');
    removeBtn.addEventListener('click', () => {
        row.remove();
        updateTotals();
    });
    removeCell.appendChild(removeBtn);

    row.appendChild(caseCell);
    row.appendChild(costCell);
    row.appendChild(qtyCell);
    row.appendChild(totalCaseCostCell);
    row.appendChild(totalWithKeysCell);
    row.appendChild(removeCell);

    // Event listeners for this new row
    caseSelect.addEventListener('change', () => {
        const newIndex = parseInt(caseSelect.value);
        costInput.value = cases[newIndex].price.toFixed(2);
        updateTotals();
    });
    qtyInput.addEventListener('input', updateTotals);

    tableBody.appendChild(row);
    updateTotals(); // Update totals whenever a new row is added
}

/**
 * Calculates and updates all total costs displayed on the page.
 */
function updateTotals() {
    const taxRate = parseFloat(taxRateInput.value) / 100 || 0;
    const budget = parseFloat(budgetInput.value) || 0;

    let grandTotalPreTaxWithKeys = 0;
    let totalCasesCount = 0;
    const rows = tableBody.querySelectorAll('tr');

    rows.forEach(row => {
        const caseSelect = row.children[0].querySelector('select');
        const qtyInput = row.children[2].querySelector('input');
        const totalCaseCostCell = row.children[3];
        const totalWithKeysCell = row.children[4];

        const caseIndex = parseInt(caseSelect.value);
        const qty = parseInt(qtyInput.value) || 0;
        
        if (cases[caseIndex]) {
            const price = cases[caseIndex].price;
            const totalCaseCost = qty * price;
            const totalWithKeysPreTax = qty * (price + KEY_COST);
            const totalWithKeysPostTax = totalWithKeysPreTax * (1 + taxRate);

            totalCaseCostCell.textContent = totalCaseCost.toFixed(2);
            totalWithKeysCell.textContent = totalWithKeysPostTax.toFixed(2);

            grandTotalPreTaxWithKeys += totalWithKeysPreTax;
            totalCasesCount += qty;
        } else {
            totalCaseCostCell.textContent = 'N/A';
            totalWithKeysCell.textContent = 'N/A';
        }
    });

    const finalTotalPostTax = grandTotalPreTaxWithKeys * (1 + taxRate);

    totalCasesEl.textContent = totalCasesCount;
    totalSpentEl.textContent = finalTotalPostTax.toFixed(2);
    const leftover = budget - finalTotalPostTax;
    leftoverEl.textContent = leftover.toFixed(2);

    // --- START OF UPDATED LOGIC FOR LEFTOVER MESSAGE ---
    if (leftover < 0) {
        deficitMsg.textContent = `You are $${Math.abs(leftover).toFixed(2)} over budget!`;
        deficitMsg.style.color = 'red'; // Set message text color to red
        leftoverEl.style.color = 'red'; // Set numerical leftover color to red
    } else {
        deficitMsg.textContent = `You have $${leftover.toFixed(2)} left over.`;
        deficitMsg.style.color = 'green'; // Set message text color to green
        leftoverEl.style.color = 'green'; // Set numerical leftover color to green
    }
    // Ensure the message is always visible
    deficitMsg.style.display = 'block'; 
    // --- END OF UPDATED LOGIC ---
}