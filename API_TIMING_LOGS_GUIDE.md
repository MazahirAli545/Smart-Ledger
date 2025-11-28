# API Timing Logs Guide - AddPartyScreen

## ⚠️ Important: When Logs Appear

**The timing logs will ONLY appear when you actually SUBMIT the form** (click "ADD CUSTOMER" or "ADD SUPPLIER" button).

The logs you're seeing now are just navigation and UI logs. The API timing logs will show up when you:

1. Fill in the form (Party Name, Phone, Address, etc.)
2. Click the "ADD CUSTOMER" or "ADD SUPPLIER" button
3. The form submits and makes POST API calls

---

## 📊 What You'll See When You Submit

### Console Group Structure

The logs are now organized in **console groups** for better visibility:

```
🚀 [API] AddPartyScreen - Starting Party Creation/Update
  🔍 [TIMING] Starting party creation/update process at 2025-01-XX...
  ⏱️ [TIMING] Form validation took 5 ms
  ✅ Form validation passed
  ⏱️ [TIMING] Transaction limit check took 200 ms

  📤 [API] Creating Party - POST /customers
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    📤 [API CALL] POST /customers
    ⏱️ [TIMING] Starting at 2025-01-XX...
    📦 Payload size: 1234 bytes
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ✅ [API CALL] POST /customers COMPLETED
    ⏱️ [TIMING] Duration: 1234 ms ✅ OK
    📊 [PERF] Create customer API call duration: 1234 ms
    📥 Response status: 201

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    📤 [API CALL] PATCH /customers/123
    ⏱️ [TIMING] Starting at 2025-01-XX...
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ✅ [API CALL] PATCH update COMPLETED
    ⏱️ [TIMING] Duration: 300 ms ✅ OK

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 [PERF SUMMARY]
  ⏱️ [TIMING] Total operation duration: 2345 ms
  ✅ [PERF] Operation completed within acceptable time
  ✅ [SUCCESS] Party operation completed successfully
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔍 How to Identify Slow API Calls

### Look for These Markers:

1. **⚠️ SLOW!** - Appears if API call takes > 2000ms

   ```
   ⏱️ [TIMING] Duration: 5000 ms ⚠️ SLOW!
   ```

2. **Performance Warnings:**

   ```
   ⚠️ [WARNING] Operation took longer than 5 seconds!
   ⚠️ [WARNING] Operation took longer than 3 seconds
   ```

3. **Separator Lines** - Make API calls easy to spot:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📤 [API CALL] POST /customers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

---

## 📋 Expected Log Sequence

### When Creating a Party (No Opening Balance):

1. `🚀 [API] AddPartyScreen - Starting Party Creation/Update`
2. `⏱️ [TIMING] Form validation took X ms`
3. `⏱️ [TIMING] Transaction limit check took X ms`
4. `📤 [API] Creating Party - POST /customers`
5. `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
6. `📤 [API CALL] POST /customers`
7. `⏱️ [TIMING] Starting at...`
8. `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
9. `✅ [API CALL] POST /customers COMPLETED`
10. `⏱️ [TIMING] Duration: X ms`
11. `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
12. `📤 [API CALL] PATCH /customers/X`
13. `✅ [API CALL] PATCH update COMPLETED`
14. `📊 [PERF SUMMARY]`

### When Creating a Party WITH Opening Balance:

Same as above, PLUS:

- `📤 [API CALL] POST /transactions (Opening Balance Voucher)`
- `💰 Amount: X`
- `✅ [API CALL] POST /transactions COMPLETED`

---

## 🎯 What Each Log Means

| Log                                        | Meaning                                      |
| ------------------------------------------ | -------------------------------------------- |
| `📤 [API CALL]`                            | API request is starting                      |
| `✅ [API CALL] ... COMPLETED`              | API request finished successfully            |
| `❌ [API CALL] ... FAILED`                 | API request failed                           |
| `⏱️ [TIMING] Duration: X ms`               | How long the API call took                   |
| `⚠️ SLOW!`                                 | API call took > 2000ms (needs investigation) |
| `📊 [PERF SUMMARY]`                        | Overall performance summary                  |
| `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` | Visual separator for easy reading            |

---

## 🐛 Troubleshooting

### If you don't see any logs:

1. **Make sure you clicked the submit button** - Logs only appear on form submission
2. **Check console filters** - Make sure console isn't filtering out logs
3. **Check for errors** - If form validation fails, logs stop early

### If logs show "SLOW!":

1. **Check network connection** - Slow internet = slow API calls
2. **Check backend server** - Server might be overloaded
3. **Check payload size** - Large payloads take longer to send
4. **Check database** - Backend database queries might be slow

### If you see errors:

- Look for `❌ [API CALL] ... FAILED` logs
- Check the error message after the failure log
- Check network connectivity
- Verify backend server is running

---

## 📝 Quick Test

To see the logs immediately:

1. Open AddPartyScreen
2. Fill in:
   - Party Name: "Test Customer"
   - Phone: "1234567890"
   - Address: "Test Address"
3. Click "ADD CUSTOMER" button
4. **Watch the console** - You should see all the timing logs appear!

---

## 💡 Tips

- **Use console groups** - Click the group header to collapse/expand sections
- **Filter by `[API]` or `[TIMING]`** - Use console filter to see only API logs
- **Look for `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`** - These lines mark API calls
- **Check `📊 [PERF SUMMARY]`** - Shows total time at the end

---

## 🎯 Next Steps

After you see the logs:

1. **Identify the slowest operation** - Look for the highest duration
2. **Check if it's consistent** - Run the same operation multiple times
3. **Compare local vs live** - See if there's a difference
4. **Report findings** - Share the timing logs to identify bottlenecks
