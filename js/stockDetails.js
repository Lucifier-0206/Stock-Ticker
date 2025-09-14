document.addEventListener('DOMContentLoaded', () => {
    // Get the stock symbol from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol');
    
    if (!symbol) {
        showError('No stock symbol provided');
        return;
    }

    fetchStockDetails(symbol);
});

async function fetchStockDetails(symbol) {
    try {
        // Format symbol for Indian stocks, ensuring .NS suffix
        const formattedSymbol = symbol.toUpperCase().trim()
            .replace(/[^\w.]/g, '') // Remove any special characters
            .replace(/\.NS\.NS$/, '.NS') // Fix double .NS
            .replace(/^\.NS/, '') // Remove leading .NS
            .replace(/\.NS$/, '') // Remove .NS to add it properly
            + '.NS';

        // Use a reliable proxy service
        const proxyUrl = 'https://api.allorigins.win/get?url=';
        
        // Yahoo Finance API endpoint with all required data
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${formattedSymbol}`;
        const params = new URLSearchParams({
            interval: '1d',
            range: '1d',
            includePrePost: true,
            includeAdjustedClose: true,
            events: 'div,splits,earnings',
            useYfid: true,
            region: 'IN',
            lang: 'en-IN',
            corsDomain: 'finance.yahoo.com'
        });

        console.log('Fetching data for symbol:', formattedSymbol);
        
        // Fetch data through proxy
        const response = await fetch(`${proxyUrl}${encodeURIComponent(`${yahooUrl}?${params}`)}`, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // allorigins returns the data in a 'contents' property as a string
        const data = JSON.parse(result.contents);

        if (!data.chart?.result?.[0]) {
            throw new Error('Invalid data format received');
        }

        const stockData = data.chart.result[0];
        const quote = stockData.indicators.quote[0] || {};
        const meta = {
            ...stockData.meta,
            timestamp: stockData.timestamp,
            symbol: formattedSymbol,
            instrumentType: 'EQUITY',
            exchangeName: 'NSE',
            regularMarketTime: stockData.meta.regularMarketTime,
            regularMarketPrice: stockData.meta.regularMarketPrice,
            chartPreviousClose: stockData.meta.chartPreviousClose,
            previousClose: stockData.meta.previousClose,
            scale: stockData.meta.scale,
            priceHint: stockData.meta.priceHint,
            currentTradingPeriod: stockData.meta.currentTradingPeriod,
            tradingPeriods: stockData.meta.tradingPeriods,
            dataGranularity: stockData.meta.dataGranularity,
            range: stockData.meta.range,
            validRanges: stockData.meta.validRanges
        };

        // Additional derived data
        if (quote.high && quote.high.length > 0) {
            meta.dayHigh = Math.max(...quote.high.filter(h => h !== null));
        }
        if (quote.low && quote.low.length > 0) {
            meta.dayLow = Math.min(...quote.low.filter(l => l !== null));
        }
        if (quote.volume && quote.volume.length > 0) {
            meta.volume = quote.volume[quote.volume.length - 1];
        }

        console.log('Stock Data:', stockData);
        console.log('Quote:', quote);
        console.log('Meta:', meta);

        updateUI(stockData, quote, meta);

    } catch (error) {
        console.error('Error fetching stock data:', error);
        showError(`Failed to load stock data. Please try again later.`);
    }
}

function updateUI(stockData, quote, meta) {
    try {
        // Hide loading overlay
        document.getElementById('loadingOverlay').style.display = 'none';

        // Helper functions
        const safeNumber = (value, prefix = '₹', decimals = 2) => {
            return value && !isNaN(value) ? `${prefix}${Number(value).toFixed(decimals)}` : '--';
        };

        const safeDate = (timestamp) => {
            if (!timestamp) return '--';
            // If timestamp is in seconds (Unix timestamp), convert to milliseconds
            const date = new Date(timestamp * (timestamp < 10000000000 ? 1000 : 1));
            return date.toLocaleDateString('en-IN');
        };

        const updateElement = (id, value, prefix = '', animationDelay = 0) => {
            const element = document.getElementById(id);
            if (element) {
                element.style.opacity = '0';
                element.textContent = value ? `${prefix}${value}` : '--';
                setTimeout(() => {
                    element.style.opacity = '1';
                    element.classList.add('value-update');
                    setTimeout(() => element.classList.remove('value-update'), 300);
                }, animationDelay);
            }
        };

        // Update basic info
        const stockName = meta.longName || meta.shortName || meta.symbol?.replace('.NS', '') || 'Stock Details';
        document.getElementById('stockName').textContent = stockName;
        document.getElementById('stockSymbol').textContent = meta.symbol?.replace('.NS', '') || '--';
        document.title = `${stockName} - Stock Details`;

        // Update last updated time
        const lastUpdated = new Date(meta.regularMarketTime * 1000).toLocaleString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        document.getElementById('lastUpdated').textContent = lastUpdated;

        // Price and Change
        const currentPrice = meta.regularMarketPrice || 0;
        const previousClose = meta.previousClose || 0;
        const priceChange = currentPrice - previousClose;
        const changePercent = previousClose !== 0 ? (priceChange / previousClose) * 100 : 0;

        updateElement('currentPrice', safeNumber(currentPrice));
        
        const changeElement = document.getElementById('priceChange');
        const changeAmountElement = document.getElementById('changeAmount');
        const changePercentElement = document.getElementById('changePercent');
        
        if (currentPrice && previousClose) {
            changeAmountElement.textContent = `₹${Math.abs(priceChange).toFixed(2)}`;
            changePercentElement.textContent = `(${Math.abs(changePercent).toFixed(2)}%)`;
            
            if (priceChange >= 0) {
                changeElement.className = 'price-change positive';
                changeAmountElement.textContent = `+₹${Math.abs(priceChange).toFixed(2)}`;
            } else {
                changeElement.className = 'price-change negative';
            }
        }

        // Trading Information
        const tradingMetrics = [
            { id: 'openPrice', value: meta.regularMarketOpen },
            { id: 'prevClose', value: meta.previousClose },
            { id: 'dayHigh', value: meta.regularMarketDayHigh },
            { id: 'dayLow', value: meta.regularMarketDayLow },
            { id: 'yearHigh', value: meta.fiftyTwoWeekHigh },
            { id: 'yearLow', value: meta.fiftyTwoWeekLow }
        ];

        tradingMetrics.forEach(({ id, value }, index) => {
            updateElement(id, safeNumber(value), '', index * 50);
        });

        // Market Statistics
        updateElement('marketCap', formatLargeNumber(meta.marketCap));
        updateElement('volume', formatLargeNumber(meta.regularMarketVolume));
        updateElement('averageVolume', formatLargeNumber(meta.averageDailyVolume3Month));
        updateElement('beta', meta.beta?.toFixed(2));

        // Financial Ratios
        updateElement('peRatio', meta.trailingPE?.toFixed(2));
        updateElement('eps', safeNumber(meta.trailingEps, '₹'));
        updateElement('forwardPE', meta.forwardPE?.toFixed(2));
        updateElement('priceToBook', meta.priceToBook?.toFixed(2));

        // Dividend Information
        if (meta.dividendRate || meta.dividendYield) {
            updateElement('dividendRate', safeNumber(meta.dividendRate, '₹'));
            updateElement('dividendYield', meta.dividendYield ? `${(meta.dividendYield * 100).toFixed(2)}%` : '--');
            updateElement('dividendDate', safeDate(meta.dividendDate));
            updateElement('exDividendDate', safeDate(meta.exDividendDate));
        }

        // Additional Information
        const additionalInfo = {
            industry: meta.industry,
            sector: meta.sector,
            country: meta.country,
            website: meta.website
        };

        Object.entries(additionalInfo).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                if (key === 'website' && value) {
                    element.href = value;
                    element.textContent = new URL(value).hostname;
                } else {
                    element.textContent = value || '--';
                }
            }
        });

    } catch (error) {
        console.error('Error updating UI:', error);
        showError('Error displaying stock data');
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