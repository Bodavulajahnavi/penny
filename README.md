<div align="center">

# penny.
**A calm, modern personal finance & expense tracker for individuals and students.**

Track income and expenses · set monthly budgets · see where your money goes

**Django + SQLite** · **Next.js + PostgreSQL** · Tailwind CSS · Chart.js

</div>

## Features

- **Accounts:** sign up, log in, and log out. Passwords are hashed and sessions last 30 days.
- **Dashboard:** total balance, income, expenses, and remaining budget at a glance, with month-by-month navigation.
- **Transactions:** add, edit, and delete income and expenses. The UI updates instantly, with no page reloads.
- **Filtering:** search, filter by type, category, or date, sort, and paginate.
- **Monthly budgets:** a limit per category, with progress bars and near- or over-budget states.
- **Charts:** cash flow (this month or the last six months) and a spending breakdown, built with Chart.js.
- **Reports:** savings rate, biggest category, daily average spending, and a six-month history.
- **CSV export:** download your transactions for any spreadsheet.
- **Responsive design:** a sidebar on desktop and a slide-out menu on mobile, with loading, empty, and error states throughout.
- **Demo account:** six months of realistic sample data, so the app feels alive the moment it opens.

## Screenshots

| Budgets | Reports |
| --- | --- |
| ![Monthly budgets with progress bars](docs/screenshots/budgets.jpg) | ![Reports with savings rate and six-month history](docs/screenshots/reports.jpg) |
| **Add a transaction** | **Sign in** |
| ![Add transaction dialog](docs/screenshots/add-transaction.jpg) | ![Sign-in screen](docs/screenshots/sign-in.jpg) |

<p align="center"><img src="docs/screenshots/mobile.jpg" alt="penny on a phone" width="300"></p>

## Run it locally

penny comes in **two complete editions** with the same design and features. Pick one:

| | Python edition | Next.js edition |
| --- | --- | --- |
| **Best for** | The quickest start: nothing but Python | A production-style TypeScript stack |
| **You need** | Python 3.10+ | Node.js 20.9+ and PostgreSQL (Docker works) |
| **Folder** | [`python/`](python/) | project root |
| **Opens at** | http://127.0.0.1:8000 | http://localhost:3000 |

