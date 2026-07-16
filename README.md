# 🎓 Future Point Finance (FP Finance)

### Role-Based Tuition & Fee Management Platform

**FP Finance** is a comprehensive, role-based tuition fee management and center administration platform built specifically for the **Future Point** tuition center. It provides tailored portals and dedicated dashboards for **Administrators**, **Teachers**, and **Students** to streamline payment tracking, notes/notice sharing, and revenue settlements.

---

## 🚀 Key Features

* **Role-Based Architecture**: Custom dashboards and portals for Admins, Teachers, and Students.
* **Fee Tracking**: Track student payments, invoice status, and generate detailed reports.
* **Notice Board & Notes sharing**: Distribute announcements and study materials directly to specific student batches.
* **Revenue Distribution**: Seamless teacher revenue settlement based on batch fees.
* **Security & Offline Support**:
  - Secure API authentication backed by Firebase Admin SDK.
  - Device-level Biometric Authentication lock.
  - Progressive Web App (PWA) supporting offline usage, updates check, and custom service worker caching.
* **Integrations**:
  - **Firebase Auth & Firestore**: Cloud database and secure emailless (username-based) login.
  - **Firebase Cloud Messaging (FCM)**: Daily automated payment reminders and software update notifications.
  - **Cloudinary**: Profile picture upload, resizing, and hosting.
  - **Google Drive API**: Automatic Firestore DB backups and study notes hosting.

---

## 📂 Project Structure

```text
fp-tuition-app/
├── backend/            # FastAPI + Uvicorn server (Python 3.11)
│   ├── routers/        # Modular API route controllers
│   ├── database.py     # Firebase SDK initialization
│   ├── dependencies.py # Role verification middlewares
│   ├── gdrive.py       # Google Drive upload/download service
│   ├── Dockerfile      # Render deployment configuration
│   └── requirements.txt
├── frontend/           # Vite + React (JS + TailwindCSS v4)
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── context/    # Global state contexts (Auth, Theme, Notification, Biometrics)
│   │   ├── pages/      # Dashboards and user interfaces
│   │   └── sw.js       # PWA service worker code
│   ├── firebase.json   # Firebase Hosting routing config
│   └── package.json
└── SETUP_GUIDE.md      # Step-by-step setup, seeding, and deployment manual
```

---

## 🛠️ Getting Started

For a step-by-step installation, local execution, data seeding, and hosting guides, please refer to the:

👉 **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**

It contains detailed setup steps for:
1. Firebase Project, Firestore rules, and Service Account key generation.
2. Firestore Composite Indexes setup.
3. Google Drive API configuration and Refresh Token generation.
4. Cloudinary integration.
5. Seeding your first Administrator account using Swagger docs or cURL.
6. Local virtual environments execution (FastAPI & React Dev server).
7. Deploying to Render (Backend Docker) and Firebase Hosting (Frontend).

---

## 📄 License

This project is private and proprietary. Unauthorized copying, distribution, or execution is strictly prohibited.
