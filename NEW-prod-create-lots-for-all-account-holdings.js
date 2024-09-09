const apiKey =
	''
const apiUrl = 'http://admin.api.internal.hedgecovest.local/api'
const accountId = process.argv.slice(2)[0]
const brokeradeId = process.argv.slice(2)[1]
let today = new Date();
let year = today.getFullYear();
let month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
let day = String(today.getDate()).padStart(2, '0');

let date = `${year}-${month}-${day}`;
let lotsFile = `lots-${date}.sql`

const readline = require('readline');
const fs = require('fs');

// gains, losses, both
let priceLogic = 'both'

// Create interface for reading input from the user
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
	const account = await getAccount()
	console.log('Account:', account.brokerageAccountNumber)
	lotsFile = `lots-${account.brokerageAccountNumber}-${date}.sql`
	fs.unlink(lotsFile, (err) => {
		if (err) {
			console.error('Error deleting file:', err);
			return;
		}
		console.log('File deleted successfully');
		});
	const holdings = await getHoldings()
	// const actList = await getActivities()
	const actList = []
	let totalGain = 0
	let totalLoss = 0
	let rows = []
	holdings.forEach(async holding => {
		// try to find the activity for the holding
		const acts = actList
			.filter(a => a.symbolAliasId == holding.symbolAliasId)
			.sort((a, b) => b.createdOn - a.createdOn)
		let sharePrices = []
		acts.forEach(act => {
			if (act.activityCode === 'buy') {
				for (let index = 0; index < act.quantity; index++) {
					sharePrices.push(act.price)
					
				}
			}
		})
		
		const lotQtys = getLotQtys(holding.quantity)
		if (lotQtys.length === 0) return
	
		lotQtys.forEach(async lotQty => {
			let randomPrice = getRandom(holding.price)
			if (sharePrices.length > 0) {
				randomPrice = sharePrices[0]
				sharePrices.splice(0, lotQty)
			}
			const date = createVSPDate()

			if (randomPrice > holding.price) {
				const loss = (randomPrice - holding.price) * lotQty
				totalLoss -= loss
			} else {
				const gain = (holding.price - randomPrice ) * lotQty
				totalGain += gain
			}

			rows.push({
				ticker: holding.ticker, 
				lotQty: lotQty, 
				originalPrice: holding.price,
				randomPrice: randomPrice, 
				date: `${date.date} 01:00:00.000`,
				symbolAliasId: holding.symbolAliasId,
				daysHeld: date.daysHeld,
				isLongTerm: date.isLongTerm,
			})

			console.log(
				holding.ticker,
				holding.price,
				randomPrice,
				randomPrice > holding.price ? `⬆️  LOSS ${lotQty}` : `⬇️  GAIN ${lotQty}`,
				` ${date} 01:00:00.000`
			)
		})
	})
	console.log('Total Gain:', totalGain)
	console.log('Total Loss:', totalLoss)
	console.log('Account:', account.brokerageAccountNumber)
	let finalQuery = `INSERT INTO SMArtXPortfolioManagement.dbo.AccountLotTradeOpen
	(Id, ParsedDataId, ParsedFileId, AccountId, BrokerageId, PositionDate, Symbol, SymbolAliasId, Quantity, OpenDate, DaysHeld, LongTerm, CostBasis, CostBasisPerShare, UnknownCostBasis, MarketValue, MarketPrice, UnrealizedGainLoss, VSPPrice, ReportSource, CreatedOn, CreatedBy, UpdatedOn, UpdatedBy, BrokerLotId)
	VALUES`
	for (let index = 0; index < rows.length; index++) {
		const element = rows[index];
		const insert = await createLots(element)
		finalQuery += insert
	}
	finalQuery = finalQuery.slice(0, -1)
	fs.writeFileSync(lotsFile, finalQuery)
	

	rl.close();
}

function getRandom(originalNumber) {
	const range = originalNumber * 0.05

	// Get the minimum and maximum bounds

	if (priceLogic === 'gains') {
		const min = originalNumber - range
		const max = (originalNumber - (originalNumber * 0.8))
		return Math.random() * (max - min) + min
	}
	if (priceLogic === 'losses') {
		const min = originalNumber
		const max = originalNumber + range
		return Math.random() * (max - min) + min
	}
	if (priceLogic === 'both') {
		const min = originalNumber - range
		const max = originalNumber + 1
		return Math.random() * (max - min) + min
	}
}

