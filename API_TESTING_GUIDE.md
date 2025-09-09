# 🧪 API Testing Guide

## Overview

This guide will help you test all the fixed API endpoints to ensure they're working correctly.

## ✅ **What Was Fixed**

1. **CustomerScreen.tsx**: Changed `/customer` → `/customers` ✅
2. **AddPartyScreen.tsx**: Changed all `/customer/*` → `/customers/*` ✅
3. **Backend**: Kept as `/customers` (correct) ✅
4. **Added health check endpoint**: `/health` ✅

## 🚀 **Testing Steps**

### **Step 1: Test Backend Health**

```bash
# From your terminal, test if backend is running
curl http://192.168.57.107:5000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-01-XX...",
  "uptime": 123.45,
  "environment": "development"
}
```

### **Step 2: Test from React Native App**

1. **Open your React Native app**
2. **Navigate to CustomerScreen**
3. **Tap the test tube icon (🧪) in the header**
4. **Check console logs for test results**

### **Step 3: Test from Terminal (Advanced)**

```bash
# Navigate to UtilsApp directory
cd UtilsApp

# Install dependencies if needed
npm install axios

# Update the test token in test-api-endpoints.js
# Replace 'your_test_token_here' with actual JWT token

# Run the test script
node test-api-endpoints.js
```

## 🔍 **What to Look For**

### **Successful Tests Should Show:**

```
✅ GET /customers - PASSED
   Status: 200
   Response: [customer data...]

✅ POST /customers/add-info - PASSED
   Status: 201
   Response: { message: "Customer created successfully" }
```

### **Failed Tests Will Show:**

```
❌ GET /customers - FAILED
   Status: 404
   Error: Cannot GET /customer
```

## 🐛 **Common Issues & Solutions**

### **Issue 1: 404 Not Found**

- **Cause**: Endpoint mismatch
- **Solution**: Ensure frontend uses `/customers` (plural)

### **Issue 2: 401 Unauthorized**

- **Cause**: Invalid or missing JWT token
- **Solution**: Check if user is logged in and token is valid

### **Issue 3: 500 Internal Server Error**

- **Cause**: Backend server error
- **Solution**: Check backend logs and restart server

### **Issue 4: Network Error**

- **Cause**: Backend not running or wrong IP
- **Solution**: Verify backend is running on correct IP/port

## 📱 **Testing in React Native App**

### **CustomerScreen Testing:**

1. Open CustomerScreen
2. Tap test tube icon (🧪)
3. Check console logs
4. Verify customer list loads

### **AddPartyScreen Testing:**

1. Navigate to AddPartyScreen
2. Fill out form
3. Submit
4. Check if redirects to CustomerScreen
5. Verify new customer appears in list

## 🔧 **Manual API Testing with Postman/Insomnia**

### **GET /customers**

```
Method: GET
URL: http://192.168.57.107:5000/customers
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json
```

### **POST /customers/add-info**

```
Method: POST
URL: http://192.168.57.107:5000/customers/add-info
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json
Body:
{
  "userId": 1,
  "partyName": "Test Customer",
  "phoneNumber": "+91-9876543210",
  "openingBalance": 1000,
  "partyType": "customer",
  "gstNumber": null,
  "address": "Test Address",
  "voucherType": "payment"
}
```

## 📊 **Expected Test Results**

When all tests pass, you should see:

```
🚀 Starting API Endpoints Test from React Native App
==================================================
Base URL: http://192.168.57.107:5000

🧪 Testing GET /customers...
✅ GET /customers successful: 200

🧪 Testing POST /customers/add-info...
✅ POST /customers/add-info successful: 201

📊 Test Summary
================
Total Tests: 2
Passed: 2 ✅
Failed: 0 ❌
Success Rate: 100.0%

🎉 All tests passed! Your API endpoints are working correctly.
```

## 🚨 **If Tests Fail**

1. **Check backend is running**: `http://192.168.57.107:5000/health`
2. **Verify JWT token**: Check if user is logged in
3. **Check network**: Ensure device can reach backend IP
4. **Review console logs**: Look for specific error messages
5. **Restart backend**: Sometimes fixes temporary issues

## 🎯 **Success Criteria**

✅ **All API calls use `/customers` endpoints**  
✅ **CustomerScreen loads customer data**  
✅ **AddPartyScreen creates new customers**  
✅ **Edit mode updates existing customers**  
✅ **Delete mode removes customers**  
✅ **No 404 errors in console**  
✅ **Test button shows all tests passed**

## 🔄 **After Testing**

Once all tests pass:

1. **Remove test button** (optional)
2. **Test real user flows**
3. **Verify data persistence**
4. **Check error handling**

---

**Need Help?** Check the console logs for detailed error messages and ensure your backend is running on the correct IP address.
