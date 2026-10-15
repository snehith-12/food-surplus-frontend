# Food Surplus Router — Frontend Web Client 🍲

Modern, high-performance web interface for the **Food Surplus Router** platform, built with **Next.js 14 (App Router)** and **Tailwind CSS**. It connects restaurants and food donors with verified local shelters and non-profit kitchens to minimize food wastage and hunger in real time.

---

## ✨ Features & User Portals

### 1. 🏢 Restaurant & Donor Portal
* **Surplus Food Posting:** Real-time form with food categorization, portions/servings count, dietary preferences, and pickup window scheduler.
* **Active Listing Management:** Real-time view of listed surplus, incoming claims from verified shelters, and pickup confirmations.

### 2. 🏠 Shelter & Non-Profit Feed
* **Live Surplus Feed:** Filter listings within a 10-mile radius with nearest expiry sorting.
* **Direct UPI Claim & Checkout:** Seamless ₹20 non-editable convenience fee payment with dynamic QR codes (Google Pay, PhonePe, Paytm, BHIM) and strict 12-digit UTR transaction validation.

### 3. 🛡️ Admin Command Center (`/admin`)
* **Shelter KYC Verification Queue:** Approve or reject registrations based on 12A/80G certificates or Trust Deeds.
* **Donor Scale Tiering:** Categorize commercial chains, enterprise banquets, and local bakeries.
* **Logistics & City Zones:** Switch city zones (Bengaluru, Hyderabad, Mumbai, Delhi, Chennai, Kolkata, or custom zones) with live geospatial route heatmaps.
* **ESG & Environmental Analytics:** Real-time carbon offset (kg CO₂e) and landfill diversion tracking for corporate ESG / BRSR audits.

---

## 🛠️ Tech Stack

* **Framework:** Next.js 14 (App Router)
* **Styling:** Tailwind CSS & PostCSS
* **Icons & UI:** Heroicons & SVG Lucide
* **Date Handling:** `date-fns`
* **QR Generation:** `qrcode`
* **Auth Session:** `next-auth/react`

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `NEXTAUTH_SECRET` and `DATABASE_URL` are configured.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## 📦 Deployment

Optimized for 1-click deployment on **[Vercel](https://vercel.com)**. Connect your GitHub repository, add environment variables, and deploy!
