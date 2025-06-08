// renderer.js

// --- Global Constants ---
// Original constants for table bodies are likely unused if HTML structure changed.
// Keep them for reference if needed elsewhere.
const CASES_TABLE_BODY = document.getElementById('casesTableBody'); 
const PLANNER_TABLE_BODY = document.getElementById('plannerTableBody'); 
const ADD_ALL_TO_PLANNER_BUTTON = document.getElementById('addAllToPlanner'); 
const CLEAR_PLANNER_BUTTON = document.getElementById('clearPlanner'); 

// Removed: const KEY_TAX_RATE = 0.00; // This will now be read from input

const DEFAULT_KEY_PRICE = 2.49; // Default key price if not provided by data (used for cases without keyCostSteam from CSROI)

let availableCaseData = []; // Array used for the grid display
let cases = [];             // Array used for the planner dropdown and table (subset of availableCaseData)
let availableCaseMap = new Map(); // The persistent source of truth for all cases

// Global variable to keep track of the current sort state
let currentSort = {
    key: 'roi',    // Default sort key
    direction: 'desc' // Default sort direction
};

// Global key quantity variable (no longer tied to an input, if removed from HTML)
let keyQuantity = 0; // Initialize key quantity globally. This will be 0 unless manually updated.


// --- Event Listeners ---
document.getElementById('refresh-prices-btn').addEventListener('click', updateLivePrices);

// Planner Add Case: Using the 'Add Selected Case' button now
document.getElementById('addSelectedCaseBtn').addEventListener('click', addCaseFromSearchInput);

// Event listener for removing a case (within the table body)
document.getElementById('caseTableBody').addEventListener('click', function(event) {
    if (event.target.classList.contains('remove-case-btn')) {
        const row = event.target.closest('tr');
        const caseName = row.dataset.caseName;
        removeCaseFromPlanner(caseName);
    }
});

// Event listener for updating case quantity (within the table body)
document.getElementById('caseTableBody').addEventListener('change', function(event) {
    if (event.target.classList.contains('case-quantity-input')) {
        const row = event.target.closest('tr');
        const caseName = row.dataset.caseName;
        const newQuantity = parseInt(event.target.value);
        if (!isNaN(newQuantity) && newQuantity >= 0) {
            updateCaseQuantity(caseName, newQuantity);
        }
    }
});

// NEW: Event listener for the Budget input field
document.getElementById('budget').addEventListener('input', updateTotals); // Use 'input' for real-time updates

// NEW: Event listener for the Tax Rate input field
// Assumes your tax rate input has the ID 'taxRateInput'
document.getElementById('taxRateInput').addEventListener('input', () => {
    console.log('Tax rate input changed. Recalculating...');
    rebuildTable(); // Rebuilds the table, which in turn calls updateTotals()
});


// --- Sort Button Event Listeners ---
document.getElementById('sortNameAsc').addEventListener('click', () => {
    console.log('Sort Name Asc clicked');
    sortCases('name', 'asc');
});
document.getElementById('sortNameDesc').addEventListener('click', () => {
    console.log('Sort Name Desc clicked');
    sortCases('name', 'desc');
});
document.getElementById('sortPriceAsc').addEventListener('click', () => {
    console.log('Sort Price Asc clicked');
    sortCases('price', 'asc');
});
document.getElementById('sortPriceDesc').addEventListener('click', () => {
    console.log('Sort Price Desc clicked');
    sortCases('price', 'desc');
});
document.getElementById('sortRoiBtn').addEventListener('click', () => {
    console.log('Sort ROI clicked');
    sortCases('roi', 'desc'); // ROI is typically sorted descending (highest ROI first)
});


// --- Utility Functions ---

// NEW: Function to get the current tax rate from the input field
function getTaxRate() {
    const taxRateInput = document.getElementById('taxRateInput');
    if (taxRateInput) {
        // Read value, parse as float, default to 0 if NaN, then divide by 100 for percentage
        const rate = parseFloat(taxRateInput.value) || 0;
        return rate / 100; // Convert percentage (e.g., 15) to decimal (0.15)
    }
    console.warn("Tax rate input element not found, defaulting tax rate to 0.");
    return 0; // Default to 0 if input element doesn't exist
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    if (notification) { // Ensure element exists before trying to use it
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        setTimeout(() => {
            notification.className = notification.className.replace('show', '');
        }, 3000); // Hide after 3 seconds
    } else {
        console.warn("Notification element not found.");
    }
}

function showLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) { // Ensure element exists
        loadingIndicator.style.display = 'block';
    } else {
        console.warn("Loading indicator element not found.");
    }
}

function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) { // Ensure element exists
        loadingIndicator.style.display = 'none';
    } else {
        console.warn("Loading indicator element not found.");
    }
}

// Helper function: Syncs arrays from the map and keeps 'cases' sorted
function updateAvailableCaseDataArraysFromMap() {
    availableCaseData = Array.from(availableCaseMap.values());
    // Ensure the 'cases' array for the planner is kept in sync
    cases = availableCaseData.map(c => ({
        name: c.name,
        price: c.price,
        roi: c.roi,
        normalizedName: c.normalizedName
    }));
    // Sort cases array alphabetically for datalist and consistency
    cases.sort((a, b) => a.name.localeCompare(b.name));
}

// --- Main function to update prices ---
async function updateLivePrices() {
    showLoadingIndicator();
    showNotification('Refreshing prices...', 'info');
    console.log("Starting price refresh...");

    try {
        const rawFetchedCaseData = await window.electronAPI.fetchAllCasePrices();

        const latestFetchedMap = new Map(rawFetchedCaseData.map(caseItem => [caseItem.normalizedName, caseItem]));

        let updatedCount = 0;
        let newCount = 0;

        // Merge Logic: Iterate through the newly fetched data
        latestFetchedMap.forEach((fetchedCase, normalizedName) => {
            const existingCase = availableCaseMap.get(normalizedName);

            if (existingCase) {
                // Update existing properties
                existingCase.price = fetchedCase.price;
                existingCase.steamImageUrl = fetchedCase.steamImageUrl;
                existingCase.roi = fetchedCase.roi;
                // Prefer fetched keyCostSteam, fallback to old or default
                existingCase.keyCostSteam = fetchedCase.keyCostSteam !== null ? fetchedCase.keyCostSteam : existingCase.keyCostSteam;
                updatedCount++;
            } else {
                availableCaseMap.set(normalizedName, fetchedCase);
                newCount++;
            }
        });

        // After merging, update the arrays used by UI components from our single source of truth (the map)
        updateAvailableCaseDataArraysFromMap();
        console.log('availableCaseData updated. New length:', availableCaseData.length);

        console.log(`UI Update: Processed ${rawFetchedCaseData.length} newly fetched items. Updated ${updatedCount} existing cases, added ${newCount} new cases.`);
        console.log(`Total unique cases currently available in UI: ${availableCaseData.length}`);

        // --- UI Rendering ---
        populatePlannerDatalist();
        sortAndRenderAvailableCases(); // Re-renders the grid based on availableCaseData
        rebuildTable(); // Rebuilds the planner table based on cases
        // updateTotals() is called by rebuildTable, no need to call directly here again for initial load

        showNotification('Prices refreshed successfully!', 'success');
        console.log("Prices refreshed successfully!");

    } catch (error) {
        console.error("Error updating live prices:", error);
        showNotification(`Error refreshing prices: ${error.message}`, 'error');
    } finally {
        hideLoadingIndicator();
    }
}

// --- Functions related to the main grid display ---

// Function to set the sort parameters and trigger rendering
function sortCases(key, direction) {
    currentSort = { key, direction };
    sortAndRenderAvailableCases(); // Call the rendering function
}

