# Firebase Setup Checklist

If you see:
- `Database '(default)' not found`
- `Missing or insufficient permissions`

complete the steps below in Firebase Console for your project.

## 1. Enable Firestore
1. Open Firebase Console.
2. Select project: `pli-tracker-b0c69`.
3. Go to **Build > Firestore Database**.
4. Click **Create database**.
5. Choose **Production mode** (recommended).
6. Choose a region and finish creation.

## 2. Apply Security Rules
In **Firestore Database > Rules**, paste the rules from `firestore.rules` and publish.

## 2.1 Apply Storage Rules (for Excel Upload)
In **Build > Storage > Rules**, paste rules from `storage.rules` and publish.

## 3. Enable Authentication Providers
In **Build > Authentication > Sign-in method**:
- Enable `Email/Password`
- Enable `Google` (optional)

## 4. Verify Web App Config
Ensure `.env` has the same values from Firebase project settings (Web app config).

## 5. Restart Dev Server
After changing `.env` or Firebase settings, restart Next.js dev server:

```bash
npm run dev
```

## 6. Optional: Add Composite Indexes
If Firestore later requests an index URL in console logs, open the URL and create the index.
