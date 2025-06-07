// renderer.js
window.addEventListener('DOMContentLoaded', async () => {
    // ... (rest of your cases array and element selections remains the same) ...
    const cases = [
        { name: "CS:GO Weapon Case", price: 122.51 },
        { name: "CS:GO Weapon Case 2", price: 15.72 },
        { name: "CS:GO Weapon Case 3", price: 10.23 },
        { name: "eSports 2013 Case", price: 90.09 },
        { name: "eSports 2013 Winter Case", price: 14.83 },
        { name: "eSports 2014 Summer Case", price: 14.26 },
        { name: "Operation Bravo Case", price: 58.94 },
        { name: "Operation Phoenix Case", price: 6.59 },
        { name: "Operation Breakout Case", price: 3.45 },
        { name: "Operation Vanguard Case", price: 3.67 },
        { name: "Chroma Case", price: 2.90 },
        { name: "Chroma 2 Case", price: 2.44 },
        { name: "Falchion Case", price: 2.46 },
        { name: "Shadow Case", price: 2.52 },
        { name: "Revolver Case", price: 2.36 },
        { name: "Operation Wildfire Case", price: 3.55 },
        { name: "Chroma 3 Case", price: 2.71 },
        { name: "Gamma Case", price: 3.10 },
        { name: "Gamma 2 Case", price: 3.24 },
        { name: "Glove Case", price: 7.99 },
        { name: "Spectrum Case", price: 3.25 },
        { name: "Operation Hydra Case", price: 17.26 },
        { name: "Spectrum 2 Case", price: 2.87 },
        { name: "Clutch Case", price: 2.33 },
        { name: "Horizon Case", price: 2.05 },
        { name: "Danger Zone Case", price: 1.92 },
        { name: "Prisma Case", price: 2.01 },
        { name: "CS20 Case", price: 2.11 },
        { name: "Shattered Web Case", price: 4.89 },
        { name: "Prisma 2 Case", price: 1.95 },
        { name: "Fracture Case", price: 1.82 },
        { name: "Snakebite Case", price: 1.79 },
        { name: "Operation Riptide Case", price: 2.74 },
        { name: "Dreams & Nightmares Case", price: 1.85 },
        { name: "Recoil Case", price: 1.70 },
        { name: "Revolution Case", price: 1.63 },
        { name: "Anubis Collection Package", price: 1.65 },
        { name: "Kilowatt Case", price: 1.95 }
    ];

    const tableBody = document.getElementById('caseTableBody');
    const addCaseBtn = document.getElementById('addCaseBtn');
    const refreshPricesBtn = document.getElementById('refreshPricesBtn');
    const totalSpentEl = document.getElementById('totalSpent');
    const leftoverEl = document.getElementById('leftover');
    const deficitMsg = document.getElementById('deficitMessage');
    const taxRateInput = document.getElementById('taxRate');
    const budgetInput = document.getElementById('budget');
    const totalCasesEl = document.getElementById('totalCases'); // NEW: Get reference to total cases element

    const availableCasesGrid = document.getElementById('availableCasesGrid');
    const sortNameAscBtn = document.getElementById('sortNameAsc');
    const sortNameDescBtn = document.getElementById('sortNameDesc');
    const sortPriceAscBtn = document.getElementById('sortPriceAsc');
    const sortPriceDescBtn = document.getElementById('sortPriceDesc');

    const KEY_COST = 2.49;
    let availableCaseData = [];
    let currentSort = { type: 'name', order: 'asc' };

    // ... (updateLivePrices, sortAndRenderAvailableCases, renderAvailableCasesGrid, rebuildTable, createRow functions remain the same) ...

    /**
     * Updates the live prices of all cases by fetching them from Steam
     * via the main process.
     * Then, it rebuilds both tables to reflect the new prices.
     */
    async function updateLivePrices() {
        refreshPricesBtn.disabled = true; // Disable button during fetch
        refreshPricesBtn.textContent = 'Refreshing...';
        availableCasesGrid.innerHTML = '<p>Fetching latest prices...</p>'; // Show loading message

        const livePricesMap = await window.electronAPI.fetchAllCasePrices(); 
        
        availableCaseData = Object.entries(livePricesMap).map(([name, price]) => ({ name, price }));
        
        for (let cs of cases) {
            const livePrice = livePricesMap[cs.name];
            if (livePrice !== undefined && livePrice !== null) {
                cs.price = livePrice;
            } else {
                console.warn(`Using fallback price for ${cs.name} due to fetch failure or not found in search results.`);
            }
        }

        sortAndRenderAvailableCases();
        rebuildTable();
        updateTotals();
        refreshPricesBtn.disabled = false;
        refreshPricesBtn.textContent = '🔄 Refresh Prices';
    }
    
    // ... sortAndRenderAvailableCases function ...
    function sortAndRenderAvailableCases() {
        switch (currentSort.type) {
            case 'name':
                availableCaseData.sort((a, b) => {
                    const nameA = a.name.toLowerCase();
                    const nameB = b.name.toLowerCase();
                    if (currentSort.order === 'asc') {
                        return nameA.localeCompare(nameB);
                    } else {
                        return nameB.localeCompare(a.name); // Corrected b.name.localeCompare(a.name)
                    }
                });
                break;
            case 'price':
                availableCaseData.sort((a, b) => {
                    if (currentSort.order === 'asc') {
                        return a.price - b.price;
                    } else {
                        return b.price - a.price;
                    }
                });
                break;
        }
        renderAvailableCasesGrid();
    }

    // ... renderAvailableCasesGrid function ...
    function renderAvailableCasesGrid() {
        availableCasesGrid.innerHTML = '';
        if (availableCaseData.length === 0) {
            availableCasesGrid.innerHTML = '<p>No case prices available. Try refreshing.</p>';
            return;
        }

        availableCaseData.forEach(caseItem => {
            const card = document.createElement('div');
            card.classList.add('case-card');
            card.innerHTML = `
                <h4>${caseItem.name}</h4>
                <p>$${caseItem.price.toFixed(2)}</p>
                <button class="add-to-planner-btn" data-case-name="${caseItem.name}" data-case-price="${caseItem.price}">Add to Planner</button>
            `;
            availableCasesGrid.appendChild(card);
        });

        document.querySelectorAll('.add-to-planner-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const caseName = event.target.dataset.caseName;
                const casePrice = parseFloat(event.target.dataset.casePrice);
                
                let caseIndex = cases.findIndex(c => c.name === caseName);
                if (caseIndex === -1) {
                    cases.push({ name: caseName, price: casePrice });
                    caseIndex = cases.length - 1;
                    rebuildTable();
                }

                createRow(caseIndex, 1);
            });
        });
    }

    // ... rebuildTable function ...
    function rebuildTable() {
        const existingRowsData = [];
        tableBody.querySelectorAll('tr').forEach(row => {
            const caseSelect = row.children[0].firstChild;
            const qtyInput = row.children[2].firstChild;
            const selectedCaseIndex = parseInt(caseSelect.value); 
            if (cases[selectedCaseIndex]) {
                existingRowsData.push({
                    caseName: cases[selectedCaseIndex].name,
                    quantity: parseInt(qtyInput.value)
                });
            }
        });

        tableBody.innerHTML = '';

        if (existingRowsData.length > 0) {
            existingRowsData.forEach(data => {
                const newIndex = cases.findIndex(c => c.name === data.caseName);
                if (newIndex !== -1) {
                    createRow(newIndex, data.quantity);
                } else {
                    console.warn(`Previously selected case "${data.caseName}" not found in updated price list.`);
                }
            });
        } else {
            createRow();
        }
        updateTotals();
    }

    // ... createRow function ...
    function createRow(initialCaseIndex = 0, initialQuantity = 1) {
        const row = document.createElement('tr');

        const caseCell = document.createElement('td');
        const caseSelect = document.createElement('select');
        cases.forEach((cs, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = cs.name;
            caseSelect.appendChild(opt);
        });
        caseSelect.value = initialCaseIndex;
        caseCell.appendChild(caseSelect);

        const costCell = document.createElement('td');
        const costInput = document.createElement('input');
        costInput.type = 'number';
        costInput.value = cases[initialCaseIndex].price.toFixed(2);
        costInput.disabled = true;
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

        caseSelect.addEventListener('change', () => {
            const newIndex = parseInt(caseSelect.value);
            costInput.value = cases[newIndex].price.toFixed(2);
            updateTotals();
        });
        qtyInput.addEventListener('input', updateTotals);

        tableBody.appendChild(row);
        updateTotals();
    }

    /**
     * Calculates and updates all total costs displayed on the page.
     */
    function updateTotals() {
        const taxRate = parseFloat(taxRateInput.value) / 100 || 0;
        const budget = parseFloat(budgetInput.value) || 0;

        let grandTotalPreTaxWithKeys = 0;
        let totalCasesCount = 0; // NEW: Initialize total cases counter
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
                totalCasesCount += qty; // NEW: Add quantity to totalCasesCount
            } else {
                totalCaseCostCell.textContent = 'N/A';
                totalWithKeysCell.textContent = 'N/A';
            }
        });

        const finalTotalPostTax = grandTotalPreTaxWithKeys * (1 + taxRate);

        totalCasesEl.textContent = totalCasesCount; // NEW: Update the total cases element
        totalSpentEl.textContent = finalTotalPostTax.toFixed(2);
        const leftover = budget - finalTotalPostTax;
        leftoverEl.textContent = leftover.toFixed(2);

        if (leftover < 0) {
            deficitMsg.style.display = 'block';
            deficitMsg.textContent = `You are $${Math.abs(leftover).toFixed(2)} over budget!`;
            leftoverEl.style.color = 'red';
        } else {
            deficitMsg.style.display = 'none';
            leftoverEl.style.color = 'green';
        }
    }

    // Event Listeners for global actions
    addCaseBtn.addEventListener('click', () => createRow());
    refreshPricesBtn.addEventListener('click', () => updateLivePrices());

    // Event listeners for budget and tax rate changes
    budgetInput.addEventListener('input', updateTotals);
    taxRateInput.addEventListener('input', updateTotals);

    // NEW: Event listeners for sorting buttons
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

    // Initial setup when the page loads
    await updateLivePrices();
    if (tableBody.children.length === 0) {
        createRow();
    }
    updateTotals();
});