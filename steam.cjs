// steam.cjs

// Remove: const fetch = require('node-fetch'); // This line will be removed
const cheerio = require('cheerio'); // Keep cheerio as require if it supports it

// Helper function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const STEAM_CDN_BASE_URL = 'https://steamcommunity-a.akamaihd.net/economy/image/';

/**
 * Normalizes case names for consistent matching.
 * Removes non-alphanumeric characters and converts to lowercase.
 */
function normalizeCaseNameForMatching(name) {
    if (!name) return '';
    let normalized = name.toLowerCase();
    // Remove all characters that are NOT a-z or 0-9
    normalized = normalized.replace(/[^a-z0-9]/g, '');
    return normalized;
}

/**
 * Fetches comprehensive case data (ROI, Image, Key Cost) from csroi.com's JSON endpoint.
 * Returns a Map where key is case name (normalized) and value is an object
 * containing roi, imageUrl, keyCostSteam, and originalName.
 */
async function fetchCsroiData() {
    // --- ADD DYNAMIC IMPORT FOR FETCH HERE ---
    const fetch = (await import('node-fetch')).default;
    // -----------------------------------------

    const jsonUrl = 'https://csroi.com/pastData/allTrackedCases.json';
    const csroiDataMap = new Map(); // Map to store parsed data

    try {
        const res = await fetch(jsonUrl);
        if (!res.ok) {
            console.error(`HTTP Error fetching CSROI JSON: ${res.status} ${res.statusText}`);
            return csroiDataMap; // Return empty map on error
        }

        const data = await res.json(); // Parse the JSON response

        if (!Array.isArray(data)) {
            console.error('CSROI JSON response is not an array.');
            return csroiDataMap;
        }

        let totalCsroiItems = 0;

        data.forEach(item => {
            totalCsroiItems++;

            if (!item.Name || !item.Image) {
                console.warn(`WARN: CSROI JSON item skipped (missing Name or Image):`, item);
                return;
            }

            const roiValue = parseFloat(item.SteamROI);
            if (isNaN(roiValue)) {
                console.warn(`WARN: CSROI JSON item skipped (invalid SteamROI "${item.SteamROI}" for "${item.Name}")`);
                return;
            }

            let nameRaw = item.Name.trim();
            const nameForMapKey = normalizeCaseNameForMatching(nameRaw);

            let imageUrl = item.Image;

            if (imageUrl && imageUrl.startsWith('https://csroi.comhttps://')) {
                imageUrl = imageUrl.substring('https://csroi.com'.length);
            }
            if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                imageUrl = `https://csroi.com${imageUrl}`;
            }

            const keyCostSteam = item.KeyCostSteam;

            csroiDataMap.set(nameForMapKey, {
                roi: roiValue,
                imageUrl: imageUrl,
                keyCostSteam: keyCostSteam,
                originalName: nameRaw
            });
        });

        console.log(`CSROI: Processed ${totalCsroiItems} raw entries. Added ${csroiDataMap.size} to map.`);
        return csroiDataMap;

    } catch (error) {
        console.error('FATAL ERROR fetching or parsing CSROI JSON data:', error);
        return csroiDataMap;
    }
}


