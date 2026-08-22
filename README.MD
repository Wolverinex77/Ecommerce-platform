# E-Commerce System (Full-Stack)

A modern full-stack e-commerce web application built with **FastAPI** (Python 3.12+) and **React** (Vite + Tailwind CSS), featuring PostgreSQL persistence, JWT authentication, and Safepay payment integration.

---

## Architecture Overview

```text
E-Commerce-System/
├── backend/                  # FastAPI REST API Backend
│   ├── app/
│   │   ├── api/              # API Route Controllers (Auth, Products, Cart, Orders, Payment, etc.)
│   │   ├── core/             # Config, Security, Enums, Exceptions
│   │   ├── db/               # SQLAlchemy Database Engine & Session
│   │   ├── models/           # SQLAlchemy ORM Database Models
│   │   ├── schemas/          # Pydantic Request/Response Schemas
│   │   └── services/         # Core Business Logic Layer
│   ├── alembic/              # Database Migrations
│   ├── requirements.txt      # Python Dependencies
│   └── .env.example          # Backend Environment Template
│
├── frontend/                 # React 19 + Vite Frontend
│   ├── src/
│   │   ├── components/       # Reusable UI Components (Navbar, CartDrawer, ProductCard, etc.)
│   │   ├── pages/            # Page Views (Home, Catalog, Details, Cart, Checkout, Success)
│   │   └── services/         # API Client & Storage Persistence
│   ├── package.json          # Frontend Dependencies & Scripts
│   └── vite.config.js        # Vite Bundler Configuration
│
└── .gitignore                # Comprehensive Git Ignore Rules
```

---

## Getting Started

### 1. Prerequisites
* Python 3.10+
* Node.js 18+ & npm
* PostgreSQL Database

---

### 2. Backend Setup (FastAPI)

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create & activate a virtual environment**:
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Or configure backend/app/core/.env
   ```
   Fill in your PostgreSQL `DATABASE_URL`, JWT `SECRET_KEY`, and Safepay merchant keys.

5. **Run database migrations**:
   ```bash
   alembic upgrade head
   ```

6. **Start the backend development server**:
   ```bash
   uvicorn app.main:app --reload
   ```
   * Interactive Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
   * Alternative Redoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

### 3. Frontend Setup (React + Vite)

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the frontend dev server**:
   ```bash
   npm run dev
   ```
   * Application UI: [http://localhost:5173](http://localhost:5173)

4. **Build for production**:
   ```bash
   npm run build
   ```

---

## Features

* **Catalog & Variants**: Full product catalog with categories, image management, size/color variant management, and real-time inventory tracking.
* **Shopping Cart**: Guest cart persistence (localStorage) with automatic synchronization to the user's backend database upon sign-in.
* **Authentication**: Secure JWT access tokens with bcrypt password hashing and role-based admin authorization.
* **Checkout & Payments**: Multi-step checkout with province-based dynamic shipping fee calculation, Cash on Delivery (COD), and Safepay online payment gateway with signature-verified webhook processing.
* **Responsive Design**: Clean Shopify-inspired clothing boutique layout built with Tailwind CSS.
