const fs = require('fs');
const csv = require('csv-parser');

const apiKey =
	''
const accountId = '43b458a1-195e-4c3c-9631-56c9a00f90a5'
const today = new Date();
const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so add 1
const day = String(today.getDate()).padStart(2, '0');
const year = today.getFullYear();
const date = `${month}/${day}/${year}`;
let invalidHoldings = []


async function main() {
	const apmSleeveId = await getAPMSleeveId()
	const results = await parseCsv('AT-Test-568-holdings.csv')
	// console.log(results.length)
	let tasks = []
	for await (let row of results) {
		try
		{
			const symbolAliasId = await getSymbolAliasId(row.Symbol)
			const lotQty = parseFloat(row.Shares).toFixed(4)
			const price = parseFloat(row.CostBasis).toFixed(4)
			const date = convertDateString(row.PurchaseDate)
			// if (price == 'NaN')
			// {
			// 	console.log(
			// 		row.Symbol,
			// 		row.Shares,
			// 		price,
			// 		symbolAliasId,
			// 		row.PurchaseDate
			// 	)
			// }

			// console.log(
			// 	row.Symbol,
			// 	row.Shares,
			// 	price,
			// 	symbolAliasId,
			// 	row.PurchaseDate
			// )
			// tasks.push(addTrade(apmSleeveId, row.Shares, symbolAliasId, row.Symbol, false))
			// tasks.push(addTrade(accountId, row.Shares, symbolAliasId, row.Symbol, true))
			// tasks.push(createLots(row.Symbol, lotQty, price, date))

			tasks.push(create(apmSleeveId, lotQty, symbolAliasId, row.Symbol, price, date))
			// await addTrade(apmSleeveId, row.Shares, symbolAliasId, row.Symbol, false)
			// await addTrade(accountId, row.Shares, symbolAliasId, row.Symbol, true)
			// await createLots(row.Symbol, lotQty, price, date)
		}
		catch {}
	}
	
	await Promise.all(tasks)
	console.log(invalidHoldings)
}

async function create(apmSleeveId, lotQty, symbolAliasId, ticker, price, date) {
	await addTrade(apmSleeveId, lotQty, symbolAliasId, ticker, false)
	await addTrade(accountId, lotQty, symbolAliasId, ticker, true)
	await createLots(ticker, lotQty, price, date)
}

async function parseCsv(filePath) {
	const results = [];
  
	return new Promise((resolve, reject) => {
	  fs.createReadStream(filePath)
		.pipe(csv())
		.on('data', (data) => results.push(data))
		.on('end', () => resolve(results))
		.on('error', (error) => reject(error));
	});
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

async function getSymbolAliasId(ticker) {
	const url = `http://admin-api.qa.smartx.us/api/v1/Symbols/alias?alias=${ticker}`
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	})
	const json = await response.json()
	const equityMatch = json.data.find(x => x.assetType.toLowerCase() == 'equity')
	if (equityMatch) return equityMatch.id

	const mutualFundMatch = json.data.find(x => x.assetType.toLowerCase() == 'mutualfund')
	if (mutualFundMatch) return mutualFundMatch.id

	invalidHoldings.push(ticker)
	// throw new Error(`invalid holding for ${ticker}`)
}

function convertDateString(dateStr) {
    // Split the input date string by '/'
    const [month, day, year] = dateStr.split('/');

    // Create a new Date object
    const date = new Date(year, month - 1, day);

    // Format the date to YYYY-MM-DD
    const formattedDate = date.toISOString().split('T')[0];

    return formattedDate;
}

async function addTrade(ownerId, amount, symbolAliasId, ticker, isAccount, purchaseDate) {
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
	if (`${lotRes?.status}` != '200') {
		invalidHoldings.push(ticker)
		console.log(await lotRes.text())
		console.log(postBody)
	}
}

async function createLots(ticker, quantity, price, date) {
	const url = `http://tax-lot-api.svc.qa.smartx.us/api/c4/v1/testsetup/lotsetupforaccount?username=nlemke&overridewarnings=true`
	const postBody = JSON.stringify({
		accountId: accountId,
		ticker: ticker,
		lotInfo: [
			{
				quantity: quantity,
				vspPrice: price.replace(/,/g, ''),
				vspDate: date,
			},
		],
	})

	const lotRes = await fetch(url, {
		method: 'POST',
		body: postBody,
		headers: {
			username: 'nlemke',
			'Content-Type': 'application/json',
		},
	})
	const lotText = await lotRes.text()
	console.log(`lots ${lotRes?.status} ${lotText}`)
	
	if (`${lotRes?.status}` != '200') {
		console.log(lotRes)
		console.log(postBody)
	}

	if (!lotText.includes('Inserted 1 Lot Entities + 1 Position Entity')) {
		invalidHoldings.push(ticker)
	}
}

main()
