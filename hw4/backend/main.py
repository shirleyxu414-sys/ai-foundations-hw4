"""Campus Customs API.

Run from this folder:  .venv/bin/uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT.parent / ".env")

from fastapi import Cookie, FastAPI, HTTPException, Request, Response  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from pydantic import BaseModel, field_validator  # noqa: E402

import auth  # noqa: E402
import db  # noqa: E402
from limits import chat_limiter  # noqa: E402
from agent import run_chat  # noqa: E402
from models import ChatMessage, ChatRequest, ChatResponse, ProductCard  # noqa: E402

HISTORY_TURNS = 20

app = FastAPI(title="Campus Customs API")

# Mount only an images folder so the .db file next to it is never web-reachable. Prefer the web
# copies with a consistent white background (backend/scripts/make_web_images.py); the originals
# in data/products/ are never modified.
_web_images = db.DATA_DIR / "products_web"
app.mount(
    "/media/products",
    StaticFiles(directory=_web_images if _web_images.is_dir() else db.DATA_DIR / "products"),
    name="product-images",
)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@app.middleware("http")
async def revalidate_images(request: Request, call_next):
    """Photos may be cached, but the browser must check they are still current (cheap 304 if unchanged)."""
    response = await call_next(request)
    if request.url.path.startswith("/media/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    # FastAPI's default 422 body echoes the submitted value, which would send passwords back.
    errors = [
        {"field": str(e["loc"][-1]), "msg": str(e["msg"]).removeprefix("Value error, ")}
        for e in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


class User(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()


class SignupRequest(LoginRequest):
    first_name: str
    last_name: str

    @field_validator("first_name", "last_name")
    @classmethod
    def required_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 50:
            raise ValueError("must be 1-50 characters")
        return v

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v) or len(v) > 254:
            raise ValueError("enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def strong_enough(cls, v: str) -> str:
        if not 8 <= len(v) <= 128:
            raise ValueError("password must be 8-128 characters")
        return v


def start_session(response: Response, user_id: int) -> None:
    response.set_cookie(
        auth.SESSION_COOKIE,
        auth.make_session(user_id),
        max_age=auth.SESSION_TTL,
        httponly=True,
        samesite="lax",
    )


@app.get("/api/products", response_model=list[ProductCard])
def get_products(collection: Literal["colleges", "sports", "schools", "family", "warm"] | None = None) -> list[dict]:
    """All products, or one home-page collection (colleges, sports, schools, family, warm layers)."""
    return db.list_products(collection)


@app.get("/api/products/{product_id}", response_model=ProductCard)
def get_product(product_id: str) -> dict:
    product = db.get_product(product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.post("/api/auth/signup", response_model=User, status_code=201)
def signup(body: SignupRequest, response: Response) -> dict:
    row = db.create_user(body.first_name, body.last_name, body.email, auth.hash_password(body.password))
    if row is None:
        raise HTTPException(status_code=409, detail="An account with that email already exists.")
    start_session(response, row["id"])
    return db.public_user(row)


@app.post("/api/auth/login", response_model=User)
def login(body: LoginRequest, request: Request, response: Response) -> dict:
    keys = (f"email:{body.email}", f"ip:{request.client.host if request.client else '?'}")
    if auth.is_locked(*keys):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
    row = db.find_user_by_email(body.email)
    if row is None:
        auth.burn_time(body.password)
        ok = False
    else:
        ok = auth.verify_password(body.password, row["password_hash"])
    if not ok:
        auth.record_failure(*keys)
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    auth.clear_failures(keys[0])
    start_session(response, row["id"])
    return db.public_user(row)


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(auth.SESSION_COOKIE)


def current_user(token: str | None) -> dict | None:
    user_id = auth.read_session(token)
    row = db.get_user(user_id) if user_id is not None else None
    return db.public_user(row) if row is not None else None


@app.get("/api/auth/me", response_model=User)
def me(cc_session: str | None = Cookie(default=None)) -> dict:
    user = current_user(cc_session)
    if user is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    return user


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest, request: Request, cc_session: str | None = Cookie(default=None)
) -> ChatResponse:
    """Send one shopper message to the agent and return its reply plus product cards.

    Logged-in shoppers: history is read from and saved to chat_messages.
    Guests: the widget sends the current conversation in `history`; nothing is stored.
    """
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message is empty.")
    user = current_user(cc_session)
    who = f"user:{user['id']}" if user else f"ip:{request.client.host if request.client else '?'}"
    wait = chat_limiter.check(who)
    if wait:
        raise HTTPException(
            status_code=429,
            detail=f"You're sending messages very quickly. Please wait about {wait} seconds and try again.",
            headers={"Retry-After": str(wait)},
        )
    if user is None:
        history = [t.model_dump() for t in body.history[-HISTORY_TURNS:]]
        return await run_chat(message, history, context=body.context)

    history = db.chat_history(user["id"], HISTORY_TURNS)
    result = await run_chat(message, history, user, body.context)
    db.save_chat_message(user["id"], "user", message)
    db.save_chat_message(user["id"], "assistant", result.reply, [p.model_dump() for p in result.products])
    return result


@app.get("/api/chat/history", response_model=list[ChatMessage])
def get_chat_history(cc_session: str | None = Cookie(default=None)) -> list[dict]:
    user = current_user(cc_session)
    return db.chat_history(user["id"], 50) if user else []
