const apiKey =
	''
const accountId = process.argv.slice(2)[0]
const readline = require('readline');
let today = new Date();
let year = today.getFullYear();
let month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
let day = String(today.getDate()).padStart(2, '0');

let date = `${year}-${month}-${day}`;
const fs = require('fs');
let isLongTerm = false
let exportLots = false
let exportedLots = []

// gains, losses, both
let priceLogic = 'both'

// Create interface for reading input from the user
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function waitForKeyPress() {
    return new Promise((resolve, reject) => {
        rl.question('Press y to continue, or any other key to quit: ', (answer) => {
            if (answer.toUpperCase() === 'Y') {
                resolve();
            } else {
                reject();
            }
        });
    });
}

async function main() {
	const holdings = await getHoldings()
	let totalGain = 0
	let totalLoss = 0
	let rows = []
	holdings.forEach(async holding => {
		const lotQtys = getLotQtys(holding.quantity)
		if (lotQtys.length === 0) return
	
		lotQtys.forEach(async lotQty => {
			const randomPrice = getRandom(holding.price)
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
				randomPrice: randomPrice, 
				date: `${date} 01:00:00.000`
			})

			console.log(
				holding.ticker,
				holding.price,
				randomPrice,
				randomPrice > holding.price ? `⬆️  LOSS ${lotQty}` : `⬇️  GAIN ${lotQty}`,
				` ${date} 01:00:00.000`
			)
			// await createLots(holding.ticker, lotQty, randomPrice, `${date} 01:00:00.000`)
		})
	})
	console.log('Total Gain:', totalGain)
	console.log('Total Loss:', totalLoss)
	try {
        await waitForKeyPress();
        console.log('You pressed Y. Continuing...');
        rows.forEach(async row => {
			await createLots(row.ticker, row.lotQty, row.randomPrice, row.date)
		})

    } catch (error) {
		console.log(error)
        console.log('You pressed a key other than Y. Quitting...');
        process.exit(0);
    } finally {
        rl.close();
    }
	if (exportLots) {
		fs.writeFile(`lots_${accountId}.json`, JSON.stringify(exportedLots), (err) => {
			if (err) {
				console.log('Error writing file', err);
			} else {
				console.log('Successfully wrote file');
			}
		})
	}
}

function getRandom(originalNumber) {
	const range = originalNumber * 0.05

	// Get the minimum and maximum bounds

	if (priceLogic === 'gains') {
		const min = originalNumber - range
		const max = originalNumber
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
	isLongTerm = !isLongTerm

	// Get today's date
	const today = new Date()

	// Create a new Date object based on today's date
	const pastDate = new Date(today)

	if (isLongTerm) {
		pastDate.setDate(pastDate.getDate() - 385)
	} else {
		pastDate.setDate(pastDate.getDate() - 35)
	}

	// Convert the date to a readable string
	const formattedPastDate = pastDate.toISOString().split('T')[0] // YYYY-MM-DD format

	return formattedPastDate
}

async function createLots(ticker, quantity, price, date) {
	const url = `http://tax-lot-api.svc.qa.smartx.us/api/c4/v1/testsetup/lotsetupforaccount?username=nlemke`
	const postBody = JSON.stringify({
		accountId: accountId,
		ticker: ticker,
		lotInfo: [
			{
				quantity: quantity,
				vspPrice: price,
				vspDate: date,
			},
		],
	})
	//console.log(postBody)
	exportedLots.push(postBody)

	const lotRes = await fetch(url, {
		method: 'POST',
		body: postBody,
		headers: {
			username: 'nlemke',
			'Content-Type': 'application/json',
		},
	})
	console.log(lotRes?.status)
	if (`${lotRes?.status}` != '200') {
		console.log(lotRes)
	}
}

async function getHoldings() {
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
			holdings.push(position)
		})
	})

	return holdings
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
