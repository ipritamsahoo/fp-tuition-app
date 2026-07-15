# FP Finance - System Installation & Developer Setup Guide

This document provides comprehensive instructions for installing, configuring, and deploying the **FP Finance** platform from scratch on a clean system, including local environment initialization and production hosting setup.

---

## 1. Prerequisites

Make sure your machine has the following installed:
- **Python (Version 3.11 or later)**: Verify with `python --version`
- **Node.js (Version 18 or later)**: Verify with `node -v` and `npm -v`
- Accounts on:
  - **Firebase Console** (Database, Auth, Cloud Messaging, Hosting)
  - **Google Cloud Console** (Google Drive File Storage & Backups)
  - **Cloudinary** (Image management)

---

## 2. Service Configurations & Keys Setup

### Step 2.1: Firebase Console Setup
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **"Add Project"**, name it (e.g., `fp-finance`), and create it.
3. **Authentication (Email/Password)**:
   - Navigate to **Build > Authentication** and click **Get Started**.
   - Under the **Sign-in method** tab, click **Email/Password**, enable it, and save.
   
   > [!IMPORTANT]  
   > **How Login/Authentication Works Under the Hood:**  
   > Although you register and log in on the UI using a **Username** or **Mobile Number**, Firebase Authentication's native Email/Password provider strictly requires an email-formatted string (e.g., `user@domain.com`).  
   > 
   > To solve this, the backend automatically converts any username or phone number to a "fake" email using the custom domain `@fp.com` (configured in `schemas.py` as `FAKE_EMAIL_DOMAIN`).  
   > - Input Username: `admin_user`  
   > - Mapped Firebase Email: `admin_user@fp.com`  
   > 
   > When looking at users in your Firebase Console Auth dashboard, you will see them registered with these `@fp.com` email addresses. You do **not** need to create real mailboxes for them.

4. **Firestore Database**:
   - Go to **Build > Firestore Database** and click **Create Database**.
   - Start in **Production Mode**.
   - Choose a database location close to you (e.g., `asia-south1` for India) and click create.
5. **Register Web App**:
   - On the Project Overview page, click the **Web icon (`</>`)** to add an app.
   - Name it `fp-finance-web`, and click **Register app**.
   - Copy the configuration values. You will need them for the frontend `.env`.
6. **Firebase Cloud Messaging (FCM)**:
   - Click the **Gear icon** (Project Settings) next to "Project Overview".
   - Select the **Cloud Messaging** tab.
   - Scroll down to the **Web configuration** section. Under "Web Push certificates", click **Generate key pair**.
   - Copy the generated **VAPID key**. This will be used in the frontend configuration.
7. **Service Account Key (for Backend)**:
   - Go to **Project Settings > Service accounts** tab.
   - Click **Generate new private key**.
   - A JSON file will download. Rename it to `serviceAccountKey.json` and place it in the `backend/` directory.

