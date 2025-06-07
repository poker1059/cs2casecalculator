// steam.js
import fetch from 'node-fetch';
import { load } from 'cheerio'; // Still needed for Steam Market scraping

// Helper function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches comprehensive case data (ROI, Image, Key Cost) from csroi.com's JSON endpoint.
 * Returns a Map where key is case name (cleaned) and value is an object
 * containing roi, imageUrl, and keyCostSteam.
 */
async function fetchCsroiData() {
    const jsonUrl = 'https://csroi.com/pastData/allTrackedCases.json';
    const csroiDataMap = new Map(); // Map to store parsed data
    console.log(`Fetching case data from CSROI JSON: ${jsonUrl}`);

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

        data.forEach(item => {
            // Ensure essential properties exist
            if (item.Name && typeof item.SteamROI === 'number' && item.Image) {
                let name = item.Name.trim();
                // Clean up case name for matching with Steam data (e.g., "CS:GO Weapon Case" -> "Weapon Case")
                // The JSON "Name" field seems clean, but let's keep the Steam-side cleaning
                // for consistency in matching.
                
                const roiPercentage = item.SteamROI * 100; // Convert 0.XX to XX.XX%
                const imageUrl = `https://csroi.com${item.Image}`; // Prepend base URL for absolute path
                const keyCostSteam = item.KeyCostSteam; // Get the Steam Key Cost

                csroiDataMap.set(name, {
                    roi: roiPercentage,
                    imageUrl: imageUrl,
                    keyCostSteam: keyCostSteam
                });
                // console.log(`[CSROI JSON] Found: "${name}" -> ROI: ${roiPercentage.toFixed(2)}%, Image: ${imageUrl}`); // Debugging log
            } else {
                console.warn(`WARN: CSROI JSON item missing key data (Name, SteamROI, or Image):`, item.Name || 'Unnamed Item');
            }
        });

        console.log(`Successfully scraped ${csroiDataMap.size} entries from CSROI JSON.`);
        return csroiDataMap;

    } catch (error) {
        console.error('FATAL ERROR fetching or parsing CSROI JSON data:', error);
        return csroiDataMap; // Return map with whatever was found, or empty map on error
    }
}


