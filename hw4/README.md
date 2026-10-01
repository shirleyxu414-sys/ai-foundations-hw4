# Campus Customs

A shopping site for officially licensed Yale apparel with a built-in chatbot, "Bulldog Bot".

- **Front end:** React + Vite + TypeScript (`frontend/`)
- **Back end:** Python FastAPI (`backend/main.py`)
- **Chatbot:** a PydanticAI agent behind FastAPI that answers price and stock questions from a local SQLite database, through the Portkey gateway with the `gpt-5.6-luna` model

Every price and stock number the chatbot gives comes from `data/campus_customs.db`.

## The agent

**The agent itself is four files under `backend/`:**

| File | What it holds |
|---|---|
| `prompts/prompt.md` | the system prompt: voice, tool rules, reply format and safety rules |
| `agent.py` | the agent entry point: model, prompt loading, reply checks, audit entry |
| `tools.py` | the tools the agent can call (search, description, price, stock, compare, overview) |
| `models.py` | the Pydantic / PydanticAI types for tool results, replies and API bodies |

`main.py` is the FastAPI app that serves the agent (run it with `uvicorn`). `db.py`, `auth.py`, `limits.py` and `audit.py` are plain helpers for the database, logins, rate limiting and the audit trail.

## Files

```
hw4/
├── AI_prompts.md          # every prompt typed to the AI coding assistant, by problem
├── requirements.txt       # Python packages
├── .env.example           # names of the secrets, placeholders only (copy to .env)
├── .gitignore
├── README.md
├── frontend/              # Vite React TypeScript app
├── backend/
│   ├── main.py            # FastAPI app: run with uvicorn main:app --reload --port 8000
│   ├── agent.py           # } the agent:
│   ├── tools.py           # }
│   ├── models.py          # }
│   ├── prompts/prompt.md  # }
│   ├── db.py, auth.py, limits.py, audit.py   # helpers
│   └── scripts/make_web_images.py            # builds white-background photo copies
├── tests/app_check.mjs    # tests the live site in Chrome and writes output/app_check.html
└── output/
    ├── harness.md         # how the whole system works
    ├── design.md          # design changes and why
    ├── usability.md       # the four usability improvements
    ├── app_check.html     # test report with screenshots
    ├── app_check_images/  # screenshots linked from app_check.html
    └── audit_trail.json   # append-only log of what the agent did
```

## Local-only data pack (not in git)

The database and product photos are not in the repository. Before running anything, place the data pack in a `data/` folder inside `hw4/`, next to `backend/` and `frontend/`:

```
hw4/data/
├── campus_customs.db
└── products/              # product photos referenced by the catalogue table
```

## Set up (after placing the data pack)

You need Python 3.11+ and Node 20+. Run these from the `hw4/` folder.

```bash
# 1. secrets: copy the template, then fill in your real values (never commit .env)
cp .env.example .env
#    PORTKEY_API_KEY   your Portkey key
#    SESSION_SECRET    any long random string

# 2. Python environment
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r requirements.txt

# 3. white-background copies of the product photos (writes data/products_web/)
python backend/scripts/make_web_images.py

# 4. front end packages
cd frontend && npm install && cd ..
```

Step 3 is optional: without it the site still works, but some photos show their original black backgrounds.

## Run the back end

In one terminal, from the `backend/` folder:

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

The API is then at http://127.0.0.1:8000 (for example `/api/products`).

## Run the front end

In a second terminal, from the `frontend/` folder:

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**. The front end forwards `/api` and `/media` to the back end on port 8000, so start the back end first.

Test login from the database: `test@campuscustoms.yale.edu` (password from the assignment), or create your own account.

## Check the live site

With both servers running:

```bash
cd tests && npm install && node app_check.mjs
```

This drives Chrome through the site, checks answers against the database, and rewrites `output/app_check.html` and its screenshots. It creates one throwaway account and deletes it at the end.

## More detail

`output/harness.md` explains the data, the model fields, the tools, the safety rules and the limits.