### Step 2.2: Firestore Security Rules Configuration
Go to the **Rules** tab in your Firebase Console under Firestore Database and paste the following rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /payments/{paymentId} {
      allow read: if request.auth != null;
    }
    match /users/{userId} {
      allow read: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> [!NOTE]  
> **How this works:** Authenticated users (from the frontend React client) are allowed to directly read documents in the `payments` and `users` collections. However, all other queries and **all write operations (creation, updates, deletions)** are completely blocked (`allow read, write: if false;`). This ensures that database changes can only occur through the FastAPI backend using the Admin SDK, making the database highly secure.

---

## 3. Firestore Composite Indexes Configuration

Firestore requires Composite Indexes for queries that filter/sort on multiple fields. If these indexes are missing, the frontend queries will fail. 

You can set these up using either the **Firebase Console (Web UI)** or the **Firebase CLI**.

### Method A: Manual Setup (Firebase Console)
1. Go to **Firestore Database** in the Firebase Console.
2. Click the **Indexes** tab and select **Composite**.
3. Click **Add Index** and create the 5 indexes described below:

| Collection ID | Field 1 | Field 2 | Field 3 | Field 4 | Query Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **notes** | `batch_id` (Ascending) | `uploaded_by` (Ascending) | `created_at` (Descending) | `__name__` (Descending) | Collection |
| **notes** | `batch_id` (Ascending) | `created_at` (Descending) | `__name__` (Descending) | *None* | Collection |
| **notices** | `batch_id` (Ascending) | `created_at` (Ascending) | `__name__` (Ascending) | *None* | Collection |
| **notices** | `batch_id` (Ascending) | `created_at` (Descending) | `__name__` (Descending) | *None* | Collection |
| **payments** | `status` (Ascending) | `updated_at` (Ascending) | `__name__` (Ascending) | *None* | Collection |

---

### Method B: Automated Setup (Firebase CLI)
If you deploy your app using the Firebase CLI, you can create a file named `firestore.indexes.json` in your frontend directory and paste the configuration below:

```json
{
  "indexes": [
    {
      "collectionGroup": "notes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "batch_id", "order": "ASCENDING" },
        { "fieldPath": "uploaded_by", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" },
        { "fieldPath": "__name__", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "batch_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" },
        { "fieldPath": "__name__", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "batch_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "ASCENDING" },
        { "fieldPath": "__name__", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "notices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "batch_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" },
        { "fieldPath": "__name__", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "payments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "updated_at", "order": "ASCENDING" },
        { "fieldPath": "__name__", "order": "ASCENDING" }
      ]
    }
  ]
}
```

To deploy these indexes automatically to your project:
```bash
firebase deploy --only firestore:indexes
```

---

## 4. Google Cloud Console Setup (For Google Drive storage & Backups)

Our backup scripts and notes service upload files to Google Drive.
1. Open the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project (or use the one created by Firebase).
3. Search for **Google Drive API** in the search bar and click **Enable**.
4. Set up the **OAuth consent screen**:
   - Choose **External** User Type and click Create.
   - Fill in the App Name, User support email, and Developer contact information. Click Save and Continue.
   - Click **Add or Remove Scopes**. Add `/auth/drive` (to allow full Drive manipulation). Click Save and Continue.
   - **CRITICAL**: Go to **Test Users**, click **Add Users**, and enter your personal Gmail address. If you do not add your Gmail here, Google will block you from getting the OAuth refresh token.
5. Generate **OAuth Credentials**:
   - Click **Credentials** in the left menu.
   - Click **Create Credentials > OAuth client ID**.
   - Select **Desktop App** as the Application Type, name it (e.g., `FP Drive Backup`), and click Create.
   - Download the JSON or copy the **Client ID** and **Client Secret**.
6. Create a Google Drive Storage Folder:
   - Go to your personal Google Drive and create a folder (e.g., `FP Tuition App Data`).
   - Open the folder. Copy the long string of characters at the end of the browser URL (e.g., `1a2b3c4d5e...`). This is your **GOOGLE_DRIVE_FOLDER_ID**.

---

## 5. Cloudinary Setup (For Avatar Uploads)

1. Go to [Cloudinary](https://cloudinary.com/) and register for a free account.
2. Go to the Console Dashboard.
3. Copy your **Cloud Name**, **API Key**, and **API Secret**. You will add these to the backend `.env`.

---

## 6. Running Backend Locally

1. Open your terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a python virtual environment:
   - **Windows (Command Prompt / PowerShell)**:
     ```bash
     python -m venv venv
     venv\Scripts\activate
     ```
   - **Mac/Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure Backend Environment:
   - Create a `.env` file in the `backend/` directory.
   - Fill it in with the keys you gathered:
     ```ini
     FIREBASE_API_KEY="your-firebase-web-api-key"
     FIREBASE_CREDENTIALS="serviceAccountKey.json"

     ADMIN_UPI_VPA="your_upi_id@upi"
     DEFAULT_FEE_AMOUNT=500

     HOST="0.0.0.0"
     PORT=8000

     CRON_SECRET="choose-a-strong-random-password"

     CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
     CLOUDINARY_API_KEY="your-cloudinary-api-key"
     CLOUDINARY_API_SECRET="your-cloudinary-api-secret"

     GOOGLE_CLIENT_ID="your-google-client-id"
     GOOGLE_CLIENT_SECRET="your-google-client-secret"
     GOOGLE_REFRESH_TOKEN="" # We will generate this next
     GOOGLE_DRIVE_FOLDER_ID="your-google-drive-folder-id"
     ```
5. Get Google Drive Refresh Token:
   - In your backend terminal (with the virtual environment activated), run:
     ```bash
     python get_refresh_token.py
     ```
   - Input the Client ID and Client Secret you downloaded from Google Cloud Console.
   - A browser window will open. Login with your Gmail address (the one you added to "Test Users" in step 4).
   - Google will show a warning screen. Click **Advanced > Go to FP Drive Backup (unsafe)** to proceed.
   - Once success is shown in the browser, check your terminal. It will output your `GOOGLE_REFRESH_TOKEN`.
   - Copy this token and update `GOOGLE_REFRESH_TOKEN` in `backend/.env`.

6. Run the Backend API:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   Keep this terminal running. The backend API is now running at `http://localhost:8000`.

---

## 7. Seeding the First Admin (CRITICAL)

Because `/api/auth/register` requires a logged-in Admin to run, an empty database creates a "chicken-and-egg" lock. You can seed your first Admin user in two ways:

### Method A: Using FastAPI interactive API docs (Recommended)
1. Open your browser and go to `http://localhost:8000/docs`.
2. Locate the **Admin** section and click on `POST /api/admin/seed`.
3. Click the **"Try it out"** button.
4. Replace the Request body template with your credentials:
   ```json
   {
     "username": "admin_user",
     "password": "admin_password_123",
     "name": "Administrator"
   }
   ```
5. Click **Execute**. The response body will confirm the admin has been created successfully.

### Method B: Using cURL
1. Open a terminal and run the following command:
   ```bash
   curl -X POST "http://localhost:8000/api/admin/seed" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"admin_user\", \"password\": \"admin_password_123\", \"name\": \"Administrator\"}"
   ```

---

## 8. Emergency Admin Reset (Optional)

If you lose access to your Admin account, or you want to delete all current admin accounts to re-seed the system, you can use the **Emergency Reset** endpoint.

This endpoint is unsecured (does not require authentication headers) but requires a hardcoded `master_key`.

### Steps to Reset:
1. Open the interactive API documentation at `http://localhost:8000/docs` (or use Postman/cURL).
2. Locate the endpoint: `POST /api/admin/emergency-reset`.
3. Click **"Try it out"**.
4. Set the Request body payload as:
   ```json
   {
     "master_key": "fpfinance-master-2026-ps-sm"
   }
   ```
5. Click **Execute**.
6. The backend will delete all admin entries from both Firebase Auth and the Firestore `users` collection. 
7. You can now use the `/api/admin/seed` endpoint (Section 7) to register a new administrator account.

---

## 9. Running Frontend Locally

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Configure Frontend Environment:
   - Create a `.env` file in the `frontend/` directory.
   - Fill it in with the configuration from step 2.1:
     ```ini
     VITE_FIREBASE_API_KEY="your-api-key"
     VITE_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
     VITE_FIREBASE_PROJECT_ID="your-project-id"
     VITE_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
     VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
     VITE_FIREBASE_APP_ID="your-app-id"
     VITE_FIREBASE_VAPID_KEY="your-generated-vapid-key"
     VITE_API_URL="http://localhost:8000"
     ```
4. Start the Dev Server:
   ```bash
   npm run dev
   ```
5. Click the link printed in the console (usually `http://localhost:5173`) to launch the application. Login using your newly created Admin credentials (`admin_user` / `admin_pass123`).

---

## 10. Hosting & Production Deployment

### 10.1: Hosting the Backend (on Render)
1. Commit your backend directory code to a GitHub repository (**Do NOT commit your `.env` or `serviceAccountKey.json` files!**).
2. Go to [Render](https://render.com/) and create a new **Web Service**.
3. Link your GitHub repository.
4. Set the following fields:
   - **Root Directory**: `backend`
   - **Environment**: `Docker`
5. Go to the **Environment** tab on Render and add all the variables from your local `.env`.
6. Add one additional variable:
   - **Key**: `FIREBASE_CREDENTIALS_JSON`
   - **Value**: Open your `serviceAccountKey.json` file. Remove all line breaks so it is a single-line string, and paste it here.
7. Save changes. Render will automatically build the container and deploy the backend.

### 10.2: Hosting the Frontend (on Firebase Hosting)
1. Open a terminal in the `frontend/` folder.
2. Build the optimized static files:
   ```bash
   npm run build
   ```
3. Install Firebase CLI globally:
   ```bash
   npm install -g firebase-tools
   ```
4. Authenticate the CLI:
   ```bash
   firebase login
   ```
5. Deploy:
   ```bash
   firebase deploy --only hosting
   ```
   Firebase will give you a public URL (e.g., `https://your-project-id.web.app`) where your web application is now live! Remember to update the `VITE_API_URL` environment variable in your production setup to point to the production backend on Render.
