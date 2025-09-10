# 🔐 Security Setup Guide

## Overview

This document explains the security improvements made to the UtilsApp project to protect sensitive configuration and API keys.

## ⚠️ Security Changes Made

### 1. Environment Variables

- **Created `.env` file**: Contains all sensitive configuration and API keys
- **Created `.env.example`**: Template file for other developers
- **Updated `.gitignore`**: Excludes `.env` and other sensitive files from version control

### 2. Removed Secret Files

The following files containing sensitive data have been removed:

- `stable-chain.json` - Google Cloud service account credentials
- `ocr api.json` - Duplicate Google Cloud credentials
- `test-*-api.js` - Test files with hardcoded tokens
- `test-*-screen*.js` - Test files with hardcoded tokens

### 3. Code Updates

- **Created `src/config/env.ts`**: Centralized environment configuration
- **Updated API configuration**: Now uses environment variables
- **Updated payment service**: Razorpay keys now from environment
- **Updated OpenAI service**: API key now from environment

## 🚀 Setup Instructions

### For Developers

1. **Copy the template file**:

   ```bash
   cp .env.example .env
   ```

2. **Fill in your actual values** in the `.env` file:

   - Replace placeholder values with real API keys
   - Update URLs to match your environment
   - Set appropriate environment (development/production)

3. **Never commit the `.env` file** to version control

### For Production Deployment

1. Set environment variables in your deployment platform
2. Use secure secret management (e.g., AWS Secrets Manager, Azure Key Vault)
3. Ensure `.env` file is not included in production builds

## 📋 Environment Variables

### Required Variables

- `GOOGLE_PROJECT_ID` - Google Cloud project ID
- `GOOGLE_PRIVATE_KEY` - Google Cloud service account private key
- `GOOGLE_CLIENT_EMAIL` - Google Cloud service account email
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_API_KEY` - Firebase API key
- `RAZORPAY_KEY_ID` - Razorpay payment gateway key ID
- `RAZORPAY_KEY_SECRET` - Razorpay payment gateway secret

### Optional Variables

- `OPENAI_API_KEY` - OpenAI API key for NLP features
- `BASE_URL_DEV` - Development API URL
- `BASE_URL_PROD` - Production API URL

## 🔒 Security Best Practices

1. **Never commit sensitive files** to version control
2. **Use different keys** for development and production
3. **Rotate API keys** regularly
4. **Monitor API usage** for suspicious activity
5. **Use environment-specific configurations**
6. **Keep `.env` file secure** and limit access

## 🛠️ Development

### Adding New Environment Variables

1. Add to `src/config/env.ts` interface
2. Add to `.env.example` template
3. Update validation in `validateConfig()`
4. Use the variable in your code via `envConfig.VARIABLE_NAME`

### Testing

- Use `.env.example` as a template for test environments
- Never use production keys in tests
- Mock external API calls in unit tests

## 📞 Support

If you encounter issues with the security setup:

1. Check that all required environment variables are set
2. Verify `.env` file is in the project root
3. Ensure no sensitive files are committed to git
4. Check the console for configuration validation errors

## ⚡ Quick Start

```bash
# 1. Copy template
cp .env.example .env

# 2. Edit with your values
nano .env

# 3. Verify configuration
npm run validate-config

# 4. Start development
npm start
```

---

**Remember**: Security is everyone's responsibility. Keep your secrets safe! 🔐