async function getAllCasePricesFromSearchPage() {
    const baseUrl = 'https://steamcommunity.com/market/search?q=case&category_730_ItemSet%5B%5D=any&category_730_ProPlayer%5B%5D=any&category_730_StickerCapsule%5B%5D=any&category_730_Tournament%5B%5D=any&category_730_TournamentTeam%5B%5D=any&category_730_Type%5B%5D=tag_CSGO_Type_WeaponCase&appid=730';
    const allCasesData = [];
    const itemsPerPage = 10;
    let currentPage = 0;
    let totalItemsFound = 0;
    let keepFetching = true;
    const maxPagesToFetch = 10;

    // NEW: Fetch CSROI data first (which now uses JSON)
    const csroiDetailsMap = await fetchCsroiData();
    await delay(1000); // Small delay after fetching CSROI JSON before starting Steam scrape

    while (keepFetching && currentPage < maxPagesToFetch) {
        const start = currentPage * itemsPerPage;
        const pageUrl = `${baseUrl}&start=${start}`;

        console.log(`Attempting to scrape page ${currentPage + 1} from: ${pageUrl}`);

        try {
            const res = await fetch(pageUrl);

            if (!res.ok) {
                console.error(`HTTP Error: ${res.status} ${res.statusText} for page URL: ${pageUrl}`);
                const errorText = await res.text();
                console.error(`Response body (first 500 chars): ${errorText.substring(0, 500)}...`);
                keepFetching = false;
                break;
            }

            const text = await res.text();
            const $ = load(text); // Cheerio still used for Steam Market HTML

            let pageItemsFound = 0;
               $('.market_listing_row_link').each((i, el) => {
                const rowLink = $(el);
                let name = rowLink.find('.market_listing_item_name').text().trim();
                const priceDataElement = rowLink.find('.normal_price[data-price]');
                
                if (name && priceDataElement.length > 0) {
                    const priceCents = parseInt(priceDataElement.attr('data-price'));
                    if (!isNaN(priceCents)) {
                        const priceValue = priceCents / 100;
                        
                        // Original Steam Market image URL scraped directly
                        let steamImageUrlFromScrape = rowLink.find('.market_listing_item_img').attr('src');
                        // Optional: Transform Steam image to high-res if needed for fallback
                        if (steamImageUrlFromScrape) {
                            if (steamImageUrlFromScrape.includes('/96fx96f/')) {
                                steamImageUrlFromScrape = steamImageUrlFromScrape.replace('/96fx96f/', '/360fx360f/');
                            } else if (steamImageUrlFromScrape.includes('economy/image/')) {
                                steamImageUrlFromScrape = steamImageUrlFromScrape.replace(/\/\d+x\d+f\.png$/, '.png');
                            }
                        }

                        // Clean Steam name for matching with CSROI JSON
                        let steamNameForMatching = name.replace(/^CS:GO\s/i, '').trim(); 
                        
                        // Look up data in the CSROI map
                        const csroiData = csroiDetailsMap.get(steamNameForMatching);
                        
                        // Get ROI and Key Cost from CSROI data
                        const roi = csroiData ? csroiData.roi : null;
                        const keyCostSteam = csroiData ? csroiData.keyCostSteam : null;

                        allCasesData.push({ 
                            name, 
                            price: priceValue, 
                            csroiImageUrl: csroiData ? csroiData.imageUrl : null, // CSROI image URL
                            steamImageUrl: steamImageUrlFromScrape,               // Steam Market image URL (now always included)
                            roi,                                                  // ROI from CSROI
                            keyCostSteam                                          // Key Cost from CSROI
                        }); 
                        pageItemsFound++;
                    } else { // This 'else' is for the !isNaN(priceCents) check
                        console.warn(`WARN: Could not parse price for "${name}". data-price attribute invalid on page ${currentPage + 1}.`);
                    } // <-- This closing brace was missing, causing the 'else' below to be misinterpreted
                } else { // This 'else' is for the (name && priceDataElement.length > 0) check
                    // Check if missing any essential info.
                    let missingParts = [];
                    if (!name) missingParts.push('name');
                    if (!(priceDataElement.length > 0)) missingParts.push('price element');
                    if (!rowLink.find('.market_listing_item_img').attr('src')) missingParts.push('image URL');

                    console.warn(`WARN: Skipping listing (name: "${name}", missing: ${missingParts.join(', ')}) due to missing data on page ${currentPage + 1}.`);
                }
                }); // End of .each loop 
            if (pageItemsFound === 0) {
                console.log(`No new items found on page ${currentPage + 1}. Stopping pagination.`);
                keepFetching = false;
            } else {
                totalItemsFound += pageItemsFound;
                console.log(`Scraped ${pageItemsFound} items from page ${currentPage + 1}. Total scraped: ${totalItemsFound}`);
                currentPage++;
                await delay(2000); // 2 seconds delay between pages
            }

        } catch (error) {
            console.error(`FATAL ERROR scraping page ${currentPage + 1} from URL ${pageUrl}:`, error);
            keepFetching = false;
        }
    }

    if (Object.keys(allCasesData).length === 0) {
        console.warn(`WARN: No cases found at all during pagination process.`);
    } else {
        console.log(`FINAL SUCCESS: Scraped a total of ${allCasesData.length} unique cases with prices, images, and ROI.`);
    }

    return allCasesData;
}

// Keep getCasePrice for consistency. This function is for individual price lookups.
// No changes needed here as it's separate.
async function getCasePrice(caseName) {
    const searchName = encodeURIComponent(caseName);
    const url = `https://steamcommunity.com/market/listings/730/${searchName}`;

    try {
        const res = await fetch(url);
        const text = await res.text();
        const $ = load(text);

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
                    // console.warn(`WARN: Failed to parse g_rgItemInfo JSON for ${caseName} (individual fetch). Error: ${jsonError.message}`);
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

export { getAllCasePricesFromSearchPage, getCasePrice };