async function getAllCasePricesFromSearchPage() {
    // --- ADD DYNAMIC IMPORT FOR FETCH HERE ---
    const fetch = (await import('node-fetch')).default;
    // -----------------------------------------

    const baseUrl = 'https://steamcommunity.com/market/search/render/?query=case&appid=730&category_730_Type%5B%5D=tag_CSGO_Type_WeaponCase&category_730_Type%5B%5D=tag_CSGO_Type_Container&norender=1';
    const itemsPerPage = 100;

    let currentStart = 0;
    let totalUniqueItemsProcessedFromSteam = 0; // Renamed for clarity: reflects items we actually process/add
    let keepFetching = true;
    let totalItemsReportedBySteamAPI = -1; // Renamed for clarity

    const csroiDetailsMap = await fetchCsroiData();
    await delay(1000);

    // Initialize allCasesDataMap with CSROI data. Cases found on Steam but not in CSROI will be added here.
    const allCasesDataMap = new Map(
        Array.from(csroiDetailsMap.entries()).map(([normalizedName, csroiData]) => [
            normalizedName,
            {
                name: csroiData.originalName,
                price: null, // Price will be updated from Steam
                csroiImageUrl: csroiData.imageUrl,
                steamImageUrl: null, // Image will be updated from Steam
                roi: csroiData.roi,
                keyCostSteam: csroiData.keyCostSteam,
                normalizedName: normalizedName
            }
        ])
    );

    while (keepFetching) {
        const pageUrl = `${baseUrl}&start=${currentStart}&count=${itemsPerPage}`;

        try {
            const res = await fetch(pageUrl);
            const responseData = await res.json();

            if (!res.ok) {
                console.error(`HTTP Error: ${res.status} ${res.statusText} for page URL: ${pageUrl}`);
                keepFetching = false;
                break;
            }
            if (responseData.success === false) {
                console.error(`Steam API returned success: false. Message: ${responseData.message || 'No specific message.'}`);
                keepFetching = false;
                break;
            }

            if (totalItemsReportedBySteamAPI === -1 && typeof responseData.total_count === 'number') {
                totalItemsReportedBySteamAPI = responseData.total_count;
                console.log(`Steam API reports ${totalItemsReportedBySteamAPI} total listings.`);
            }

            if (!responseData.results || !Array.isArray(responseData.results) || responseData.results.length === 0) {
                keepFetching = false;
                break;
            }

            responseData.results.forEach(item => {
                // Filter 1: Ensure it's a 'Container' type (case)
                if (!(item.asset_description?.type === 'Container' || item.asset_description?.type === 'Base Grade Container')) {
                    // console.log(`Skipping non-container item: ${item.name}`); // Optional: log skipped items
                    return;
                }

                // Filter 2: Check for essential data from Steam (name, sell_price, icon_url)
                if (item.name && typeof item.sell_price === 'number' && item.asset_description?.icon_url) {
                    let nameRawFromSteam = item.name.trim();
                    const priceValue = item.sell_price / 100;
                    let steamImageUrlFromScrape = `${STEAM_CDN_BASE_URL}${item.asset_description.icon_url}`;

                    // Adjust image resolution
                    if (steamImageUrlFromScrape.includes('/96fx96f/')) {
                        steamImageUrlFromScrape = steamImageUrlFromScrape.replace('/96fx96f/', '/360fx360f/');
                    }

                    const steamNameForMatching = normalizeCaseNameForMatching(nameRawFromSteam);

                    let caseToUpdate = allCasesDataMap.get(steamNameForMatching);

                    if (caseToUpdate) { // Case found in CSROI data, or previously added from Steam
                        const wasAlreadyUpdated = (caseToUpdate.price !== null); // Check if price was already set

                        caseToUpdate.price = priceValue;
                        caseToUpdate.steamImageUrl = steamImageUrlFromScrape;
                        caseToUpdate.name = nameRawFromSteam; // Update with Steam's exact name

                        if (!wasAlreadyUpdated) {
                            totalUniqueItemsProcessedFromSteam++;
                        }
                    } else { // Case found on Steam but NOT in CSROI data yet
                        console.warn(`  WARN: "${nameRawFromSteam}" (normalized: "${steamNameForMatching}") on Steam but NOT in CSROI data. Adding it with N/A ROI.`);
                        const newCaseFromSteam = {
                            name: nameRawFromSteam,
                            price: priceValue,
                            csroiImageUrl: null, // No CSROI image for these
                            steamImageUrl: steamImageUrlFromScrape,
                            roi: null, // No ROI from CSROI
                            keyCostSteam: null, // No key cost from CSROI
                            normalizedName: steamNameForMatching
                        };
                        allCasesDataMap.set(steamNameForMatching, newCaseFromSteam);
                        totalUniqueItemsProcessedFromSteam++; // Increment for new unique item from Steam
                    }
                } else {
                    let missingParts = [];
                    if (!item.name) missingParts.push('name');
                    if (typeof item.sell_price !== 'number') missingParts.push('sell_price (not a number)');
                    if (!item.asset_description?.icon_url) missingParts.push('icon_url');
                    console.warn(`  WARN: Skipping Steam listing "${item.name || 'Unnamed'}" due to missing essential data: ${missingParts.join(', ')}.`);
                }
            });

            currentStart += responseData.results.length;

            if (totalItemsReportedBySteamAPI !== -1 && currentStart >= totalItemsReportedBySteamAPI) {
                keepFetching = false;
            }

            await delay(2000); // Delay between pages

        } catch (error) {
            console.error(`\nFATAL ERROR scraping page (start=${currentStart}) from URL ${pageUrl}:`, error);
            keepFetching = false;
        }
    }

    // Filter final list to ensure we only return items that got a price and image from Steam
    const finalFilteredCases = Array.from(allCasesDataMap.values()).filter(caseItem =>
        caseItem.price !== null && typeof caseItem.price === 'number' && caseItem.steamImageUrl !== null
    );

    console.log(`Successfully processed and loaded ${totalUniqueItemsProcessedFromSteam} unique case prices from Steam.`);
    console.log(`Final list includes ${finalFilteredCases.length} cases with price data.`);

    return finalFilteredCases;
}

