const apiKey = ''
const accountId = process.argv[2]
const shouldRun = process.argv.includes('--run')
const date = new Date().toISOString().split('T')[0]  // YYYY-MM-DD format

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

async function getAPMSleeveId() {
    const url = `http://admin-api.qa.smartx.us/api/v1/Allocations?accountIds=${accountId}`
    const allocationsRes = await fetch(url, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    })
    const allocations = await allocationsRes.json()
    
    // Create a map of all sleeves with their details
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

async function getAllHoldings() {
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

function generateTransfers() {
    const transfers = []
    const apmSleeveInfo = global.sleeveMap.get(global.apmSleeveId)
    global.holdings.forEach(sleeveHolding => {
        const sleeveInfo = global.sleeveMap.get(sleeveHolding.sleeveId)
        if (sleeveHolding.sleeveId === global.apmSleeveId || sleeveInfo.type === 'managedPortfolio') {
            return
        }
        sleeveHolding.holdings.forEach(holding => {
            if (holding.quantity > 0) {
                transfers.push({
                    sourceSleeve: {
                        id: sleeveHolding.sleeveId,
                        name: sleeveInfo.name,
                        type: sleeveInfo.type
                    },
                    destinationSleeve: {
                        id: global.apmSleeveId,
                        name: apmSleeveInfo.name,
                        type: apmSleeveInfo.type
                    },
                    ticker: holding.ticker,
                    quantity: holding.quantity,
                    symbolAliasId: holding.symbolAliasId
                })
            }
        })
    })
    return transfers
}

async function executeTransfer(transfer) {
    try {
        const sellTradeStatus = await addTrade(
            transfer.sourceSleeve.id,
            -transfer.quantity,
            transfer.symbolAliasId,
            transfer.ticker,
            false
        )
        if (sellTradeStatus !== 200) {
            console.error(`Failed to execute sell trade for ${transfer.ticker} from sleeve ${transfer.sourceSleeve.id}`)
            return false
        }
        const buyTradeStatus = await addTrade(
            transfer.destinationSleeve.id,
            transfer.quantity,
            transfer.symbolAliasId,
            transfer.ticker,
            false
        )
        if (buyTradeStatus !== 200) {
            console.error(`Failed to execute buy trade for ${transfer.ticker} to sleeve ${transfer.destinationSleeve.id}`)
            return false
        }
        return true
    } catch (error) {
        console.error('Error executing transfer:', error)
        return false
    }
}

async function executeAllTransfers(transfers) {
    console.log('\nExecuting transfers...')
    let successCount = 0
    let failureCount = 0
    for (const transfer of transfers) {
        console.log(`\nProcessing transfer for ${transfer.ticker}:`)
        console.log(`  From: ${transfer.sourceSleeve.id} (${transfer.sourceSleeve.type})`)
        console.log(`  To: ${transfer.destinationSleeve.id} (${transfer.destinationSleeve.type})`)
        console.log(`  Quantity: ${transfer.quantity}`)
        const success = await executeTransfer(transfer)
        if (success) {
            successCount++
        } else {
            failureCount++
        }
    }
    console.log('\nTransfer Summary:')
    console.log(`  Successful transfers: ${successCount}`)
    console.log(`  Failed transfers: ${failureCount}`)
    console.log(`  Total transfers attempted: ${transfers.length}`)
}

async function main() {
    try {
        if (!accountId) {
            console.error('Please provide an account ID as the first argument')
            process.exit(1)
        }
        const apmSleeveId = await getAPMSleeveId()
        console.log('APM Sleeve ID:', apmSleeveId)
        const { holdings } = await getAllHoldings()
        console.log('All Sleeves:', Object.fromEntries(global.sleeveMap))
        global.apmSleeveId = apmSleeveId
        global.holdings = holdings
        const transfers = generateTransfers()
        console.log('\nProposed Transfers:')
        transfers.forEach(transfer => {
            console.log(`\nTransfer ${transfer.ticker}:`)
            console.log(`  From: ${transfer.sourceSleeve.id} (${transfer.sourceSleeve.type})`)
            console.log(`  To: ${transfer.destinationSleeve.id} (${transfer.destinationSleeve.type})`)
            console.log(`  Quantity: ${transfer.quantity}`)
        })
        console.log(`\nTotal transfers to process: ${transfers.length}`)
        if (!shouldRun) {
            console.log('\n⚠️  SAFETY CHECK: No transfers were executed.')
            console.log('To execute these transfers, run the script with the --run flag:')
            console.log(`node ${process.argv[1]} ${accountId} --run`)
            process.exit(0)
        }
        await executeAllTransfers(transfers)
    } catch (error) {
        console.error('Error:', error)
    }
}

main()