Both open straight into the [demo account](#demo-account), with data created automatically on first launch.

### Option A: Python edition (Django + SQLite)

**Requirements:** [Python 3.10 or newer](https://www.python.org/downloads/) and [Git](https://git-scm.com/downloads).

**macOS / Linux**

```bash
git clone https://github.com/Bodavulajahnavi/penny.git
cd penny/python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**Windows (PowerShell)**

```powershell
git clone https://github.com/Bodavulajahnavi/penny.git
cd penny\python
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Open **http://127.0.0.1:8000**. Your data is saved in `python/db.sqlite3` and is still there after restarts. Stop the server with `Ctrl+C`.

To run it again later, go into `python/`, activate the virtual environment (`source .venv/bin/activate`, or `.venv\Scripts\Activate.ps1` on Windows), and run `python manage.py runserver`.

### Option B: Next.js edition (PostgreSQL)

**Requirements:**

- [Node.js 20.9 or newer](https://nodejs.org/). 22 LTS is recommended; run `nvm use` to pick up `.nvmrc`.
- [Git](https://git-scm.com/downloads).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) for the database, or your own PostgreSQL 13+.

```bash
git clone https://github.com/Bodavulajahnavi/penny.git
cd penny
npm install
docker compose up -d           # starts PostgreSQL in the background
cp .env.example .env           # Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

Open **http://localhost:3000**. The database tables and demo data are created automatically on the first visit, so there is no migration step.

- **Using your own PostgreSQL instead of Docker:** create an empty database (for example `createdb app_db`). Then set `DATABASE_URL` in `.env`, for example `postgresql://USER:PASSWORD@localhost:5432/app_db`.
- **Production mode:** `npm run build`, then `npm start`.
- **Stop the database:** `docker compose down`. Add `-v` to also delete its data.

## Demo account

| Email | Password |
| --- | --- |
| `demo@example.com` | `demo1234` |

- Opening the app signs you into the demo automatically. Sign out from **Settings** or the account menu to reach the sign-in and sign-up screens.
- The demo has five months of history plus day-by-day transactions this month across Food, Rent, Transport, Entertainment, and Salary.
- It refreshes once a day, so the current month is never empty.
- Its email and password can't be changed, so the login keeps working for everyone.
- **Create your own account** for a private, empty workspace.

## Running the tests

```bash
# Django: inside python/ with the virtual environment active
python manage.py test tracker

# Next.js
npm run lint
npx next typegen && npx tsc --noEmit
npm run build

# End-to-end browser tests: start the app first, then
npx playwright install chromium
node scripts/smoke-test.mjs              # Next.js on http://localhost:3000 (override with APP_URL)
node scripts/smoke-test.mjs --python     # Django on http://localhost:8000 (override with PYTHON_URL)
```

The browser suite drives the real UI and fails on any console, page, or server error. It covers:

- The dashboard and charts.
- Transaction create, edit, and delete, including reload persistence.
- Budgets, filters, pagination, and month navigation.
- Reports and CSV download.
- Profile and password changes.
- Login validation and sign-up.
- Mobile layout.
- Running inside an embedded iframe (Next.js edition).

It creates one disposable `jamie-<timestamp>@example.com` account.

On every push and pull request, [GitHub Actions](.github/workflows/ci.yml) runs:

- Lint, type checks, and the production build.
- A first-run start against an empty PostgreSQL database.
- The Django checks and tests.

## Configuration

**Python edition:** copy `python/.env.example` to `python/.env` and adjust as needed.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEBUG` | `True` | Set to `False` in production. |
| `SECRET_KEY` | auto-generated | Generated once into `python/.django-secret-key` while `DEBUG=True`. Required when `DEBUG=False`. |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1],testserver` | Comma-separated hostnames. |
| `CSRF_TRUSTED_ORIGINS` | none | HTTPS origins, when deployed behind a domain. |
| `TRUST_X_FORWARDED_PROTO` | `False` | Enable only behind a proxy that always overwrites `X-Forwarded-Proto`. |

To deploy, run `python manage.py check --deploy` and `python manage.py collectstatic`, then serve with `gunicorn config.wsgi`. The Django admin is at `/admin/` (create a login with `python manage.py createsuperuser`).

**Next.js edition:** `.env` needs only `DATABASE_URL`; see `.env.example`.

## Tech stack

| | Python edition | Next.js edition |
| --- | --- | --- |
| Backend | Django 5.2 + Django REST Framework | Next.js 16 App Router route handlers |
| Database | SQLite | PostgreSQL + Drizzle ORM |
| Frontend | Django templates + vanilla JavaScript | React 19 + TypeScript |
| Styling | Tailwind CSS v4 (precompiled stylesheet) | Tailwind CSS v4 |
| Charts | Chart.js | Chart.js via react-chartjs-2 |
| Auth | Django sessions + CSRF middleware | Hashed session tokens in an HttpOnly cookie |

### How it works

- **Money:** stored as integer cents, so totals never suffer floating-point rounding.
- **Privacy:** every query is scoped to the signed-in user.
- **Validation:** amounts, categories, dates, and income/expense rules are checked on the server. The Django models also enforce database check constraints.
- **Sessions (Next.js):**
  - A random 256-bit token in an HttpOnly cookie. Only its SHA-256 hash is stored.
  - Over HTTPS, the cookie is `SameSite=None; Secure; Partitioned`, so the app also works inside iframes such as editor preview panes.
  - If a browser blocks the cookie entirely, that browser tab keeps the session instead.
  - Write requests must be same-origin JSON, which blocks cross-site request forgery.
- **One design system:** both editions use the stylesheet in `src/app/globals.css`. After changing it, run `node scripts/build-python-css.mjs` to rebuild the Django copy.
- **No CDNs:** Chart.js and the Inter font are bundled.

### API

| Next.js | Django | Purpose |
| --- | --- | --- |
| `GET /api/health` | `GET /api/health/` | Health check |
| `GET` / `POST /api/auth` | `GET` / `POST /api/auth/` | Current user; `signup`, `login`, `demo`, `logout` |
| `GET /api/dashboard?month=YYYY-MM` | `GET /api/dashboard/?month=YYYY-MM` | Transactions, budgets, totals, six-month trend |
| `POST /api/transactions` | `GET` / `POST /api/transactions/` | List (Django) or create transactions |
| `PATCH` / `DELETE /api/transactions/:id` | `PATCH` / `DELETE /api/transactions/:id/` | Edit or delete a transaction |
| `PUT /api/budgets` | `PUT /api/budgets/` | Set a monthly limit (0 removes it) |
| `DELETE /api/budgets?id=:id` | `DELETE /api/budgets/?id=:id` | Remove a budget |
| `PATCH /api/profile` | `PATCH /api/profile/` | Update name, email, currency, or password |
| CSV built in the browser | `GET /api/export/?month=YYYY-MM` | Export transactions |

## Project structure

```text
penny/
├── python/                     # Python edition (self-contained)
│   ├── config/                 #   Django settings, URLs, WSGI
│   ├── tracker/                #   models, REST API, demo data, tests, templates, static assets
│   ├── manage.py
│   └── requirements.txt
├── src/                        # Next.js edition
│   ├── app/                    #   pages, API routes, global styles
│   ├── components/             #   dashboard, charts, tables, forms, dialogs
│   ├── db/                     #   Drizzle schema and connection
│   └── lib/                    #   sessions, API client, validation, demo data, DB bootstrap
├── scripts/                    # browser smoke tests, Django stylesheet build
├── docs/screenshots/           # images used in this README
├── docker-compose.yml          # PostgreSQL for the Next.js edition
└── requirements.txt            # Python dependencies (same as python/requirements.txt)
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `python3 -m venv` fails with "ensurepip is not available" (Debian/Ubuntu) | `sudo apt install python3-venv`, then run it again. |
| PowerShell: "running scripts is disabled on this system" | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or in Command Prompt use `.venv\Scripts\activate.bat`. |
| `python` or `pip` is not recognized (Windows) | Use `py` instead, for example `py -m pip install -r requirements.txt` and `py manage.py runserver`. |
| "That port is already in use" | Use another port: `python manage.py runserver 8001` or `npm run dev -- -p 3001`. |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL isn't running. Run `docker compose up -d` and wait a few seconds, or start your own server. Check `DATABASE_URL` in `.env`. |
| Docker: "port 5432 is already allocated" | A local PostgreSQL already uses that port. Use it directly by updating `DATABASE_URL`, or change the mapping in `docker-compose.yml` to `"5433:5432"` and use `...@127.0.0.1:5433/app_db`. |
| `password authentication failed` | The user and password in `DATABASE_URL` don't match your PostgreSQL server. |
| Start over with fresh data | **Django:** stop the server, delete `python/db.sqlite3`, and run `python manage.py migrate`. **Next.js:** `docker compose down -v`, then `docker compose up -d`. |
| Edited `src/app/globals.css` but the Django edition looks unchanged | Run `node scripts/build-python-css.mjs` (after `npm install`). |

## License

[MIT](LICENSE). Bundled third-party assets keep their own licenses:

- [Chart.js](https://www.chartjs.org/): MIT.
- [Inter](https://rsms.me/inter/): SIL Open Font License 1.1.
- [Lucide](https://lucide.dev/) icons: ISC.

The license texts for the bundled Chart.js and Inter files are in `python/tracker/static/tracker/`.

Built with a little care, for a little more peace of mind.
