# End-to-end smoke test

Proves the acceptance criterion: a transaction moves through deposit → hold → dispute → release
with no manual DB edits, and is visible to both the user and the admin. Runs against a local API
with `SIMULATE_PAYMENTS=true`. Uses the seeded accounts (`npm run prisma:seed`).

Set `API=http://localhost:4000/api`. Examples use `curl` + `jq`.

```bash
API=http://localhost:4000/api

# 1. Log in as buyer and seller (seeded)
BUYER=$(curl -s $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"buyer@safepay.test","password":"buyer12345"}' | jq -r .token)
ADMIN=$(curl -s $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@safepay.test","password":"admin12345"}' | jq -r .token)

# 2. Buyer creates an escrow (deposit → HELD) — try each method: MPESA, PAYPAL, VISA
TX=$(curl -s $API/transactions -H "Authorization: Bearer $BUYER" -H 'Content-Type: application/json' \
  -d '{"sellerEmail":"seller@safepay.test","description":"Test iPhone","amountCents":150000,"method":"MPESA"}')
TXID=$(echo "$TX" | jq -r .id)
echo "Status after deposit: $(echo "$TX" | jq -r .status)"   # expect HELD

# 3. Buyer opens a dispute (HELD → DISPUTED)
curl -s $API/disputes -H "Authorization: Bearer $BUYER" -H 'Content-Type: application/json' \
  -d "{\"transactionId\":\"$TXID\",\"reason\":\"Item not as described\"}" | jq .status

# 4. Admin sees it in the queue and rules RELEASE (DISPUTED → RELEASED)
DID=$(curl -s $API/disputes -H "Authorization: Bearer $ADMIN" | jq -r '.[0].id')
curl -s $API/disputes/$DID/rule -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"ruling":"RELEASE","adminNote":"Evidence favored seller"}' | jq .status

# 5. Verify final state + full timeline visible to the buyer
curl -s $API/transactions/$TXID -H "Authorization: Bearer $BUYER" \
  | jq '{status, events: [.events[].toStatus]}'
# expect: status RELEASED, events [CREATED, PAYMENT_PENDING, HELD, DISPUTED, RELEASED]

# 6. Admin overview reflects the movement
curl -s $API/admin/overview -H "Authorization: Bearer $ADMIN" | jq .
```

For the plain release path (no dispute), replace steps 3–4 with:

```bash
curl -s $API/transactions/$TXID/confirm-received -H "Authorization: Bearer $BUYER" | jq .status  # RELEASED
```

Repeat step 2 with `"method":"PAYPAL"` and `"method":"VISA"` to cover all three gateways.
