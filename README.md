# tax-lot-scripts
Collection of scripts to expedite specific account actions to assist Advisory Tools

> **Warning**
> To make sure all the node deps are setup make sure to run ```npm i``` in the root of this repo

> **Warning**
> All scripts will need a valid **QA Admin API** access token. Replace the ```apiKey``` variable at the top of each script before use. 

## Remove all account Holdings

```
node .\remove-account-holdings.js {accountId}
```

## Add holdings to APM
- creates random holdings from list
- creates random holding quantities
  - Holding quantities can be adjusted at top of the file

```
node .\add-holdings-to-apm.js {accountId}
```

## Add tax lots to QA accounts
- This script adds tax lots to all the holdings for a specific QA account.
- ```priceLogic``` can be adjusted so lots are created with all gains, all losses, or both gains and losses
  - if both is selected in order to show multiple tax scenarios lots are created with a bias on gains

```
node .\create-lots-for-all-account-holdings.js {accountId}
```

## Add tax lots to Production accounts
> **Warning**
> The script requires a valid **PROD Admin API** access token.


- This script will create a local ```.sql``` file that contains an insert statement to add lots. This script will need to be ran in the ```SmartXPortfolioManagement``` database   


```
node .\NEW-prod-create-lots-for-all-account-holdings.js {accountId} {brokeradeId}
```

## Specific QA account scripts
- located in the specific qa account scripts folder
- creates lots based off input csv
- creates lots, and holdings at the same time
  - Because of this the remove account holdings script must be ran first to avoid duplicates

```
node .\remove-account-holdings.js 43b458a1-195e-4c3c-9631-56c9a00f90a5
node .\add-holdings-to-AT-TEST-568.js

node .\remove-account-holdings.js 5ceb26d8-3f9e-4124-8cfe-62b912d5055b
node .\add-holdings-to-AT-TEST-567.js

node .\remove-account-holdings.js c6762bef-a87f-4ef0-a4b1-5384250eef5c
node .\add-holdings-to-AT-TEST-562.js
```

## Move All Holdings to APM

The `move-all-holdings-to-apm.js` script is a utility tool that moves all holdings from various sleeves in an account to the Active Portfolio Management (APM) sleeve. This is useful when consolidating holdings or restructuring account allocations.

### Features

- Automatically identifies the APM sleeve in the account
- Scans all sleeves for current holdings
- Generates a list of transfers needed to move holdings to the APM sleeve
- Includes a safety check to preview transfers before execution
- Provides detailed logging of transfer operations
- Handles both buy and sell trades to properly transfer positions

### Prerequisites

- Node.js installed
- Valid API key for the SmartX admin API
- Account ID for the target account

### Usage

1. Add your API key to the script:
   ```javascript
   const apiKey = 'your-api-key-here'
   ```

2. Run the script with an account ID:
   ```bash
   node move-all-holdings-to-apm.js <account-id>
   ```

3. To execute the transfers (after reviewing the proposed changes), add the `--run` flag:
   ```bash
   node move-all-holdings-to-apm.js <account-id> --run
   ```

### Safety Features

- The script runs in "preview mode" by default, showing all proposed transfers without executing them
- The `--run` flag must be explicitly provided to execute transfers
- Each transfer is logged with detailed information about source and destination sleeves
- A summary of successful and failed transfers is provided at the end of execution


### Notes

- The script uses the QA environment (`admin-api.qa.smartx.us`)
- All trades are executed with zero commission
- Only positions with positive quantities are transferred
- Managed portfolio sleeves are skipped during transfer generation

## Sync Account Holdings

The `sync-account-holdings.js` script is a utility tool that compares account-level holdings with sleeve-level holdings and helps identify and resolve discrepancies. This is useful for ensuring data consistency between account and sleeve positions.

### Features

- Compares account-level holdings with aggregated sleeve holdings
- Identifies discrepancies in position quantities
- Provides detailed breakdown of holdings across all sleeves
- Shows aggregated holdings across sleeves with market values
- Can automatically add missing positions to the APM sleeve
- Includes safety checks to preview changes before execution

### Prerequisites

- Node.js installed
- Valid API key for the SmartX admin API
- Account ID for the target account
- `decimal.js` package installed (`npm install decimal.js`)

### Usage

1. Add your API key to the script:
   ```javascript
   const apiKey = 'your-api-key-here'
   ```

2. Run the script with an account ID:
   ```bash
   node sync-account-holdings.js <account-id>
   ```

3. To execute the trades to resolve discrepancies, add the `--run` flag:
   ```bash
   node sync-account-holdings.js <account-id> --run
   ```

### Safety Features

- Runs in "preview mode" by default
- Requires explicit `--run` flag to execute trades
- Only adds missing positions (doesn't remove excess positions)
- Provides detailed logging of all operations
- Uses decimal.js for precise quantity calculations

### Notes

- The script uses the QA environment (`admin-api.qa.smartx.us`)
- All trades are executed with zero commission
- Only positive quantity discrepancies are automatically resolved
- Uses the APM sleeve as the destination for missing positions