function sortAndRenderAvailableCases() {
    const gridContainer = document.getElementById('availableCasesGrid');
    if (!gridContainer) {
        console.error("Error: availableCasesGrid element not found!");
        return;
    }
    gridContainer.innerHTML = ''; // Clear existing grid

    console.log('Attempting to sort and render cases. availableCaseData length:', availableCaseData.length);

    // Sort the cases based on currentSort global variable
    const sortedCases = [...availableCaseData].sort((a, b) => {
        let valA = a[currentSort.key];
        let valB = b[currentSort.key];

        // Handle null/undefined values for numerical sorts: push them to the end
        if (typeof valA === 'number' && typeof valB === 'number') {
            if (valA === null || valA === undefined) valA = currentSort.direction === 'asc' ? Infinity : -Infinity;
            if (valB === null || valB === undefined) valB = currentSort.direction === 'asc' ? Infinity : -Infinity;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
            return currentSort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return currentSort.direction === 'asc' ? valA - valB : valB - valA;
        }
    });

    if (sortedCases.length === 0) {
        gridContainer.innerHTML = '<p>No cases available. Try refreshing prices.</p>';
        return;
    }

    sortedCases.forEach(caseItem => {
        const caseCard = document.createElement('div');
        caseCard.className = 'case-card';
        caseCard.dataset.caseName = caseItem.name; // Store case name for click handler

        // Prefer Steam image if available, fallback to CSROI image if not
        const imageSrc = caseItem.steamImageUrl || caseItem.csroiImageUrl || '';

        // Display ROI as N/A if null
        const roiDisplay = caseItem.roi !== null ? (caseItem.roi * 100).toFixed(2) + '%' : 'N/A';
        const priceDisplay = caseItem.price !== null ? caseItem.price.toFixed(2) : 'N/A';

        caseCard.innerHTML = `
            <img src="${imageSrc}" alt="${caseItem.name}" class="case-image">
            <div class="case-name">${caseItem.name}</div>
            <div class="case-price">Price: $${priceDisplay}</div>
            <div class="case-roi">ROI: ${roiDisplay}</div>
            <button class="add-to-planner-btn">Add to Planner</button>
        `;
        gridContainer.appendChild(caseCard);
    });

    // Event delegation for "Add to Planner" buttons on case cards
    gridContainer.removeEventListener('click', handleGridButtonClick); // Remove previous listener to avoid duplicates
    gridContainer.addEventListener('click', handleGridButtonClick);
}

// Handler function for clicks on the grid container
function handleGridButtonClick(event) {
    if (event.target.classList.contains('add-to-planner-btn')) {
        const caseCard = event.target.closest('.case-card');
        if (caseCard) {
            const caseName = caseCard.dataset.caseName;
            addCaseToPlanner(caseName, 1); // Add 1 of the selected case to the planner
        }
    }
}


// --- Functions related to the planner ---

// Populates the datalist for the case search input
function populatePlannerDatalist() {
    const datalist = document.getElementById('caseNamesDatalist');
    if (!datalist) {
        console.warn("Datalist element for planner not found.");
        return;
    }
    datalist.innerHTML = ''; // Clear existing options

    cases.forEach(caseItem => {
        const option = document.createElement('option');
        option.value = caseItem.name;
        datalist.appendChild(option);
    });
}

// Function called when 'Add Selected Case' button is clicked
function addCaseFromSearchInput() {
    const caseInput = document.getElementById('plannerSearchInput');
    const caseName = caseInput.value.trim();
    const quantity = 1; // Default to 1, as no explicit quantity input for this button

    if (!caseName) {
        showNotification('Please enter a case name.', 'error');
        return;
    }

    // Call the core logic to add/update the case in the planner
    addCaseToPlanner(caseName, quantity);
    caseInput.value = ''; // Clear input field
}

// Core logic to add/update a case in the planner table
function addCaseToPlanner(caseName, quantity) {
    // Find the case in our master list (cases array derived from map)
    const foundCase = cases.find(c => c.name === caseName);

    if (!foundCase) {
        showNotification(`Case "${caseName}" not found in available data. Please refresh prices.`, 'error');
        return;
    }

    const plannerTableBody = document.getElementById('caseTableBody');
    if (!plannerTableBody) {
        console.error("Planner table body element not found!");
        return;
    }

    // Check if the case is already in the planner table
    const existingRow = plannerTableBody.querySelector(`tr[data-case-name="${CSS.escape(caseName)}"]`);

    if (existingRow) {
        // Update quantity if already exists
        const currentQuantity = parseInt(existingRow.querySelector('.case-quantity-input').value);
        existingRow.querySelector('.case-quantity-input').value = currentQuantity + quantity;
        showNotification(`Updated quantity for ${caseName}.`, 'success');
    } else {
        // Add new row to the planner table
        const newRow = document.createElement('tr');
        newRow.dataset.caseName = caseName; // Store case name as data attribute

        newRow.innerHTML = `
            <td>${caseName}</td>
            <td class="case-item-price">$${foundCase.price ? foundCase.price.toFixed(2) : 'N/A'}</td>
            <td><input type="number" class="case-quantity-input" value="${quantity}" min="0"></td>
            <td class="case-total-cost">Calculating...</td>
            <td class="case-total-key-cost">Calculating...</td>
            <td class="case-total-with-keys">Calculating...</td>
            <td>
                <button class="remove-case-btn">Remove</button>
            </td>
        `;
        plannerTableBody.appendChild(newRow);
        showNotification(`Added ${quantity} x ${caseName} to planner.`, 'success');
    }

    rebuildTable(); // Recalculate totals for all rows
    // updateTotals() will be called by rebuildTable, so no need to call it directly here
}

