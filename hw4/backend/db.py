from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "campus_customs.db"

STUB_MARKER = "filename-based stub"


def _images_version() -> str:
    """Changes whenever the product photos change, so browsers never keep showing old pictures."""
    for folder in (DATA_DIR / "products_web", DATA_DIR / "products"):
        if folder.is_dir():
            return str(int(max((f.stat().st_mtime for f in folder.glob("*.jpg")), default=0)))
    return "0"


IMAGE_VERSION = _images_version()


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def category_for(garment_type: str) -> str:
    """Collapse the 22 inconsistent garment_type values into shop filter categories."""
    g = garment_type.lower()
    if "t-shirt" in g:
        return "T-shirts"
    if "quarter-zip" in g:
        return "Quarter-zips"
    if "jacket" in g:
        return "Jackets"
    if "hood" in g:
        return "Hoodies"
    if "crew" in g:
        return "Crewnecks"
    return "More"


def product_from_row(row: sqlite3.Row) -> dict:
    description = row["description"]
    if STUB_MARKER in description:
        description = f"Officially licensed {row['name']} from Campus Customs."
    return {
        "product_id": row["product_id"],
        "name": row["name"],
        "garment_type": row["garment_type"],
        "category": category_for(row["garment_type"]),
        "description": description,
        "colors": json.loads(row["colors"]),
        "price": row["price"],
        "image_url": f"/media/{row['image_file_path']}?v={IMAGE_VERSION}",
    }


SIZE_ORDER = "CASE size WHEN 'XS' THEN 0 WHEN 'S' THEN 1 WHEN 'M' THEN 2 WHEN 'L' THEN 3 WHEN 'XL' THEN 4 WHEN 'XXL' THEN 5 ELSE 6 END"


# Home-page collections. Each is a rule over the product name (the catalogue has no collection column).
COLLECTION_RULES: dict[str, re.Pattern[str]] = {
    "colleges": re.compile(
        r"\b(berkeley|branford|benjamin franklin|davenport|grace hopper|jonathan edwards|morse|pauli murray|"
        r"pierson|saybrook|silliman|timothy dwight|trumbull|ezra stiles)\b",
        re.I,
    ),
    "sports": re.compile(
        r"\b(baseball|basketball|football|hockey|soccer|tennis|golf|diving|swimming|volleyball|lacrosse|"
        r"squash|sailing|fencing|track|sports|crew left chest)\b",
        re.I,
    ),
    "schools": re.compile(r"\bschool\b", re.I),
    "family": re.compile(r"\b(mom|dad|grandma|grandpa|aunt|uncle|cousin|brother|sister)\b", re.I),
}
WARM_CATEGORIES = {"Hoodies", "Jackets"}
COLLECTION_KEYS = [*COLLECTION_RULES, "warm"]


def in_collection(product: dict, collection: str) -> bool:
    if collection == "warm":
        return product["category"] in WARM_CATEGORIES
    return bool(COLLECTION_RULES[collection].search(product["name"]))


def list_products(collection: str | None = None) -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
    stock = inventory_by_product()
    products = [product_from_row(r) for r in rows]
    if collection:
        products = [p for p in products if in_collection(p, collection)]
    for p in products:
        p["inventory"] = stock.get(p["product_id"], [])
    return products


USER_FIELDS = "id, name, email, first_name, last_name"


def public_user(row: sqlite3.Row) -> dict:
    first = row["first_name"] or row["name"].split(" ")[0]
    return {
        "id": row["id"],
        "email": row["email"],
        "first_name": first,
        "last_name": row["last_name"] or "",
        "name": row["name"],
    }


def find_user_by_email(email: str) -> sqlite3.Row | None:
    with connect() as conn:
        return conn.execute(
            f"SELECT {USER_FIELDS}, password_hash FROM users WHERE lower(email) = lower(?)", (email,)
        ).fetchone()


def get_user(user_id: int) -> sqlite3.Row | None:
    with connect() as conn:
        return conn.execute(f"SELECT {USER_FIELDS} FROM users WHERE id = ?", (user_id,)).fetchone()


def create_user(first_name: str, last_name: str, email: str, password_hash: str) -> sqlite3.Row | None:
    """Insert a user; returns None if the email is already taken."""
    with connect() as conn:
        if conn.execute("SELECT 1 FROM users WHERE lower(email) = lower(?)", (email,)).fetchone():
            return None
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
            (f"{first_name} {last_name}", email, password_hash, first_name, last_name),
        )
        return conn.execute(f"SELECT {USER_FIELDS} FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()


def inventory_by_product() -> dict[str, list[dict]]:
    with connect() as conn:
        rows = conn.execute(
            f"SELECT product_id, size, quantity FROM inventory ORDER BY product_id, {SIZE_ORDER}"
        ).fetchall()
    stock: dict[str, list[dict]] = {}
    for r in rows:
        stock.setdefault(r["product_id"], []).append({"size": r["size"], "quantity": r["quantity"]})
    return stock


def raw_catalogue() -> list[sqlite3.Row]:
    with connect() as conn:
        return conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()


def save_chat_message(user_id: int, role: str, content: str, products: list[dict] | None = None) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, ?, ?, ?)",
            (user_id, role, content, json.dumps(products) if products is not None else None),
        )


def chat_history(user_id: int, limit: int) -> list[dict]:
    """Most recent `limit` messages for a user, oldest first."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT role, content, products_json, created_at FROM chat_messages "
            "WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    history = []
    for r in reversed(rows):
        # Rebuild cards from live data: stored JSON can be stale or from an older format.
        stored = json.loads(r["products_json"]) if r["products_json"] else []
        ids = [p["product_id"] for p in stored if isinstance(p, dict) and "product_id" in p]
        cards = [p for p in (get_product(pid) for pid in ids) if p is not None]
        history.append({"role": r["role"], "content": r["content"], "products": cards, "created_at": r["created_at"]})
    return history


def get_product(product_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None:
            return None
        stock = conn.execute(
            f"SELECT size, quantity FROM inventory WHERE product_id = ? ORDER BY {SIZE_ORDER}",
            (product_id,),
        ).fetchall()
    product = product_from_row(row)
    product["inventory"] = [{"size": s["size"], "quantity": s["quantity"]} for s in stock]
    return product
