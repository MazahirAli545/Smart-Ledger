# Razorpay Integration Troubleshooting Guide

## 🔍 **Common Issues & Solutions**

### **1. "Something went wrong" Error**

**Symptoms:**

- Generic error message from Razorpay
- Payment modal opens but fails silently
- No specific error details

**Root Causes:**

- API key mismatch between frontend and backend
- Network connectivity issues
- Backend service unavailable
- Invalid order data

**Solutions:**

1. **Verify API Keys:**

   - Frontend: `rzp_test_R7rnkgNnXtBN0W`
   - Backend: `rzp_test_R7rnkgNnXtBN0W`
   - Ensure both match exactly

2. **Check Network:**

   - Test local backend: `http://192.168.57.107:5000/health`
   - Test production: `https://utility-apis-49wa.onrender.com/health`
   - Use network fallback if local fails

3. **Validate Order Data:**
   - Check user authentication
   - Verify plan details
   - Ensure amount calculation is correct

### **2. Network Connectivity Issues**

**Symptoms:**

- "Network error" messages
- Timeout errors
- Cannot reach backend

**Solutions:**

1. **Local Development:**

   - Ensure backend is running on `192.168.57.107:5000`
   - Check firewall settings
   - Verify mobile device is on same network

2. **Production Fallback:**

   - Automatically falls back to production backend
   - No manual intervention needed

3. **Network Testing:**

   ```typescript
   import { checkApiConnectivity } from '../api';

   const networkStatus = await checkApiConnectivity();
   console.log('Network status:', networkStatus);
   ```

### **3. Authentication Failures**

**Symptoms:**

- 401 Unauthorized errors
- Token expired messages
- User ID validation failures

**Solutions:**

1. **Check Token:**

   - Verify `accessToken` in AsyncStorage
   - Check token expiration
   - Re-authenticate if needed

2. **User ID Validation:**
   - Ensure user is logged in
   - Check user ID format and validity
   - Verify backend user exists

### **4. Order Creation Failures**

**Symptoms:**

- Backend order creation fails
- Database errors
- Razorpay API errors

**Solutions:**

1. **Backend Logs:**

   - Check backend console for errors
   - Verify database connectivity
   - Check Razorpay credentials

2. **Data Validation:**
   - Ensure all required fields are present
   - Validate amount format (in paise)
   - Check plan existence and status

## 🛠️ **Debugging Steps**

### **Step 1: Check Network Status**

```typescript
import { checkApiConnectivity } from '../api';

const debugNetwork = async () => {
  const status = await checkApiConnectivity();
  console.log('Network Debug:', status);

  if (!status.isOnline) {
    console.error('❌ No backend accessible');
  } else {
    console.log('✅ Backend accessible:', status.recommendedUrl);
  }
};
```

### **Step 2: Test Backend Endpoints**

```bash
# Test local backend
curl http://192.168.57.107:5000/health

# Test production backend
curl https://utility-apis-49wa.onrender.com/health
```

### **Step 3: Verify Razorpay Configuration**

```typescript
// Check frontend config
console.log('Frontend Razorpay Key:', RAZORPAY_CONFIG.key);

// Check backend config (in logs)
console.log('Backend should use same key');
```

### **Step 4: Monitor Payment Flow**

```typescript
// Enable debug mode
const DEBUG_MODE = true;

// Check each step
console.log('1. User authentication:', !!token);
console.log('2. Order creation:', orderResponse);
console.log('3. Razorpay modal:', modalOpened);
console.log('4. Payment result:', paymentData);
```

## 🔧 **Quick Fixes**

### **Immediate Actions:**

1. **Restart Backend:** Kill and restart the backend service
2. **Clear App Cache:** Clear React Native app cache
3. **Check Network:** Ensure mobile device can reach backend
4. **Verify Keys:** Confirm API keys match exactly

### **Long-term Solutions:**

1. **Environment Management:** Use proper environment variables
2. **Network Fallback:** Implement automatic fallback logic
3. **Error Handling:** Add comprehensive error handling
4. **Monitoring:** Add payment flow monitoring

## 📱 **Mobile-Specific Issues**

### **Android:**

- Longer timeout needed (10 seconds)
- Network security config may block local IPs
- Check Android manifest permissions

### **iOS:**

- Faster timeout (8 seconds)
- Network security settings
- Simulator vs device differences

## 🚀 **Testing Checklist**

- [ ] Backend service running
- [ ] API keys match
- [ ] Network accessible
- [ ] User authenticated
- [ ] Plan data valid
- [ ] Amount calculation correct
- [ ] Razorpay modal opens
- [ ] Payment completes
- [ ] Backend receives confirmation

## 📞 **Support Contacts**

- **Backend Issues:** Check backend logs
- **Frontend Issues:** Check React Native logs
- **Razorpay Issues:** Check Razorpay dashboard
- **Network Issues:** Test connectivity manually