// Rebuilds the planner table, used for recalculating totals
async function rebuildTable() { // Made function async
    const plannerTableBody = document.getElementById('caseTableBody');
    if (!plannerTableBody) return;

    const rows = Array.from(plannerTableBody.querySelectorAll('tr'));

    // Get the current tax rate dynamically
    const currentTaxRate = getTaxRate(); 
    console.log(`rebuildTable: Using dynamic Tax Rate: ${currentTaxRate}`);


    // Use Promise.all to await all normalization calls concurrently for efficiency
    await Promise.all(rows.map(async row => { // Changed forEach to map with async and awaited Promise.all
        const caseName = row.dataset.caseName;
        const quantity = parseInt(row.querySelector('.case-quantity-input').value);

        console.log(`rebuildTable: Processing case "${caseName}" with quantity ${quantity}`);

        // Await the asynchronous IPC call for normalization
        const normalizedCaseName = await window.electronAPI.normalizeCaseName(caseName);
        console.log(`rebuildTable: Normalized "${caseName}" to "${normalizedCaseName}"`);

        const caseData = availableCaseMap.get(normalizedCaseName);
        console.log(`rebuildTable: Fetched caseData for "${normalizedCaseName}":`, caseData);

        const caseItemPriceElement = row.querySelector('.case-item-price');
        const totalCaseCostElement = row.querySelector('.case-total-cost');
        const totalCaseKeyCostElement = row.querySelector('.case-total-key-cost');
        const totalWithKeysElement = row.querySelector('.case-total-with-keys');

        // Check if caseData exists and has valid price/keyCostSteam
        if (caseData && caseData.price !== null && typeof caseData.price === 'number') {
            const casePrice = caseData.price;
            // Use keyCostSteam from data if available, otherwise use DEFAULT_KEY_PRICE
            let keyCost = caseData.keyCostSteam !== null && typeof caseData.keyCostSteam === 'number' ? caseData.keyCostSteam : DEFAULT_KEY_PRICE;

            // --- APPLY TAX TO KEY COST HERE (for individual row display) ---
            const taxedKeyCost = keyCost * (1 + currentTaxRate); // Use dynamic rate
            console.log(`rebuildTable: For ${caseName}, Original Key Cost: $${keyCost.toFixed(2)}, Taxed Key Cost: $${taxedKeyCost.toFixed(2)}`);
            // ---------------------------------------------------------------

            caseItemPriceElement.textContent = `$${casePrice.toFixed(2)}`;

            const totalCaseCost = casePrice * quantity;
            const totalKeyCost = taxedKeyCost * quantity; // Use the taxed key cost here
            const totalWithKeys = totalCaseCost + totalKeyCost;

            totalCaseCostElement.textContent = `$${totalCaseCost.toFixed(2)}`;
            totalCaseKeyCostElement.textContent = `$${totalKeyCost.toFixed(2)}`;
            totalWithKeysElement.textContent = `$${totalWithKeys.toFixed(2)}`;

            [totalCaseCostElement, totalCaseKeyCostElement, totalWithKeysElement].forEach(el => el.classList.remove('no-price'));
        } else {
            // Case data not found or missing essential price/key data
            caseItemPriceElement.textContent = 'N/A';
            [totalCaseCostElement, totalCaseKeyCostElement, totalWithKeysElement].forEach(el => {
                el.textContent = 'N/A';
                el.classList.add('no-price');
            });
            console.warn(`WARN: Case "${caseName}" in planner but missing price/key data or not found in available data. Check console for details.`);
        }
    })); // End Promise.all

    updateTotals(); // Ensure overall totals are updated after rebuilding
}


function updateCaseQuantity(caseName, newQuantity) {
    const plannerTableBody = document.getElementById('caseTableBody');
    if (!plannerTableBody) return;
    const row = plannerTableBody.querySelector(`tr[data-case-name="${CSS.escape(caseName)}"]`);
    if (row) {
        row.querySelector('.case-quantity-input').value = newQuantity;
        rebuildTable(); // Recalculate totals for all rows
        showNotification(`Quantity for ${caseName} updated to ${newQuantity}.`, 'info');
    }
}

