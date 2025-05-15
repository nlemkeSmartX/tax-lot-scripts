const apiKey = ''
const Decimal = require('decimal.js')
const accountId = process.argv.slice(2)[0]
const shouldRun = process.argv.includes('--run')
const date = new Date().toISOString()

async function getAPMSleeveId() {
    const url = `http://admin-api.qa.smartx.us/api/v1/Allocations?accountIds=${accountId}`
    const allocationsRes = await fetch(url, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    })
    const allocations = await allocationsRes.json()
    const sleeveMap = new Map()
    allocations.data.forEach(sleeve => {
        sleeveMap.set(sleeve.id, {
            name: sleeve.model?.name || 'Unknown',
            type: sleeve.type,
            status: sleeve.status,
            tradingType: sleeve.tradingType,
            isApmAllocation: sleeve.isApmAllocation,
            modelId: sleeve.model?.id,
            accountId: sleeve.account?.id,
            accountName: sleeve.account?.name,
            brokerAccountNumber: sleeve.account?.brokerAccountNumber,
            brokerage: sleeve.account?.brokerage?.name
        })
    })
    global.sleeveMap = sleeveMap
    const apmSleeve = allocations.data.find(x => x.type === 'managedPortfolio')
    if (!apmSleeve) {
        throw new Error('No APM sleeve found for this account')
    }
    return apmSleeve.id
}

async function getAccountHoldings(accountId) {
    const url = `http://admin-api.qa.smartx.us/api/v1/Accounts/${accountId}/holdings`
    const holdingsRes = await fetch(url, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    })
    const holdings = await holdingsRes.json()
    if (!holdings.data || !holdings.data.holdings) {
        throw new Error('No holdings data found')
    }
    return holdings.data.holdings.map(holding => ({
        ticker: holding.symbol.ticker,
        symbolAliasId: holding.symbol.defaultSymbolAliasId,
        quantity: holding.quantity
    }))
}

async function getAllHoldingsPerSleeve() {
    const url = `http://admin-api.qa.smartx.us/api/v1/Allocations/holdings?accountId=${accountId}`
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    })
    const holdingsData = await response.json()
    const holdings = holdingsData.data.map(sleeve => {
        const sleeveInfo = global.sleeveMap.get(sleeve.ownerId) || {
            name: sleeve.model?.name || 'Unknown',
            type: 'unknown'
        }
        return {
            sleeveId: sleeve.ownerId,
            sleeveName: sleeveInfo.name,
            sleeveType: sleeveInfo.type,
            sleeveStatus: sleeveInfo.status,
            holdings: sleeve.positions.map(position => ({
                ticker: position.ticker,
                symbolAliasId: position.symbolAliasId,
                quantity: position.quantity,
                assetType: position.assetType,
                marketValue: position.marketValue
            }))
        }
    })
    return { holdings }
}

function aggregateHoldingsAcrossSleeves(sleeveHoldings) {
    const aggregatedHoldings = new Map()
    sleeveHoldings.forEach(sleeve => {
        sleeve.holdings.forEach(holding => {
            const key = `${holding.ticker}-${holding.symbolAliasId}`
            const existing = aggregatedHoldings.get(key) || {
                ticker: holding.ticker,
                symbolAliasId: holding.symbolAliasId,
                totalQuantity: 0,
                sleeves: []
            }
            existing.totalQuantity += holding.quantity
            existing.sleeves.push({
                sleeveName: sleeve.sleeveName,
                sleeveType: sleeve.sleeveType,
                quantity: holding.quantity,
                marketValue: holding.marketValue
            })
            aggregatedHoldings.set(key, existing)
        })
    })
    return Array.from(aggregatedHoldings.values())
        .sort((a, b) => a.ticker.localeCompare(b.ticker))
}

