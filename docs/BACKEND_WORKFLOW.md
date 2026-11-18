# Backend Workflow — Beginner's Guide

> A simple, step-by-step plan for turning the HR Noxt Dashboard from a
> "fake data" frontend into a real full-stack app.
> Written in plain language. No prior backend experience needed.

---

## 1. The big idea (a restaurant analogy)

Think of the app like a **restaurant**:

| Part of the app | Restaurant role | What it does |
|---|---|---|
| **Frontend** (done ✅) | The dining room + menu | What the user sees and clicks |
| **Backend (API)** | The waiter | Takes requests, brings back data |
| **Database** | The kitchen pantry | Stores all the data, permanently |

Right now you only have the **dining room**. The customer can look at the
menu and press buttons, but there is no waiter and no kitchen — so the
"food" (data) is **fake**. When you refresh the page, everything you typed
disappears. That is the problem we are solving.

**Goal:** add the waiter (backend) and the pantry (database) so data is
**real and stays saved**.

---

## 2. What order do we build it in?

**Database first, then backend, then connect the frontend.**

Why this order? You can't build a waiter (backend) until you know what's in
the pantry (database). And you can't fill the pantry until you've decided
what shelves it needs (the design). So we go from the bottom up.

Good news: your frontend already *describes* the data it needs (in its
TypeScript types). That description is basically a first draft of the
database plan — we just make it official.

---

## 3. The 5 phases (plain language)

### Phase 1 — Design the database (draw the plan)
- **What:** Decide what data we store and how the pieces connect.
  Example: an *Employee* has many *Contracts*; a *Contract* has many *Payslips*.
- **Why:** This is the foundation. Everything else is built on top.
- **You're done when:** You have a list of "tables" (Employees, Contracts,
  Payslips, Leave, Goals, Tickets…) with their fields and how they link.

### Phase 2 — Build the database (create the tables)
- **What:** Turn the plan into real tables using **migrations** (small
  scripts that create/change tables).
- **Why:** A migration is a safe, repeatable way to set up the database —
  and to change it later without breaking things.
- **You're done when:** The tables exist in the platform's Postgres database.

### Phase 3 — Build the backend / API (the waiter)
- **What:** Create a small server with **endpoints** — web addresses the
  frontend can call, like `GET /employees` (give me the list) or
  `POST /employees` (save a new one).
- **Why:** This is the only thing allowed to touch the database. It checks
  requests and reads/writes data safely.
- **You're done when:** You can ask the API for data and it answers with
  real data from the database.

### Phase 4 — Connect the frontend (swap fake for real)
- **What:** Replace the fake data with real calls to your API.
  Right now the app "saves" by editing a fake list in memory
  (`setQueryData`). We swap that for a real network request.
- **Why:** Now buttons do real things and data survives a refresh.
- **You're done when:** Creating an employee on the screen actually saves it
  to the database, and it's still there after reload.

### Phase 5 — Test & deploy (check, then ship)
- **What:** Click through the app, fix bugs, then put it live.
- **Why:** Catch mistakes before users do.
- **You're done when:** The live site works end-to-end.

---

## 4. The journey (flowchart)

```
                YOU ARE HERE
                     |
       +-------------v--------------+
       |   FRONTEND (done)          |   screens + buttons work,
       |   but data is FAKE         |   but it vanishes on refresh
       +-------------+--------------+
                     |
                     |  goal: make data real & permanent
                     v
   +----------------------------------------------+
   | PHASE 1  DESIGN the database                 |
   |          (decide the tables & how they link) |
   +----------------------------------------------+
                     |
                     v
   +----------------------------------------------+
   | PHASE 2  BUILD the database                  |
   |          (create the tables via migrations)  |
   +----------------------------------------------+
                     |
                     v
   +----------------------------------------------+
   | PHASE 3  BUILD the backend / API             |
   |          (the "waiter" that reads & writes)  |
   +----------------------------------------------+
                     |
                     v
   +----------------------------------------------+
   | PHASE 4  CONNECT the frontend                |
   |          (swap fake data for real API calls) |
   +----------------------------------------------+
                     |
                     v
   +----------------------------------------------+
   | PHASE 5  TEST & DEPLOY                        |
   |          (click through, fix, ship it live)  |
   +----------------------------------------------+
                     |
                     v
              FULL-STACK APP  (data is real!)
```

---

## 5. How one request flows (once it's built)

This is what happens every time the screen needs data:

```
  USER clicks "Save employee"
            |
            v
  FRONTEND sends a request  ----HTTP---->  BACKEND (the waiter)
                                               |
                                               | checks the request,
                                               | then talks to the pantry
                                               v
                                          DATABASE (saves the row)
                                               |
                                               | "saved! here it is"
                                               v
  FRONTEND shows it  <----HTTP----  BACKEND sends the answer back
            |
            v
  USER sees the new employee (and it's still there after refresh)
```

---

## 6. Your everyday work loop

Every small change — whether a table, an endpoint, or a screen — follows
the same little loop. Do this in **small steps**, not all at once.

```
   +--> write a little code
   |          |
   |          v
   |     run it on your computer  (npm run dev)
   |          |
   |          v
   |     does it work?  --- NO ---> find & fix the problem ---+
   |          |                                               |
   |         YES                                              |
   |          |  <--------------------------------------------+
   |          v
   |     save it       (git commit  with a clear message)
   |          |
   |          v
   |     ship it       (msh deploy)
   |          |
   |          v
   |     check the live site works
   |          |
   +----------+   (repeat for the next small change)
```

**Golden rule for beginners:** change *one small thing*, check it works,
then move on. If something breaks, you'll know exactly what caused it.

---

## 7. What to do next (Phase 1, step 1)

The very first concrete task is to **list the data we already have**.
We do this by reading the frontend's existing data types and writing down
each "thing" (table) and its fields. No code yet — just the plan.

When you're ready, the next action is:
> "Go through the frontend types and draft the database tables."

That output becomes the blueprint for Phases 2–4.

---

## Quick glossary (words you'll hear a lot)

| Word | Plain meaning |
|---|---|
| **Database** | The place where data is stored permanently. |
| **Table** | One kind of data (e.g. all Employees), like a spreadsheet. |
| **Row / record** | One single entry (e.g. one employee). |
| **Field / column** | One detail of a row (e.g. name, email, salary). |
| **Migration** | A script that creates or changes tables safely. |
| **Backend / API** | The server that reads & writes the database. |
| **Endpoint** | One API address, e.g. `GET /employees`. |
| **Request / Response** | The question the frontend asks, and the answer it gets. |
| **Deploy** | Putting your latest code live (`msh deploy`). |
