# 🧩 DMO Seal Optimizer

![Vercel](https://img.shields.io/badge/deploy-vercel-black?logo=vercel)
![Vite](https://img.shields.io/badge/built%20with-vite-646CFF?logo=vite)
![React](https://img.shields.io/badge/react-18-blue?logo=react)
![TypeScript](https://img.shields.io/badge/typescript-5-blue?logo=typescript)
![License](https://img.shields.io/badge/license-community-lightgrey)

A modern web app to **optimize seals in Digimon Masters Online (DMO)** by analyzing **efficiency, cost, and stat impact**.

---

## 🌐 Live Demo

👉 https://dmo-seal-optimizer.vercel.app/

---

## ✨ Key Features

### 📊 Smart Optimization

* Rank seals by **price-to-efficiency ratio**
* Identify the **best investment options**
* Supports large datasets (500+ seals)

### 🔍 Powerful Search & Filters

* Search by name
* Filter by stats:

  * AT (Attack)
  * CT (Critical)
  * HT (Hit Rate)
  * etc.
* Sorting options:

  * Alphabetical
  * Stat value (> 0)
  * Asc / Desc

### 💾 Persistent Progress

* Saves automatically via `localStorage`
* No account required

### 🔄 Undo System

* Undo up to ~20 actions
* Safe experimentation

### 📁 Import / Export

* Export your build as JSON
* Import anytime to continue

### 🌐 Multilanguage

* English 🇺🇸 / Spanish 🇲🇽

### 📈 Visual Feedback

* Progress bars per stat
* Quick overview of your build

---

## 🧠 Core Idea

The optimizer evaluates each seal based on:

* Stat contribution
* Required quantity per rank
* Market price (user-defined)

This allows you to answer:

> “Which seals give me the most value for my money?”

---

## ⚠️ Important Context

* DMO uses a **player-driven economy**
* Prices **change constantly**
* This tool is designed to be:

  * Flexible
  * Adaptable
  * User-controlled

### 🔴 What you must do:

* Set your own prices
* Set your current seal ranks

---

## 📦 Data Structure

* Uses a JSON file: `seals_data.json`
* Designed for **504 seals (full dataset up to 01-05-2026)**
* Easily extendable

### Example:

```json

    "MirageGaogamon (Burst Mode)": {
      "name": "MirageGaogamon (Burst Mode)",
      "priceM": 9000,
      "qty": {
        "Unopened": 0,
        "Normal": 1,
        "Bronze": 50,
        "Silver": 200,
        "Gold": 500,
        "Platinum": 1000,
        "Master": 3000
      },
      "stats": {
        "AT [Attack Damage]": {
          "Unopened": 0,
          "Normal": 30,
          "Bronze": 60,
          "Silver": 120,
          "Gold": 180,
          "Platinum": 240,
          "Master": 300
        },
        "CT [Critical Hit Rate]": {
          "Unopened": 0,
```

---

## 🛠️ Customization

You can fully customize the app:

* Add new seals
* Modify stat scaling
* Adjust prices dynamically
* Expand dataset

---

## 🧭 Usage Guide

1. Load the app
2. Import the json file
3. Select current ranks
4. change prices if needed
5. Apply filters if needed
6. Analyze ranking results
7. Optimize your investment

---

## 🚀 Tech Stack

* React + Vite
* TypeScript
* Tailwind CSS
* LocalStorage

---

## 🤝 Contributing

Contributions are welcome.

* Fork the repo
* Create a branch
* Submit a PR

---

## 📄 License

Community project for learning and utility purposes.

---

## 💬 Author Notes

This project was built to solve a real in-game problem:
optimizing seal investments efficiently in a dynamic market.

It is designed to remain flexible, scalable, and easy to extend.
