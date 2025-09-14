// Base symbols for quick access
const baseStockSymbols = [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd' },
    { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd' },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd' },
    { symbol: 'INFY.NS', name: 'Infosys Ltd' }
];

// Function to search for stocks using Yahoo Finance API
async function searchStocks(query) {
    if (!query || query.length < 2) return [];
    
    try {
        // Format the URL for the Yahoo Finance search API
        const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query&multiQuoteQueryId=multi_quote_single_token_query&enableCb=true&region=IN`;
        
        // Use the CORS proxy
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(searchUrl)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Search request failed');
        
        const data = await response.json();
        
        // Filter and format the results
        const results = data.quotes
            .filter(quote => quote.exchange === 'NSI') // Only Indian stocks
            .map(quote => ({
                symbol: quote.symbol,
                name: quote.longname || quote.shortname || quote.symbol
            }));
            
        return results;
    } catch (error) {
        console.error('Error searching stocks:', error);
        return baseStockSymbols.filter(stock => 
            stock.name.toLowerCase().includes(query.toLowerCase()) || 
            stock.symbol.toLowerCase().includes(query.toLowerCase())
        );
    }
}
