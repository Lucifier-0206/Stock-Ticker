// Constants
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const YAHOO_FINANCE_API = 'https://query1.finance.yahoo.com/v8/finance/chart/';

// DOM Elements
const stockSearch = document.getElementById('stockSearch');
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



const handleSearch = debounce(async function(searchSymbol) {
    const symbol = searchSymbol || stockSearch.value.trim();
    if (!symbol) return;

    // Format symbol for NSE
    const formattedSymbol = symbol.toUpperCase().trim()
        .replace(/[^\w.]/g, '') // Remove any special characters
        .replace(/\.NS\.NS$/, '.NS') // Fix double .NS
        .replace(/^\.NS/, '') // Remove leading .NS
        .replace(/\.NS$/, '') // Remove .NS to add it properly
        + '.NS';

    // Navigate to the stock details page
    window.location.href = `stock-details.html?symbol=${encodeURIComponent(formattedSymbol)}`;
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

// Search now happens only through suggestions and stock tags

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

// Enter key disabled - use search button or click suggestions instead

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
        // Navigate to the stock details page
        window.location.href = `stock-details.html?symbol=${encodeURIComponent(symbol)}`;
    }
});

// Select stock function for quick tags
function selectStock(symbol) {
    if (symbol) {
        window.location.href = `stock-details.html?symbol=${encodeURIComponent(symbol)}`;
    }
}

stockTags.forEach(tag => {
    tag.addEventListener('click', () => {
        const symbol = tag.getAttribute('data-symbol');
        selectStock(symbol);
    });
});


