# UtilsApp

A cross-platform mobile application built with React Native.

## Project Structure

```
UtilsApp/
  ├── __tests__/                # Test files
  ├── android/                  # Android native project files
  ├── ios/                      # iOS native project files
  ├── src/
  │   └── screens/              # App screens
  │       └── Auth/             # Authentication-related screens
  ├── App.tsx                   # Main App entry point
  ├── index.js                  # Entry point for React Native
  ├── app.json                  # App configuration
  ├── package.json              # Project dependencies and scripts
  ├── tsconfig.json             # TypeScript configuration
  ├── yarn.lock                 # Yarn lockfile
  └── README.md                 # Project documentation
```

## Getting Started

### Prerequisites
- Node.js
- Yarn or npm
- React Native CLI
- Android Studio / Xcode (for native builds)

### Installation
1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd UtilsApp
   ```
2. Install dependencies:
   ```sh
   yarn install
   # or
   npm install
   ```

### Running the App
- **Android:**
  ```sh
  npx react-native run-android
  ```
- **iOS:**
  ```sh
  npx react-native run-ios
  ```

## App Flow & Features

### 1. Splash & Onboarding
- **Splash Screen:** When the app launches, a splash screen with a branded image and loader is shown for a brief moment.
- **Onboarding Screen:** After the splash, users see an onboarding screen introducing the app's value: "AI Powered Entry System" for business accounting. Users can choose to **Sign In** or **Create Account**.

### 2. Authentication
- **Sign In:**
  - Users enter their mobile number.
  - An OTP is sent for verification.
  - After entering the OTP, users are authenticated.
  - Option to navigate to account creation if they don't have an account.
- **Create Account:**
  - Users provide business name, owner name, mobile number, business type, and (optionally) GST number.
  - Must agree to Terms of Service and Privacy Policy.
  - OTP verification is required for mobile number.
  - On successful verification, users proceed to the setup wizard.

### 3. Setup Wizard
A multi-step onboarding process to personalize the app for the user's business:
1. **Business Details:** Select business size, industry, monthly transaction volume, and current accounting software.
2. **Team Setup:** Specify team size. Learn about available roles: Admin, Accountant, Data Entry, Viewer.
3. **Preferences:** Choose preferred language. Select features of interest (Voice Input, OCR Scanning, WhatsApp Integration).
4. **Bank Details:** Enter bank name, account number, and IFSC code. Bank details are encrypted and used only for reconciliation.
5. **Final Step:** State primary goal (e.g., automate accounting, GST compliance). Optionally describe current accounting challenges. Summary of personalized features enabled for the user.

Each step includes a progress bar and navigation (Next/Previous).

### 4. Navigation
- The app uses a stack navigator.
- Main screens:
  - Onboarding
  - SignIn
  - CreateAccount
  - SetupWizard (with sub-steps: TeamSetup, Preferences, BankDetails, FinalStep)
- Navigation is handled programmatically after each step or action.

### 5. User Experience
- **Modern UI:** Uses gradients, icons, and clear progress indicators.
- **Validation:** Input fields are validated (e.g., mobile number length, OTP length, required fields).
- **Accessibility:** Keyboard dismiss, clear labels, and touchable areas for better usability.

---

## Example User Journey

1. **New User:**
   - Opens app → Splash → Onboarding → Create Account → OTP Verification → Setup Wizard (5 steps) → App is ready, personalized.
2. **Returning User:**
   - Opens app → Splash → Onboarding → Sign In → OTP Verification → App home/dashboard.

---

## Key Screens & Components
- `OnboardingScreen.tsx` – Welcome and intro.
- `SignInScreen.tsx` – Mobile/OTP login.
- `CreateAccountScreen.tsx` – Registration and OTP.
- `SetupWizard.tsx` – Orchestrates the multi-step setup.
- `SetupWizardScreen.tsx`, `TeamSetupScreen.tsx`, `PreferencesScreen.tsx`, `BankDetailsScreen.tsx`, `FinalStepScreen.tsx` – Individual steps in the setup wizard.

---

## Extending the App
- Add more screens to the stack navigator in `App.tsx`.
- Each setup step is modular and can be extended or reordered.
- Business logic for authentication and data submission can be integrated with backend APIs.

## Folder Details
- `src/screens/Auth/`