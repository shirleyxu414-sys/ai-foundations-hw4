# Campus Customs

A shopping site for officially licensed Yale apparel with a built-in chatbot, "Bulldog Bot".

- **Front end:** React + Vite + TypeScript (`frontend/`)
- **Back end:** Python FastAPI (`backend/main.py`)
- **Chatbot:** a PydanticAI agent behind FastAPI that answers price and stock questions from a local SQLite database, through the Portkey gateway with the `gpt-5.6-luna` model

Every price and stock number the chatbot gives comes from `data/campus_customs.db`.

## Files

```
hw4/
├── AI_prompts.md          # every prompt typed to the AI coding assistant, by problem
├── requirements.txt       # Python packages
├── .env.example           # names of the secrets (copy to .env)
├── .gitignore
├── README.md
├── frontend/              # Vite React TypeScript app
├── backend/
│   ├── main.py            # FastAPI app: run with uvicorn
│   ├── agent.py           # the agent: model, prompt, reply checks, audit
│   ├── models.py          # Pydantic / PydanticAI types
│   ├── tools.py           # tools the agent can call
│   └── prompts/prompt.md  # system prompt (voice, tool rules, safety rules)
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

Put the data pack in a `data/` folder next to `backend/`:

```
data/
├── campus_customs.db
└── products/              # product photos referenced by the catalogue table
```

## Set up

You need Python 3.11+ and Node 20+.

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

Step 3 is optional: without it the site still works but some photos show their original black backgrounds.

## Run

Two terminals.

```bash
# back end (run from the backend/ folder)
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

```bash
# front end
cd frontend
npm run dev
```

Open **http://localhost:5173**. The front end forwards `/api` and `/media` to the back end on port 8000.

Test login from the database: `test@campuscustoms.yale.edu` (password from the assignment), or create your own account.

## Check the live site

With both servers running:

```bash
cd tests && npm install && node app_check.mjs
```

This drives Chrome through the site, checks answers against the database, and rewrites `output/app_check.html` and its screenshots. It creates one throwaway account and deletes it at the end.

## More detail

`output/harness.md` explains the data, the model fields, the tools, the safety rules and the limits.
