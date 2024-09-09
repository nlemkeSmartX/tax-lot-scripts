const apiKey =
	''
const apiUrl = 'http://admin-api.qa.smartx.us/api/'
const accountId = process.argv.slice(2)[0]
let today = new Date();
let year = today.getFullYear();
let month = String(today.getMonth() + 1).padStart(2, '0');
let day = String(today.getDate()).padStart(2, '0');

let date = `${year}-${month}-${day}`;

async function main() {
    const sleeveHoldings = await getSleeveHoldings()
	// console.log(sleeveHoldings)
    await removeSleeveHoldings(sleeveHoldings)
}

async function getHoldings() {
	const url = `http://admin-api.qa.smartx.us/api/v1/accounts/${accountId}/holdings`
	const holdingRes = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	})

	const holdings = await holdingRes.json()
	// console.log(holdings.items)
	return holdings.data.holdings
}

async function getTickerPrice(ticker) {
	const url = `http://oms-proxy-api.svc.qa.smartx.us/api/v1/Prices?symbols=${ticker}`
	const priceRes = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	})

	const price = await priceRes.json()
	// console.log(price)
	return price[0].price.close
}

async function getSleeveHoldings() {
	const url = `http://admin-api.qa.smartx.us/api/v1/Allocations/holdings?accountId=${accountId}`
	const holdingRes = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	})

	const holdingData = await holdingRes.json()

	let holdings = []
	holdingData.data.forEach(sleeve => {
		sleeve.positions.forEach(position => {
			position.sleeveId = sleeve.ownerId
			holdings.push(position)
		})
	})

	return holdings
}

async function removeSleeveHoldings(holdings) {
    holdings.forEach(async holding => {
		await addTrade(holding.quantity * -1, holding.symbolAliasId, holding.ticker)
        await addTrade(holding.quantity * -1, holding.symbolAliasId, holding.ticker, holding.sleeveId)
    })
}

async function addTrade(amount, symbolAliasId, ticker, sleeveId) {
	let url = `http://admin-api.qa.smartx.us/api/v1/TradeActivities/accounts`
    let ownerId = accountId
    if (sleeveId) {
        url = `http://admin-api.qa.smartx.us/api/v1/TradeActivities/allocations`
        ownerId = sleeveId
    }

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
	//console.log(postBody)

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