function removeCaseFromPlanner(caseName) {
    const plannerTableBody = document.getElementById('caseTableBody');
    if (!plannerTableBody) return;
    const row = plannerTableBody.querySelector(`tr[data-case-name="${CSS.escape(caseName)}"]`);
    if (row) {
        row.remove();
        rebuildTable(); // Recalculate totals for all rows
        showNotification(`Removed ${caseName} from planner.`, 'success');
    }
}

function updateTotals() {
    let totalCostCases = 0; // Total cost of cases only (excluding keys)
    let totalCostKeys = 0; // Total cost of keys only (including tax)
    let totalCostWithKeys = 0; // Total (Cases + Keys with tax)
    let totalExpectedROI = 0; // Total ROI in USD
    let totalCasesInPlanner = 0;

    // Get the current tax rate dynamically
    const currentTaxRate = getTaxRate();
    console.log(`updateTotals: Using dynamic Tax Rate: ${currentTaxRate}`);


    const plannerTableBody = document.getElementById('caseTableBody');
    if (!plannerTableBody) return;

    const rows = plannerTableBody.querySelectorAll('tr');

    rows.forEach(row => {
        const caseName = row.dataset.caseName;
        const quantity = parseInt(row.querySelector('.case-quantity-input').value);

        const caseData = availableCaseMap.get(window.electronAPI.normalizeCaseNameSync(caseName));

        if (caseData && caseData.price !== null && typeof caseData.price === 'number') {
            const casePrice = caseData.price;
            const caseRoi = caseData.roi; // This can be null

            // Get key cost and apply tax for overall totals calculation
            let keyCostPerCase = caseData.keyCostSteam !== null && typeof caseData.keyCostSteam === 'number' ? caseData.keyCostSteam : DEFAULT_KEY_PRICE;
            keyCostPerCase = keyCostPerCase * (1 + currentTaxRate); // Apply dynamic tax here for cumulative total
            console.log(`updateTotals: For ${caseName}, Taxed Key Cost Per Case: $${keyCostPerCase.toFixed(2)}`);

            totalCostCases += casePrice * quantity;
            totalCostKeys += keyCostPerCase * quantity; // Add taxed key cost
            totalCostWithKeys += (casePrice * quantity) + (keyCostPerCase * quantity); // Total cost includes taxed keys
            
            // Only add to ROI if ROI data is available
            if (caseRoi !== null && typeof caseRoi === 'number') {
                totalExpectedROI += (casePrice * caseRoi) * quantity;
            }
            totalCasesInPlanner += quantity;
        }
    });

    // Update overall totals in the UI
    document.getElementById('totalCases').textContent = totalCasesInPlanner;
    document.getElementById('totalSpent').textContent = totalCostCases.toFixed(2); // Total cost of cases only

    const budgetElement = document.getElementById('budget');
    // Ensure budget is read correctly, default to 0 if NaN or not found
    const budget = budgetElement ? parseFloat(budgetElement.value) || 0 : 0; 
    console.log('updateTotals: Current Budget:', budget);
    console.log('updateTotals: Total Cost With Keys:', totalCostWithKeys);

    const leftover = budget - totalCostWithKeys;
    document.getElementById('leftover').textContent = leftover.toFixed(2);
    console.log('updateTotals: Leftover:', leftover);

    // Update the key cost display with the total taxed key cost
    document.getElementById('total-cost-display').textContent = totalCostWithKeys.toFixed(2); // This includes taxed keys
    document.getElementById('total-keys-needed-display').textContent = totalCasesInPlanner;
    document.getElementById('total-expected-roi-display').textContent = totalExpectedROI.toFixed(2); // Display total expected ROI

    // Calculate remaining keys after considering total cases
    const remainingKeys = keyQuantity - totalCasesInPlanner;
    const remainingKeysDisplay = document.getElementById('remaining-keys-display');
    if (remainingKeysDisplay) {
        remainingKeysDisplay.textContent = remainingKeys;
        remainingKeysDisplay.style.color = remainingKeys >= 0 ? 'green' : 'red';
    }

    // Save planner data after updating totals
    // If you need to save the planner state (which cases and quantities are in it),
    // you'll need to pass an array of objects: [{ name: 'Case A', quantity: 5 }, { name: 'Case B', quantity: 2 }]
    // For now, this line is commented out as `plannerCases` only stores names, not quantities.
    // await window.electronAPI.savePlannerData(plannerCases);
}


// Initial load of prices when the app starts
document.addEventListener('DOMContentLoaded', updateLivePrices);