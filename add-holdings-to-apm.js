const apiKey =
	''

const minTickers = 15;
const maxTickers = 25;
const apiUrl = 'http://admin-api.qa.smartx.us/api/'
const accountId = process.argv.slice(2)[0]
const today = new Date();
const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so add 1
const day = String(today.getDate()).padStart(2, '0');
const year = today.getFullYear();
const date = `${month}/${day}/${year}`;
let tickers = [
'AAPL', 'MSFT', 'NVDA', 'AMZN', 'ORCL', 'IBM',
'GOOGL', 'META', 'TSLA', 'ADBE', 'INTC', 'CSCO',
'AMD', 'CRM', 'QCOM', 'TXN', 'NFLX', 'AVGO',
'NOW', 'SHOP', 'ZM', 'SNOW', 'DOCU', 'TWLO',
'PANW', 'PLTR', 'SPOT', 'UBER', 'SQ', 'PYPL',
'ASML', 'NXPI', 'AMD', 'MU', 'LRCX', 'WDAY',
'TEAM', 'FTNT', 'ZS', 'OKTA', 'NET',
'CRWD', 'MDB', 'DDOG', 'RBLX', 'FSLY', 'HUBS',
'S', 'ESTC', 'CHWY', 'ROKU', 'U',
'DIS', 'V', 'MA', 'JPM', 'JNJ', 'PFE', 'T', 'VZ', 
'PG', 'KO', 'PEP', 'XOM', 'CVX', 'BABA', 'NKE', 
'HD', 'MCD', 'WMT', 'BA', 'MMM', 'GE', 'GM', 'F', 
'CAT', 'DE', 'HON', 'UPS', 'FDX', 'UNH', 'MRK', 
'ABBV', 'LLY', 'ABT', 'MDT', 'SYK', 'ISRG', 'TMO', 
'DHR', 'GILD', 'AMGN', 'VRTX', 'CL', 'CVS', 'COST', 
'TGT', 'LOW', 'BKNG', 'EBAY', 'SBUX', 'MS', 'GS', 
'BLK', 'AIG', 'MET', 'LMT', 'NOC'
]

async function main() {
	console.log(accountId)
	const apmSleeveId = await getAPMSleeveId()
	const randomTickers = getRandomTickers()
	for await (let ticker of randomTickers) {
		const symbolAliasId = await getSymbolAliasId(ticker, 'equity')
        const qty = getRandomInt(75, 200)
		console.log(
            ticker,
            qty,
            symbolAliasId
        )
		await addTrade(apmSleeveId, qty, symbolAliasId, ticker, false)
        await addTrade(accountId, qty, symbolAliasId, ticker, true)
	}
}
function getRandomTickers() {
    const numTickersToSelect = Math.floor(Math.random() * (maxTickers - minTickers + 1)) + minTickers;

    const shuffledTickers = tickers.sort(() => 0.5 - Math.random());
    return shuffledTickers.slice(0, numTickersToSelect);
}

async function getAPMSleeveId() {
	const url = `http://admin-api.qa.smartx.us/api/v1/Allocations?accountIds=${accountId}`
	const allocationsRes = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	})

	const allocations = await allocationsRes.json()
	return allocations.data.find(x => x.type == 'managedPortfolio').id
}

async function getSymbolAliasId(ticker, assetType) {
	const url = `http://admin-api.qa.smartx.us/api/v1/Symbols/alias?alias=${ticker}`
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	})
	const json = await response.json()
	const match = json.data.find(x => x.assetType.toLowerCase() == assetType.toLowerCase())
	return match.id
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

async function addTrade(ownerId, amount, symbolAliasId, ticker, isAccount) {
	let url = `http://admin-api.qa.smartx.us/api/v1/TradeActivities/allocations`
	if (isAccount) url = `http://admin-api.qa.smartx.us/api/v1/TradeActivities/accounts`

	const postBody = JSON.stringify({
		ownerId: ownerId,
		activityTimestamp: date,
		activityCode: 'buy',
		ticker: ticker,
		symbolAliasId: symbolAliasId,
		quantity: `${amount}`,
		multiplier: 1,
		commission: '0',
	})
    const lotRes = await fetch(url, {
		method: 'POST',
		body: postBody,
		headers: {
			Authorization: 'Bearer ' + apiKey,
			'Content-Type': 'application/json',
		},
	})
	console.log(lotRes?.status)
}

main()
