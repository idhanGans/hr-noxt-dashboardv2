# Phase 3 Plan — Build the API (the "waiter")

> Short plan for the backend API. Plain language, for a beginner.
> The database (Phase 2) is done; now we build the part that reads & writes it.

---

## 1. Quick recap

```
 Browser (screens)  <-->  API (the waiter)  <-->  Database (the pantry, DONE)
        you have this        we build this           22 tables exist
```

The **API** is a set of web addresses (called **endpoints**) that the screens
call to get or save data. They live inside this same Next.js app, under
`src/app/api/...`.

---

## 2. What the endpoints look like

For each kind of data (e.g. employees) we make a few endpoints. They follow a
worldwide convention called **REST** — the *address* stays the same, the *verb*
changes:

| Verb + address | Means | Example |
|---|---|---|
| `GET /api/employees` | give me the list | show the employees table |
| `GET /api/employees/5` | give me one | open employee #5 |
| `POST /api/employees` | create a new one | "Add employee" form |
| `PATCH /api/employees/5` | change one | edit employee #5 |
| `DELETE /api/employees/5` | remove one | delete employee #5 |

In Next.js these become files:
```
src/app/api/employees/route.ts        -> GET (list) + POST (create)
src/app/api/employees/[id]/route.ts   -> GET (one) + PATCH + DELETE
```

---

## 3. What happens on every request (the important part)

This is where your **roles** (manager / admin / staff) get enforced:

```
 Browser asks:  GET /api/employees
       |
       v
 [1] Platform checks login (ForwardAuth)
       |--- not logged in ---> 401  (stop)
       | logged in: platform adds a header  X-Auth-User = who you are
       v
 [2] Our API looks that user up in the DB  ->  reads their role
       |--- unknown user ---> 403  (stop)
       v
 [3] Is this role allowed here?
       |--- no ---> 403 "not allowed"  (stop)
       | yes
       v
 [4] Read/write the rows in the database
       |
       v
 [5] Not a manager?  ->  strip sensitive fields (salary, iban, tax id...)
       |
       v
 [6] Send JSON back  ->  the screen shows it
```

Steps **1–2** = *who are you*. Steps **3 & 5** = *what are you allowed to see*.
We write this once as a small helper and reuse it in every endpoint.

The access rules (from the blueprint):

| Role | Read | Write | Sensitive fields |
|---|---|---|---|
| manager | everything | yes | visible |
| admin | most | no | hidden |
| staff | attendance (own) | own clock-in/out | hidden |

---

## 4. How we build it (order)

We do **one kind of data fully first** (employees), so you see the whole
pattern once. Then the rest is copy-and-adapt.

```
 STEP 1  Seed       put your current mock data into the real tables
   |                (so the screens have something to show)
   v
 STEP 2  Read one   GET /api/employees + GET /api/employees/[id]
   |                (first real endpoint, end to end)
   v
 STEP 3  Auth helper  the "who are you + are you allowed" check from section 3
   |
   v
 STEP 4  Write one  POST / PATCH / DELETE employees
   |                (finish the employees example completely)
   v
 STEP 5  Repeat     same pattern for the other tables, by priority
   |
   v
 STEP 6  Docs       keep GET /docs updated  (the platform requires it)
```

**Priority order for STEP 5** (most-used screens first):
1. lookups: departments, titles  ·  2. payslips  ·  3. contracts
4. leave requests  ·  5. goals  ·  6. helpdesk tickets  ·  7. the rest

We do **not** wire the screens to these endpoints yet — that's Phase 4. Phase 3
just builds and tests the endpoints themselves.

---

## 5. Tools we already have (no new big decisions)

- **Validation:** Zod (already in the project) checks incoming data on POST/PATCH.
- **DB access:** Drizzle (set up in Phase 2) reads/writes the tables.
- **Identity:** the platform's `X-Auth-*` headers tell us who is logged in.

---

## 6. Two open questions (we answer before STEP 3)

1. **Whose role am I?** The platform tells us *who* you are (`X-Auth-User`),
   and our `employees.role` column tells us *your access level*. So the logged-in
   person must exist as an employee row. → We seed an employee that matches you
   (manager) so you can test.
2. **Unknown user** (logged in, but not an employee in our DB): treat as
   "no access" (403)? Recommended: yes, for now.

---

## Glossary additions

| Word | Plain meaning |
|---|---|
| **Endpoint** | one API address, e.g. `GET /api/employees`. |
| **REST** | the convention of same-address + different-verb (GET/POST/PATCH/DELETE). |
| **Seed** | filling empty tables with starter data. |
| **Validation** | checking that incoming data is well-formed before saving. |
| **JSON** | the text format the API and screens use to exchange data. |
