// Constants
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const YAHOO_FINANCE_API = 'https://query1.finance.yahoo.com/v8/finance/chart/';

// DOM Elements
const stockSearch = document.getElementById('stockSearch');
const searchBtn = document.getElementById('searchBtn');
const stockResults = document.getElementById('stockResults');
const searchSuggestions = document.getElementById('searchSuggestions');
const stockTags = document.querySelectorAll('.stock-tag');

// Global state
let selectedStock = null;

// Utility function to prevent excessive API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Functions
async function fetchStockData(symbol) {
    try {
        if (!symbol) throw new Error('No symbol provided');

        // Format symbol for Indian stocks, ensuring .NS suffix
        const formattedSymbol = symbol.toUpperCase().trim()
            .replace(/[^\w.]/g, '') // Remove any special characters
            .replace(/\.NS\.NS$/, '.NS') // Fix double .NS
            .replace(/^\.NS/, '') // Remove leading .NS
            .replace(/\.NS$/, '') // Remove .NS to add it properly
            + '.NS';

        console.log('Fetching data for:', formattedSymbol);

        const params = new URLSearchParams({
            interval: '1d',
            range: '1d',
            includePrePost: false,
            useYfid: true,
            region: 'IN',
            lang: 'en-IN',
            corsDomain: 'finance.yahoo.com'
        });

        const url = `${YAHOO_FINANCE_API}${formattedSymbol}?${params}`;
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
        console.log('API URL:', proxyUrl);

        // Try multiple CORS proxies if the first one fails
        const corsProxies = [
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
            'https://cors-anywhere.herokuapp.com/'
        ];

        let lastError;
        for (const proxy of corsProxies) {
            try {
                const proxyUrl = `${proxy}${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl, {
                    headers: { 'Origin': window.location.origin }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (!data.chart?.result?.[0]) {
                    throw new Error('Invalid data format received');
                }

                // Update the working proxy for future requests
                if (proxy !== CORS_PROXY) {
                    console.log('Updating CORS proxy to:', proxy);
                    CORS_PROXY = proxy;
                }

                return data.chart.result[0];
            } catch (error) {
                console.warn(`Failed with proxy ${proxy}:`, error);
                lastError = error;
                continue; // Try next proxy
            }
        }

        // If all proxies failed, throw the last error
        throw new Error(`All CORS proxies failed. Last error: ${lastError.message}`);
    } catch (error) {
        console.error('Error fetching stock data:', error);
        throw error;
    }
}

function createStockCard(stockData) {
    try {
        const { meta, indicators } = stockData;
        
        if (!meta || !indicators?.quote?.[0]) {
            throw new Error('Invalid stock data format');
        }

        const quote = indicators.quote[0];
        const timestamp = stockData.timestamp || [];
        const lastIndex = timestamp.length - 1;

        // Ensure we have valid price data
        const currentPrice = meta.regularMarketPrice || meta.currentPrice || 
            (quote.close && quote.close[lastIndex]) || 0;
        const previousClose = meta.previousClose || meta.chartPreviousClose || 
            (quote.close && quote.close[0]) || currentPrice;

        // Calculate changes safely
        const change = meta.regularMarketChange || (currentPrice - previousClose) || 0;
        const changePercent = meta.regularMarketChangePercent || 
            ((currentPrice !== 0 && previousClose !== 0) ? ((change / previousClose) * 100) : 0);

        // Calculate day range safely
        const validHighs = quote.high?.filter(h => h !== null && !isNaN(h)) || [];
        const validLows = quote.low?.filter(l => l !== null && !isNaN(l)) || [];
        const dayHigh = validHighs.length > 0 ? Math.max(...validHighs) : currentPrice;
        const dayLow = validLows.length > 0 ? Math.min(...validLows) : currentPrice;

        // Format values safely
        const formatNumber = (num) => {
            return isNaN(num) ? '0.00' : num.toFixed(2);
        };

        const formatLargeNumber = (num) => {
            if (!num || isNaN(num)) return '0';
            if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
            if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
            return num.toLocaleString('en-IN');
        };

        const card = document.createElement('div');
        card.className = 'stock-card';
        
        card.innerHTML = `
            <div class="stock-header">
                <span class="stock-name">${meta.symbol.replace('.NS', '')}</span>
                <span class="stock-symbol">${meta.exchangeName || 'NSE'}</span>
            </div>
            <div class="stock-price">₹${formatNumber(currentPrice)}</div>
            <div class="stock-change ${change >= 0 ? 'positive' : 'negative'}">
                ${change >= 0 ? '▲' : '▼'} ₹${formatNumber(Math.abs(change))} (${formatNumber(Math.abs(changePercent))}%)
            </div>
            <div class="stock-details">
                <div class="detail-item">
                    <span class="detail-label">Day's Range</span>
                    <span class="detail-value">₹${formatNumber(dayLow)} - ₹${formatNumber(dayHigh)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Volume</span>
                    <span class="detail-value">${formatLargeNumber(quote.volume?.[lastIndex])}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Last Updated</span>
                    <span class="detail-value">${meta.regularMarketTime ? 
                        new Date(meta.regularMarketTime * 1000).toLocaleTimeString('en-IN') : 
                        'Not available'}</span>
                </div>
            </div>
        `;
        
        return card;
    } catch (error) {
        console.error('Error creating stock card:', error);
        const errorCard = document.createElement('div');
        errorCard.className = 'error-message';
        errorCard.textContent = 'Error displaying stock data: ' + error.message;
        return errorCard;
    }
    

}

const handleSearch = debounce(async function(searchSymbol) {
    const symbol = searchSymbol || stockSearch.value.trim();
    if (!symbol) return;

    // Show loading state
    stockResults.innerHTML = '<div class="loading">Loading stock data...</div>';

    try {
        console.log('Searching for symbol:', symbol);
        const stockData = await fetchStockData(symbol);
        
        // Clear previous results
        stockResults.innerHTML = '';
        
        // Create and append new stock card
        const stockCard = createStockCard(stockData);
        stockResults.appendChild(stockCard);
        
        // Set up real-time updates
        setUpRealTimeUpdates(symbol);
    } catch (error) {
        console.error('Search error:', error);
        let errorMessage = `Could not find stock data for "${symbol}". Please check the symbol and try again.`;
        if (error.message.includes('Failed to fetch')) {
            errorMessage = `Unable to fetch data for "${symbol}". This might be because the market is currently closed or the stock symbol is incorrect.`;
        }
        stockResults.innerHTML = `
            <div class="error-message">
                ${errorMessage}<br>
                <small>Last attempt: ${new Date().toLocaleTimeString('en-IN')}</small>
            </div>
        `;
    }
}, 500); // Wait 500ms between searches

// Search Functions
function showSuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) {
        searchSuggestions.classList.remove('active');
        return;
    }

    searchSuggestions.innerHTML = suggestions
        .map(stock => `
            <div class="suggestion-item" data-symbol="${stock.symbol}">
                <span class="company-name">${stock.name}</span>
                <span class="symbol">${stock.symbol.replace('.NS', '')}</span>
            </div>
        `)
        .join('');
    
    searchSuggestions.classList.add('active');
}

// Event Listeners
searchBtn.addEventListener('click', () => {
    if (selectedStock) {
        handleSearch(selectedStock.symbol);
    } else {
        handleSearch(stockSearch.value);
    }
});

// Debounced search handler for input changes
const handleSearchInput = debounce(async function(query) {
    if (!query || query.length < 2) {
        searchSuggestions.classList.remove('active');
        return;
    }
    
    try {
        searchSuggestions.innerHTML = '<div class="suggestion-item loading">Searching...</div>';
        searchSuggestions.classList.add('active');
        
        const suggestions = await searchStocks(query);
        showSuggestions(suggestions);
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        searchSuggestions.classList.remove('active');
    }
}, 300);

// Input event listener
stockSearch.addEventListener('input', function(e) {
    const query = e.target.value.trim();
    selectedStock = null; // Reset selected stock when user types
    handleSearchInput(query);
});

stockSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (selectedStock) {
            handleSearch(selectedStock.symbol);
        } else {
            handleSearch(stockSearch.value);
        }
    }
});

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!searchSuggestions.contains(e.target) && e.target !== stockSearch) {
        searchSuggestions.classList.remove('active');
    }
});

// Handle suggestion clicks
searchSuggestions.addEventListener('click', (e) => {
    const suggestionItem = e.target.closest('.suggestion-item');
    if (suggestionItem) {
        const symbol = suggestionItem.dataset.symbol;
        const name = suggestionItem.querySelector('.company-name').textContent;
        selectedStock = { symbol: symbol, name: name };
        stockSearch.value = name;
        searchSuggestions.classList.remove('active');
        handleSearch(symbol);
    }
});

stockTags.forEach(tag => {
    tag.addEventListener('click', () => {
        const symbol = tag.getAttribute('data-symbol');
        const stockInfo = baseStockSymbols.find(s => s.symbol === symbol) || 
            { symbol: symbol, name: symbol.replace('.NS', '') };
        selectedStock = stockInfo;
        stockSearch.value = stockInfo.name;
        handleSearch(symbol);
    });
});

// Keep track of the current update interval
let currentUpdateInterval = null;

function setUpRealTimeUpdates(symbol) {
    // Clear any existing interval
    if (currentUpdateInterval) {
        clearInterval(currentUpdateInterval);
        currentUpdateInterval = null;
    }

    let failedAttempts = 0;
    const maxFailedAttempts = 3;

    async function updateStockData() {
        try {
            if (!document.hasFocus()) {
                console.log('Tab not focused, skipping update');
                return;
            }

            const stockData = await fetchStockData(symbol);
            const updatedCard = createStockCard(stockData);
            
            // Replace existing card with updated data
            if (stockResults.firstChild) {
                stockResults.replaceChild(updatedCard, stockResults.firstChild);
            }

            // Reset failed attempts on success
            failedAttempts = 0;

            // Add last update timestamp
            const timestamp = document.createElement('div');
            timestamp.className = 'update-timestamp';
            timestamp.textContent = `Last updated: ${new Date().toLocaleTimeString('en-IN')}`;
            updatedCard.appendChild(timestamp);

        } catch (error) {
            console.error('Error updating stock data:', error);
            failedAttempts++;

            if (failedAttempts >= maxFailedAttempts) {
                console.error('Too many failed attempts, stopping updates');
                clearInterval(currentUpdateInterval);
                currentUpdateInterval = null;

                // Show error message in the card
                const errorMsg = document.createElement('div');
                errorMsg.className = 'error-message';
                errorMsg.textContent = 'Real-time updates paused. Please refresh the page to resume.';
                stockResults.firstChild?.appendChild(errorMsg);
            }
        }
    }

    // Initial update
    updateStockData();

    // Update stock data every 30 seconds
    currentUpdateInterval = setInterval(updateStockData, 30000);

    // Clean up interval when user starts a new search
    function cleanupInterval() {
        if (currentUpdateInterval) {
            clearInterval(currentUpdateInterval);
            currentUpdateInterval = null;
        }
        // Remove event listeners
        stockSearch.removeEventListener('focus', cleanupInterval);
        window.removeEventListener('beforeunload', cleanupInterval);
    }

    // Add cleanup listeners
    stockSearch.addEventListener('focus', cleanupInterval, { once: true });
    window.addEventListener('beforeunload', cleanupInterval, { once: true });
}
