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