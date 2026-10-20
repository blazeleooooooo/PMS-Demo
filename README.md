# Acme Project OS

A portfolio demo of a project-management workspace for design-and-build teams: pitching, live projects, clients, suppliers, and project finance.

**Live demo:** https://pms-demo-wheat.vercel.app

Everyone and every company in the app is fictional. There are no real clients in this repository or on the live site.

## Sign in

1. Open the live demo. The login page shows the demo account.
2. Email: `demo@example.com`
3. Password: `5550100199`
4. If the verification-code email is inconvenient, use **改用密碼登入**, or the button **填入並以密碼登入**.

## What to open after login

The home screen lists every module. A short demo guide at the top links the same three places:

| Open | What you will see |
| --- | --- |
| **Project** | Sample job, Northwind Cafe counter |
| **Pitching** | Sample cafe enquiry |
| **項目新聞** | Short project news |

## Stack

Next.js (App Router) · React · Supabase · hosted on Vercel

Third-party integrations such as Asana, email, and WhatsApp are switched off in the demo.

## Scripts

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Local app at http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run test:unit` | Run unit tests once |
| `npm test` | Unit tests in watch mode |

Copy `.env.example` to `.env.local` and add the demo Supabase URL and anon key before `npm run dev`. Do not commit `.env.local`.
