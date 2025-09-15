document.addEventListener('DOMContentLoaded', () => {
    // Get the stock symbol from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol');
    
    if (!symbol) {
        showError('No stock symbol provided');
        return;
    }

    // Initialize interactive features
    initializeInteractiveFeatures();
    
    fetchStockDetails(symbol);
});

// Interactive features initialization
function initializeInteractiveFeatures() {
    // Expandable sections
    initializeExpandableSections();
}

// Initialize expandable sections
function initializeExpandableSections() {
    document.querySelectorAll('.expandable-header').forEach(header => {
        header.addEventListener('click', toggleExpandableSection);
    });
}

// Toggle expandable sections
function toggleExpandableSection(e) {
    const section = this.parentElement;
    section.classList.toggle('expanded');
}

async function fetchStockDetails(symbol) {
    try {
        // Format symbol for Indian stocks, ensuring .NS suffix
        const formattedSymbol = symbol.toUpperCase().trim()
            .replace(/[^\w.]/g, '') // Remove any special characters
            .replace(/\.NS\.NS$/, '.NS') // Fix double .NS
            .replace(/^\.NS/, '') // Remove leading .NS
            .replace(/\.NS$/, '') // Remove .NS to add it properly
            + '.NS';

        // Yahoo Finance API endpoint
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${formattedSymbol}`;
        const params = new URLSearchParams({
            range: '1d',
            interval: '1m',
            indicators: 'quote',
            includeTimestamps: 'true'
        });

        console.log('Fetching data for symbol:', formattedSymbol);
        
        // Try multiple CORS proxies if the first one fails
        const corsProxies = [
            'https://api.allorigins.win/get?url=',
            'https://corsproxy.io/?',
            'https://cors-anywhere.herokuapp.com/'
        ];

        let lastError;
        let responseData;

        for (const proxy of corsProxies) {
            try {
                console.log('Trying proxy:', proxy);
                const response = await fetch(`${proxy}${encodeURIComponent(`${yahooUrl}?${params}`)}`, {
                    headers: {
                        'Accept': 'application/json',
                        'Origin': window.location.origin
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                
                // Different proxies return data in different formats
                responseData = proxy === 'https://api.allorigins.win/get?url=' ? 
                    JSON.parse(result.contents) : result;
                break; // Found a working proxy, exit the loop
            } catch (error) {
                console.warn(`Failed with proxy ${proxy}:`, error);
                lastError = error;
                continue;
            }
        }

        if (!responseData) {
            throw new Error(`All proxies failed. Last error: ${lastError?.message}`);
        }

        console.log('Full API Response:', responseData);
        
        const chart = responseData.chart.result[0];
        const quote = chart.indicators.quote[0];
        const chartMeta = chart.meta;
        
        console.log('=== AVAILABLE API DATA ===');
        console.log('Chart Meta Keys:', Object.keys(chartMeta));
        console.log('Chart Meta Full Object:', chartMeta);
        console.log('Quote Keys:', Object.keys(quote));
        console.log('Quote Full Object:', quote);
        console.log('========================');
        
        const meta = {
            symbol: formattedSymbol,
            regularMarketPrice: chartMeta.regularMarketPrice,
            regularMarketChange: chartMeta.regularMarketPrice - chartMeta.previousClose,
            regularMarketChangePercent: ((chartMeta.regularMarketPrice - chartMeta.previousClose) / chartMeta.previousClose) * 100,
            regularMarketTime: chartMeta.regularMarketTime,
            regularMarketOpen: chartMeta.regularMarketOpen || chartMeta.chartPreviousClose,
            previousClose: chartMeta.previousClose,
            regularMarketDayHigh: Math.max(...quote.high.filter(h => h !== null)),
            regularMarketDayLow: Math.min(...quote.low.filter(l => l !== null)),
            regularMarketVolume: chartMeta.regularMarketVolume || quote.volume[quote.volume.length - 1] || quote.volume.reduce((a, b) => a + (b || 0), 0),
            currency: chartMeta.currency || 'INR',
            exchangeName: chartMeta.exchangeName,
            fullExchangeName: chartMeta.fullExchangeName,
            instrumentType: chartMeta.instrumentType,
            priceHint: chartMeta.priceHint,
            marketCap: chartMeta.marketCap,
            fiftyTwoWeekHigh: chartMeta.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: chartMeta.fiftyTwoWeekLow,
            averageDailyVolume3Month: chartMeta.averageDailyVolume3Month,
            // Additional fields that might be available
            longName: chartMeta.longName,
            shortName: chartMeta.shortName,
            displayName: chartMeta.displayName,
            timezone: chartMeta.timezone,
            gmtOffSetMilliseconds: chartMeta.gmtOffSetMilliseconds,
            currentTradingPeriod: chartMeta.currentTradingPeriod,
            tradingPeriods: chartMeta.tradingPeriods,
            dataGranularity: chartMeta.dataGranularity,
            range: chartMeta.range,
            validRanges: chartMeta.validRanges,
            scale: chartMeta.scale,
            chartPreviousClose: chartMeta.chartPreviousClose
        };

        // Ensure we have price change data
        if (!meta.regularMarketChange) {
            meta.regularMarketChange = meta.regularMarketPrice - meta.previousClose;
            meta.regularMarketChangePercent = (meta.regularMarketChange / meta.previousClose) * 100;
        }

        console.log('Meta:', meta);

        updateUI(null, null, meta);

    } catch (error) {
        console.error('Error fetching stock data:', error);
        showError(`Failed to load stock data. Please try again later.`);
    }
}

function updateUI(stockData, quote, meta) {
    console.log('Updating UI with data:', { meta, quote });
    try {
        // Hide loading overlay
        document.getElementById('loadingOverlay').style.display = 'none';

        // Helper functions
        const safeNumber = (value, prefix = '₹', decimals = 2) => {
            return value && !isNaN(value) ? `${prefix}${Number(value).toFixed(decimals)}` : '--';
        };

        const safeDate = (timestamp) => {
            if (!timestamp) return '--';
            const date = new Date(timestamp * (timestamp < 10000000000 ? 1000 : 1));
            return date.toLocaleDateString('en-IN');
        };

        const updateElement = (id, value, animationDelay = 0) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value || '--';
                element.classList.add('value-update');
                setTimeout(() => element.classList.remove('value-update'), 300);
            } else {
                console.warn(`Element with id '${id}' not found`);
            }
        };

        // Update basic info
        const stockName = meta.longName || meta.shortName || meta.symbol?.replace('.NS', '') || 'Stock Details';
        const exchangeInfo = meta.exchangeName || 'NSE';
        
        document.getElementById('stockName').textContent = stockName;
        document.getElementById('stockSymbol').textContent = meta.symbol?.replace('.NS', '') || '--';
        
        const exchangeElement = document.getElementById('exchangeName');
        if (exchangeElement) {
            exchangeElement.textContent = exchangeInfo;
        }
        
        document.title = `${stockName} - Stock Details`;

        // Update last updated time
        const lastUpdated = new Date(meta.regularMarketTime * 1000).toLocaleString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            day: '2-digit',
            month: 'short'
        });
        document.getElementById('lastUpdated').textContent = lastUpdated;

        // Price and Change
        const currentPrice = meta.regularMarketPrice || 0;
        const previousClose = meta.previousClose || 0;
        const priceChange = currentPrice - previousClose;
        const changePercent = previousClose !== 0 ? (priceChange / previousClose) * 100 : 0;

        updateElement('currentPrice', safeNumber(currentPrice));
        
        const inlineChangeElement = document.querySelector('.inline-price-change');
        const changeAmountElement = document.getElementById('changeAmount');
        const changePercentElement = document.getElementById('changePercent');
        const changeDirectionElement = document.getElementById('changeDirection');

        if (currentPrice && previousClose) {
            const isPositive = priceChange >= 0;
            const changeDirection = isPositive ? '▲' : '▼';
            const sign = isPositive ? '+' : '';
            
            changeDirectionElement.textContent = changeDirection;
            changeAmountElement.textContent = `${sign}₹${Math.abs(priceChange).toFixed(2)}`;
            changePercentElement.textContent = `(${sign}${Math.abs(changePercent).toFixed(2)}%)`;
            
            // Apply color to the entire inline price change container
            const colorClass = isPositive ? 'positive' : 'negative';
            if (inlineChangeElement) {
                inlineChangeElement.className = `inline-price-change ${colorClass}`;
            }
        } else {
            changeDirectionElement.textContent = '--';
            changeAmountElement.textContent = '--';
            changePercentElement.textContent = '--';
            if (inlineChangeElement) {
                inlineChangeElement.className = 'inline-price-change';
            }
        }

        // Update individual metric elements
        console.log('Volume data being processed:', meta.regularMarketVolume);
        updateElement('openPrice', safeNumber(meta.regularMarketOpen));
        updateElement('prevClose', safeNumber(meta.previousClose));
        updateElement('dayHigh', safeNumber(meta.regularMarketDayHigh));
        updateElement('dayLow', safeNumber(meta.regularMarketDayLow));
        updateElement('volume', formatVolume(meta.regularMarketVolume));
        updateElement('marketCap', formatLargeNumber(meta.marketCap));
        updateElement('yearHigh', safeNumber(meta.fiftyTwoWeekHigh));
        updateElement('yearLow', safeNumber(meta.fiftyTwoWeekLow));
        
        // Financial ratios
        updateElement('peRatio', meta.trailingPE ? meta.trailingPE.toFixed(2) : '--');
        updateElement('eps', safeNumber(meta.eps));
        updateElement('dividendYield', meta.dividendYield ? `${(meta.dividendYield * 100).toFixed(2)}%` : '--');
        updateElement('beta', meta.beta ? meta.beta.toFixed(2) : '--');

    } catch (error) {
        console.error('Error updating UI:', error);
        console.log('Failed data:', { stockData, quote, meta });
        showError(`Error displaying stock data: ${error.message}`);
    }
}

// Function to show error with animation
function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    // Hide loading overlay
    loadingOverlay.style.display = 'none';
    
    // Update error message
    errorElement.querySelector('p').textContent = message;
    
    // Show error with animation
    errorElement.style.display = 'flex';
    errorElement.style.opacity = '0';
    errorElement.style.transform = 'translateY(20px)';
    
    requestAnimationFrame(() => {
        errorElement.style.opacity = '1';
        errorElement.style.transform = 'translateY(0)';
    });
}

function formatMetricLabel(id) {
    const labels = {
        'openPrice': 'Open',
        'prevClose': 'Prev Close',
        'dayHigh': 'Day High',
        'dayLow': 'Day Low',
        'yearHigh': '52W High',
        'yearLow': '52W Low'
    };
    return labels[id] || id;
}

function formatValue(value, type = 'number') {
    if (value === null || value === undefined) return '--';

    switch (type) {
        case 'currency':
            return formatLargeNumber(value);
        case 'volume':
            return formatVolume(value);
        case 'percentage':
            return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
        case 'price':
            return `₹${Number(value).toFixed(2)}`;
        default:
            return value.toString();
    }
}

function formatVolume(num) {
    if (!num) return '--';
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)}L`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toString();
}

function formatLargeNumber(num) {
    if (num >= 1.0e12) {
        return `₹${(num / 1.0e12).toFixed(2)}T`;
    }
    if (num >= 1.0e9) {
        return `₹${(num / 1.0e9).toFixed(2)}B`;
    }
    if (num >= 1.0e6) {
        return `₹${(num / 1.0e6).toFixed(2)}M`;
    }
    if (num >= 1.0e3) {
        return `₹${(num / 1.0e3).toFixed(2)}K`;
    }
    return `₹${num}`;
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide loading states
    document.getElementById('stockName').textContent = 'Error';
    document.getElementById('stockSymbol').textContent = '';
}