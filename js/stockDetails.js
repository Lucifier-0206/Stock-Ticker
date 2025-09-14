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
        
        const meta = {
            symbol: formattedSymbol,
            symbol: formattedSymbol,
            regularMarketPrice: chartMeta.regularMarketPrice,
            regularMarketChange: chartMeta.regularMarketPrice - chartMeta.previousClose,
            regularMarketChangePercent: ((chartMeta.regularMarketPrice - chartMeta.previousClose) / chartMeta.previousClose) * 100,
            regularMarketTime: chartMeta.regularMarketTime,
            regularMarketOpen: chartMeta.chartPreviousClose,
            previousClose: chartMeta.previousClose,
            regularMarketDayHigh: Math.max(...quote.high.filter(h => h !== null)),
            regularMarketDayLow: Math.min(...quote.low.filter(l => l !== null)),
            regularMarketVolume: quote.volume[quote.volume.length - 1],
            currency: chartMeta.currency,
            exchangeName: chartMeta.exchangeName,
            instrumentType: chartMeta.instrumentType,
            priceHint: chartMeta.priceHint
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
        
        const changeDirectionElement = document.getElementById('changeDirection');

        if (currentPrice && previousClose) {
            const isPositive = priceChange >= 0;
            const changeDirection = isPositive ? '▲' : '▼';
            const sign = isPositive ? '+' : '';
            
            changeDirectionElement.textContent = changeDirection;
            changeAmountElement.textContent = `${sign}₹${Math.abs(priceChange).toFixed(2)}`;
            changePercentElement.textContent = `${sign}${Math.abs(changePercent).toFixed(2)}%`;
            
            changeElement.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
        } else {
            changeDirectionElement.textContent = '--';
            changeAmountElement.textContent = '--';
            changePercentElement.textContent = '--';
            changeElement.className = 'price-change';
        }

        // Trading Information with improved metrics
        const tradingMetrics = [
            {
                id: 'openPrice',
                icon: '📈',
                value: meta.regularMarketOpen,
                percentage: meta.previousClose ? ((meta.regularMarketOpen - meta.previousClose) / meta.previousClose) * 100 : null,
                label: 'Open Price',
                tooltip: 'Today\'s opening price'
            },
            {
                id: 'prevClose',
                icon: '🔄',
                value: meta.previousClose,
                label: 'Previous Close',
                tooltip: 'Yesterday\'s closing price'
            },
            {
                id: 'dayHigh',
                icon: '⬆️',
                value: meta.regularMarketDayHigh,
                percentage: meta.previousClose ? ((meta.regularMarketDayHigh - meta.previousClose) / meta.previousClose) * 100 : null,
                label: 'Day High',
                tooltip: 'Highest price today'
            },
            {
                id: 'dayLow',
                icon: '⬇️',
                value: meta.regularMarketDayLow,
                percentage: meta.previousClose ? ((meta.regularMarketDayLow - meta.previousClose) / meta.previousClose) * 100 : null,
                label: 'Day Low',
                tooltip: 'Lowest price today'
            },
            {
                id: 'yearHigh',
                icon: '🏆',
                value: meta.fiftyTwoWeekHigh,
                percentage: meta.regularMarketPrice ? ((meta.fiftyTwoWeekHigh - meta.regularMarketPrice) / meta.regularMarketPrice) * 100 : null,
                label: '52-Week High',
                tooltip: 'Highest price in the last year'
            },
            {
                id: 'yearLow',
                icon: '📉',
                value: meta.fiftyTwoWeekLow,
                percentage: meta.regularMarketPrice ? ((meta.regularMarketPrice - meta.fiftyTwoWeekLow) / meta.fiftyTwoWeekLow) * 100 : null,
                label: '52-Week Low',
                tooltip: 'Lowest price in the last year'
            }
        ];

        // Create metric cards container if it doesn't exist
        const metricsContainer = document.getElementById('tradingMetrics') || (() => {
            const container = document.createElement('div');
            container.id = 'tradingMetrics';
            container.className = 'metrics-row';
            const tradingSection = document.querySelector('.metrics-section:first-of-type .stock-metrics');
            tradingSection.appendChild(container);
            return container;
        })();

        // Clear existing metrics
        metricsContainer.innerHTML = '';

        // Create metric cards
        tradingMetrics.forEach((metric, index) => {
            const metricCard = document.createElement('div');
            metricCard.className = 'metric-card';
            metricCard.id = `${metric.id}-card`;
            metricCard.title = metric.tooltip;

            const icon = document.createElement('div');
            icon.className = 'metric-icon';
            icon.textContent = metric.icon;
            metricCard.appendChild(icon);

            const label = document.createElement('div');
            label.className = 'metric-label';
            label.textContent = metric.label;
            metricCard.appendChild(label);

            const valueContainer = document.createElement('div');
            valueContainer.className = 'metric-value-container';
            
            const value = document.createElement('div');
            value.className = 'metric-value';
            value.textContent = safeNumber(metric.value);
            valueContainer.appendChild(value);

            if (metric.percentage !== null && metric.percentage !== undefined) {
                const percentage = document.createElement('div');
                percentage.className = 'metric-percentage';
                const percentageValue = metric.percentage;
                const sign = percentageValue >= 0 ? '+' : '';
                percentage.textContent = `${sign}${percentageValue.toFixed(2)}%`;
                percentage.classList.add(percentageValue >= 0 ? 'positive' : 'negative');
                valueContainer.appendChild(percentage);
            }

            metricCard.appendChild(valueContainer);

            metricsContainer.appendChild(metricCard);
        });

        // Market Statistics
        updateElement('marketCap', formatLargeNumber(meta.marketCap));
        updateElement('volume', formatLargeNumber(meta.regularMarketVolume));
        updateElement('averageVolume', formatLargeNumber(meta.averageDailyVolume3Month));
        updateElement('beta', meta.beta?.toFixed(2));

        // Financial Ratios
        updateElement('peRatio', meta.trailingPE?.toFixed(2));
        updateElement('forwardPE', meta.forwardPE?.toFixed(2));
        updateElement('marketCapAlt', formatLargeNumber(meta.marketCap));
        updateElement('currency', meta.currency || 'INR');

        // Update additional info
        updateElement('longName', meta.longName || meta.shortName);
        updateElement('industry', meta.industry || '--');
        updateElement('sector', meta.sector || '--');

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