async function getCasePrice(caseName) {
    // --- ADD DYNAMIC IMPORT FOR FETCH HERE ---
    const fetch = (await import('node-fetch')).default;
    // -----------------------------------------

    const searchName = encodeURIComponent(caseName);
    const url = `https://steamcommunity.com/market/listings/730/${searchName}`;

    try {
        const res = await fetch(url);
        const text = await res.text();
        const $ = cheerio.load(text); // <--- FIXED THIS LINE

        const scriptContent = $('script').filter((i, el) => {
            return $(el).html().includes('var g_rgItemInfo');
        }).html();

        if (scriptContent) {
            const itemInfoMatch = scriptContent.match(/var g_rgItemInfo = ({.*?});/s);
            if (itemInfoMatch && itemInfoMatch[1]) {
                try {
                    const itemInfo = JSON.parse(itemInfoMatch[1]);
                    const itemKey = Object.keys(itemInfo)[0];
                    if (itemKey && itemInfo[itemKey] && itemInfo[itemKey].lowest_price) {
                        return parseFloat(itemInfo[itemKey].lowest_price.replace(/[^\d.]/g, ''));
                    }
                } catch (jsonError) {
                    console.warn(`WARN: Failed to parse g_rgItemInfo JSON for ${caseName} (individual fetch). Error: ${jsonError.message}`);
                }
            }
        }
        const priceTextElements = $('.market_listing_price.market_listing_price_with_fee');
        if (priceTextElements.length > 0) {
            const priceText = priceTextElements.first().text();
            const match = priceText.match(/\$\d+\.\d+/);
            if (match) {
                return parseFloat(match[0].replace(/[^\d.]/g, ''));
            }
        }
        return null;
    } catch (error) {
        console.error(`Error scraping individual price for ${caseName}:`, error);
        return null;
    }
}

// --- COMMONJS EXPORT ---
module.exports = {
    // Renamed fetchAllCasePrices to point to your existing getAllCasePricesFromSearchPage
    fetchAllCasePrices: getAllCasePricesFromSearchPage, 
    // You can still export these if you need them directly, but fetchAllCasePrices will handle the main logic
    getAllCasePricesFromSearchPage: getAllCasePricesFromSearchPage, 
    getCasePrice: getCasePrice 
};