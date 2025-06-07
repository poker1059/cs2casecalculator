// steam.js
import fetch from 'node-fetch';
import { load } from 'cheerio'; // <-- THIS IS THE CORRECT LINE FOR ES MODULES

// Helper function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getAllCasePricesFromSearchPage() {
    // Keep 'q=case' and remove '&count=100' for now, relying on default 10 per page
    const baseUrl = 'https://steamcommunity.com/market/search?q=case&category_730_ItemSet%5B%5D=any&category_730_ProPlayer%5B%5D=any&category_730_StickerCapsule%5B%5D=any&category_730_Tournament%5B%5D=any&category_730_TournamentTeam%5B%5D=any&category_730_Type%5B%5D=tag_CSGO_Type_WeaponCase&category_730_Weapon%5B%5D=any&appid=730';
    const allPrices = {};
    const itemsPerPage = 10; // Reverted to 10 based on observed Steam behavior
    let currentPage = 0;
    let totalItemsFound = 0;
    let keepFetching = true;
    const maxPagesToFetch = 10; // Set a higher limit, as 42 items means 5 pages at 10 items/page

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
            const $ = load(text); // Use 'load' directly

            let pageItemsFound = 0;

            $('.market_listing_row_link').each((i, el) => {
                const rowLink = $(el);
                const name = rowLink.find('.market_listing_item_name').text().trim();
                const priceDataElement = rowLink.find('.normal_price[data-price]');

                if (name && priceDataElement.length > 0) {
                    const priceCents = parseInt(priceDataElement.attr('data-price'));
                    if (!isNaN(priceCents)) {
                        const priceValue = priceCents / 100;
                        allPrices[name] = priceValue;
                        pageItemsFound++;
                    } else {
                        console.warn(`WARN: Could not parse price for "${name}". data-price attribute invalid on page ${currentPage + 1}.`);
                    }
                }
            });

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

    if (Object.keys(allPrices).length === 0) {
        console.warn(`WARN: No prices found at all during pagination process.`);
    } else {
        console.log(`FINAL SUCCESS: Scraped a total of ${Object.keys(allPrices).length} unique case prices.`);
    }

    return allPrices;
}

// Keep getCasePrice for consistency.
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