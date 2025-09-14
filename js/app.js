// Constants
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const YAHOO_FINANCE_API = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const stockSearch = document.getElementById('stockSearch');
const searchBtn = document.getElementById('searchBtn');
const stockResults = document.getElementById('stockResults');
const stockTags = document.querySelectorAll('.stock-tag');

// Function declarations first
// Debounce function to prevent rapid-fire API calls
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
        // Format symbol for Indian stocks
        const formattedSymbol = `${symbol.toUpperCase().replace('.NS', '')}.NS`;
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

        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch stock data');
        }

        const data = await response.json();
        
        if (!data.chart?.result?.[0]) {
            throw new Error('Invalid data format received');
        }

        return data.chart.result[0];
    } catch (error) {
        console.error('Error fetching stock data:', error);
        throw error;
    }
}

function createStockCard(stockData) {
    try {
        const { meta, indicators } = stockData;
        
        if (!meta || !indicators.quote[0]) {
            throw new Error('Invalid stock data format');
        }

        const currentPrice = meta.regularMarketPrice || meta.currentPrice;
        const previousClose = meta.previousClose || meta.chartPreviousClose;
        const change = meta.regularMarketChange || (currentPrice - previousClose);
        const changePercent = meta.regularMarketChangePercent || ((change / previousClose) * 100);
        
        const card = document.createElement('div');
        card.className = 'stock-card';
        
        const quote = indicators.quote[0];
        const timestamp = stockData.timestamp;
        const lastIndex = timestamp.length - 1;

        const dayHigh = Math.max(...quote.high.filter(h => h !== null));
        const dayLow = Math.min(...quote.low.filter(l => l !== null));
        
        card.innerHTML = `
            <div class="stock-header">
                <span class="stock-name">${meta.symbol.replace('.NS', '')}</span>
                <span class="stock-symbol">${meta.exchangeName}</span>
            </div>
            <div class="stock-price">₹${currentPrice.toFixed(2)}</div>
            <div class="stock-change ${change >= 0 ? 'positive' : 'negative'}">
                ${change >= 0 ? '▲' : '▼'} ₹${Math.abs(change).toFixed(2)} (${Math.abs(changePercent).toFixed(2)}%)
            </div>
            <div class="stock-details">
                <div>Day's Range: ₹${dayLow.toFixed(2)} - ₹${dayHigh.toFixed(2)}</div>
                <div>Volume: ${quote.volume[lastIndex].toLocaleString()}</div>
                <div>Last Updated: ${new Date(meta.regularMarketTime * 1000).toLocaleTimeString('en-IN')}</div>
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

const handleSearch = debounce(async function() {
    const symbol = stockSearch.value.trim();
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

// Set up event listeners after function definitions
searchBtn.addEventListener('click', handleSearch);
stockSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});
stockTags.forEach(tag => {
    tag.addEventListener('click', () => {
        stockSearch.value = tag.getAttribute('data-symbol');
        handleSearch();
    });
});

// Keep track of the current update interval
let currentUpdateInterval = null;

function setUpRealTimeUpdates(symbol) {
    // Clear any existing interval
    if (currentUpdateInterval) {
        clearInterval(currentUpdateInterval);
    }

    // Update stock data every 30 seconds
    currentUpdateInterval = setInterval(async () => {
        try {
            const stockData = await fetchStockData(symbol);
            const updatedCard = createStockCard(stockData);
            
            // Replace existing card with updated data
            if (stockResults.firstChild) {
                stockResults.replaceChild(updatedCard, stockResults.firstChild);
            }
        } catch (error) {
            console.error('Error updating stock data:', error);
            clearInterval(currentUpdateInterval);
            currentUpdateInterval = null;
        }
    }, 30000); // 30 seconds

    // Clean up interval when user searches for a new stock
    stockSearch.addEventListener('focus', () => {
        if (currentUpdateInterval) {
            clearInterval(currentUpdateInterval);
            currentUpdateInterval = null;
        }
    }, { once: true }); // Only trigger once per focus
}