function createVSPDate() {

	// Get today's date
	const today = new Date();

	// Calculate the range for past dates
	const maxDaysAgo = 385;
	const minDaysAgo = 1;

	// Generate a random number of days ago within the range
	const randomDaysAgo = Math.floor(Math.random() * (maxDaysAgo - minDaysAgo + 1)) + minDaysAgo;

	// Create a new Date object based on today's date
	const randomPastDate = new Date(today);

	// Subtract the random number of days from today's date
	randomPastDate.setDate(today.getDate() - randomDaysAgo);

	// Convert the date to a readable string
	const formattedPastDate = randomPastDate.toISOString().split('T')[0]; // YYYY-MM-DD format

	return {
		date: formattedPastDate,
		daysHeld: randomDaysAgo,
		isLongTerm: randomDaysAgo > 365
	};
}

async function createLots(row) {
	let query = `INSERT INTO SMArtXPortfolioManagement.dbo.AccountLotTradeOpen
	(Id, ParsedDataId, ParsedFileId, AccountId, BrokerageId, PositionDate, Symbol, SymbolAliasId, Quantity, OpenDate, DaysHeld, LongTerm, CostBasis, CostBasisPerShare, UnknownCostBasis, MarketValue, MarketPrice, UnrealizedGainLoss, VSPPrice, ReportSource, CreatedOn, CreatedBy, UpdatedOn, UpdatedBy, BrokerLotId)
	VALUES(newid(), '', '', '', '', '', '', '', 0, '', 0, 0, 0, 0, 0, 0, 0, 0, 0, '', getdate(), suser_sname(), '', '', '');`
	const ID = 'newid()'
	const PARSEDDATAID = 'newid()'
	const PARSEDFILEID = 'newid()'
	const costBasis = row.lotQty * row.randomPrice
	const costBasisPerShare = row.randomPrice
	const unknownCostBasis = 0
	const marketValue = row.lotQty * row.originalPrice
	const marketPrice = row.originalPrice
	const unrealizedGainLoss = (row.originalPrice - row.randomPrice) * row.lotQty
	const vspPrice = row.randomPrice
	const reportSource = 'AT.Demo.Data'
	const CREATEDON = 'getdate()'
	const createdBy = 'AT.TestData.2024.06.25'

	let newQuery = `(${ID}, ${PARSEDDATAID}, ${PARSEDFILEID}, '${accountId}', '${brokeradeId}', CONCAT( cast( getdate() as date),' 00:00:00.000'), '${row.ticker}', '${row.symbolAliasId}', ${row.lotQty}, '${row.date}', ${row.daysHeld}, ${row.isLongTerm ? '1' : '0'}, ${costBasis}, ${costBasisPerShare}, ${unknownCostBasis}, ${marketValue}, ${marketPrice}, ${unrealizedGainLoss}, ${vspPrice}, '${reportSource}', ${CREATEDON}, '${createdBy}', null, null, null),`

	return newQuery
}

function createGUID() {
    // Helper function to generate random hex digits
    function randomHexDigit() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    // Create the UUID with the format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // where '4' indicates the UUID version and 'y' can be 8, 9, A, or B
    const guid = (
        randomHexDigit() + randomHexDigit() + '-' +
        randomHexDigit() + '-' +
        '4' + randomHexDigit().substr(0, 3) + '-' +
        randomHexDigit().substr(0, 2) + (Math.floor(Math.random() * 4) + 8).toString(16) + randomHexDigit().substr(3, 3) + '-' +
        randomHexDigit() + randomHexDigit() + randomHexDigit()
    ).toLowerCase();

    return guid;
}

async function getHoldings() {
	const url = `${apiUrl}/v1/Allocations/holdings?accountId=${accountId}`
	const holdingRes = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	})

	const holdingData = await holdingRes.json()

	let holdings = []
	holdingData.data.forEach(sleeve => {
		sleeve.positions.forEach(position => {
			holdings.push(position)
		})
	})

	return holdings
}

async function getActivities() {
	const url = `http://admin.api.internal.hedgecovest.local/api/v1/TradeActivities/accounts?beginDate=2024-07-24+00:00:00&id=${accountId}`
	const holdingRes = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	})

	const holdingData = await holdingRes.json()
	return holdingData.data
}

async function getAccount() {
	const url = `http://admin.api.internal.hedgecovest.local/api/v1/Accounts/${accountId}`
	const holdingRes = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	})

	const holdingData = await holdingRes.json()
	return holdingData.data
}

function getLotQtys(target) {
	// Ensure the target is a positive integer
	if (target <= 0) {
		//throw new Error('Target must be a positive integer.')
		return []
	}

	const result = []
	let remaining = target

	while (remaining > 0) {
		if (remaining === 1) {
			// If only one remains, add it and break
			result.push(1)
			break
		}

		// Generate a random number between 1 and remaining - 1
		const randomValue = Math.floor(Math.random() * (remaining - 1)) + 1

		result.push(randomValue)
		remaining -= randomValue
		// result.push(remaining)
		// remaining -= remaining
	}

	return result
}

main()