function compareHoldingsQuantities(accountHoldings, sleeveHoldings) {
    const accountHoldingsMap = new Map(
        accountHoldings.map(h => [`${h.ticker}-${h.symbolAliasId}`, new Decimal(h.quantity)])
    )
    const sleeveHoldingsMap = new Map()
    sleeveHoldings.forEach(sleeve => {
        sleeve.holdings.forEach(holding => {
            const key = `${holding.ticker}-${holding.symbolAliasId}`
            const currentTotal = sleeveHoldingsMap.get(key) || new Decimal(0)
            sleeveHoldingsMap.set(key, currentTotal.plus(new Decimal(holding.quantity)))
        })
    })
    const discrepancies = []
    accountHoldings.forEach(holding => {
        const key = `${holding.ticker}-${holding.symbolAliasId}`
        const sleeveTotal = sleeveHoldingsMap.get(key) || new Decimal(0)
        const accountQty = new Decimal(holding.quantity)
        const difference = accountQty.minus(sleeveTotal)
        if (!difference.isZero()) {
            discrepancies.push({
                ticker: holding.ticker,
                symbolAliasId: holding.symbolAliasId,
                accountQuantity: accountQty.toString(),
                sleeveTotal: sleeveTotal.toString(),
                difference: difference.toString()
            })
        }
    })
    sleeveHoldingsMap.forEach((quantity, key) => {
        if (!accountHoldingsMap.has(key)) {
            const [ticker, symbolAliasId] = key.split('-')
            discrepancies.push({
                ticker,
                symbolAliasId,
                accountQuantity: '0',
                sleeveTotal: quantity.toString(),
                difference: quantity.negated().toString()
            })
        }
    })
    return discrepancies
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
    console.log(`Trade status for ${ticker}: ${lotRes?.status}`)
    return lotRes?.status
}

async function main() {
    try {
        if (!accountId) {
            console.error('Please provide an account ID as the first argument')
            process.exit(1)
        }
        const apmSleeveId = await getAPMSleeveId()
        console.log('APM Sleeve ID:', apmSleeveId)
        const accountHoldings = await getAccountHoldings(accountId)
        console.log('\nAccount Holdings:')
        accountHoldings.forEach(holding => {
            console.log(`Ticker: ${holding.ticker}, SymbolAliasId: ${holding.symbolAliasId}, Quantity: ${holding.quantity}`)
        })
        const { holdings: sleeveHoldings } = await getAllHoldingsPerSleeve()
        console.log('\nHoldings Per Sleeve:')
        sleeveHoldings.forEach(sleeve => {
            console.log(`\nSleeve: ${sleeve.sleeveName} (${sleeve.sleeveType})`)
            sleeve.holdings.forEach(holding => {
                console.log(`  Ticker: ${holding.ticker}, SymbolAliasId: ${holding.symbolAliasId}, Quantity: ${holding.quantity}, Market Value: ${holding.marketValue}`)
            })
        })
        const aggregatedHoldings = aggregateHoldingsAcrossSleeves(sleeveHoldings)
        console.log('\nAggregated Holdings Across Sleeves:')
        aggregatedHoldings.forEach(holding => {
            console.log(`\n${holding.ticker} (${holding.symbolAliasId}) - Total Quantity: ${holding.totalQuantity}`)
            holding.sleeves.forEach(sleeve => {
                console.log(`  ${sleeve.sleeveName} (${sleeve.sleeveType}): ${sleeve.quantity} shares ($${sleeve.marketValue})`)
            })
        })
        const discrepancies = compareHoldingsQuantities(accountHoldings, sleeveHoldings)
        console.log('\nQuantity Discrepancies:')
        if (discrepancies.length === 0) {
            console.log('No discrepancies found - all quantities match!')
        } else {
            console.log('\nProcessing discrepancies...')
            for (const d of discrepancies) {
                console.log(`\n${d.ticker} (${d.symbolAliasId}):`)
                console.log(`  Account Quantity: ${d.accountQuantity}`)
                console.log(`  Sleeve Total: ${d.sleeveTotal}`)
                console.log(`  Difference: ${d.difference.startsWith('-') ? '' : '+'}${d.difference}`)
                if (!shouldRun) {
                    if (!d.difference.startsWith('-')) {
                        console.log(`\nWould add ${d.difference} shares of ${d.ticker} to APM sleeve (--run flag not provided)`)
                    }
                    continue
                }
                if (!d.difference.startsWith('-')) {
                    console.log(`\nAdding ${d.difference} shares of ${d.ticker} to APM sleeve...`)
                    const status = await addTrade(apmSleeveId, d.difference, d.symbolAliasId, d.ticker, false)
                    if (status === 200) {
                        console.log(`Successfully added ${d.difference} shares of ${d.ticker} to APM sleeve`)
                    } else {
                        console.error(`Failed to add shares of ${d.ticker} to APM sleeve. Status: ${status}`)
                    }
                }
            }
            if (!shouldRun) {
                console.log('\n⚠️  SAFETY CHECK: No trades were executed.')
                console.log('To execute these trades, run the script with the --run flag:')
                console.log(`node ${process.argv[1]} ${accountId} --run`)
            }
        }
    } catch (error) {
        console.error('Error:', error)
    }
}

main()
