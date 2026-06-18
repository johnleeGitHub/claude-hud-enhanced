---
description: Update third-party model pricing table from remote source
allowed-tools: Bash, Read, Edit, Write
---

# Update Pricing

Updates the third-party model pricing table by fetching the latest prices.

## Steps

### 1. Read config and fetch URL
```bash
HUDP="$HOME/.claude/plugins/claude-hud-enhanced"
UPDATE_URL=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HUDP/config.json','utf8'));console.log(c.modelPricing?.pricingUpdateUrl||'https://raw.githubusercontent.com/linuxdeepin/claude-hud-enhanced/main/pricing.json')")
echo "Fetching from: $UPDATE_URL"
```

### 2. Fetch and save
```bash
node -e "
import('$HUDP/dist/update-pricing.js').then(async m=>{
  const d=await m.fetchPricing('$UPDATE_URL');
  if(!m.validatePricingResponse(d)){console.error('ERROR: invalid pricing');process.exit(1)}
  m.writePricingFile('$HUDP/pricing.json',d);
  const c=JSON.parse(require('fs').readFileSync('$HUDP/config.json','utf8'));
  c.modelPricing=(c.modelPricing||{});c.modelPricing.pricingUpdatedAt=new Date().toISOString();
  require('fs').writeFileSync('$HUDP/config.json',JSON.stringify(c,null,2)+'\n');
  console.log('OK: '+d.entries.length+' entries updated')
}).catch(e=>{console.error(e.message);process.exit(1)})
```
