"""Tools the shop agent can call. Every price and stock number comes from campus_customs.db."""

from __future__ import annotations

import functools
import json
import re
from typing import Literal

from pydantic_ai import RunContext

import audit
import db
from models import (
    SIZES,
    CatalogueOverview,
    ComparedItem,
    ProductComparison,
    CategorySummary,
    Candidate,
    LookupFailure,
    PriceInfo,
    ProductDescription,
    ProductHit,
    SearchResult,
    ShopDeps,
    SizeStockStatus,
    StockReport,
)

LOW_STOCK = 3
CATEGORIES = ["Hoodies", "Crewnecks", "T-shirts", "Quarter-zips", "Jackets", "More"]
STOPWORDS = {
    "a", "an", "and", "any", "anything", "are", "do", "for", "have", "i", "im", "in", "is", "it",
    "me", "my", "of", "on", "or", "show", "some", "something", "the", "to", "u", "want", "with",
    "you", "your", "got", "what", "whats", "which", "looking", "item", "items", "yale",
}
SYNONYMS = {"tee": "shirt", "tees": "shirt", "tshirt": "shirt", "sweater": "sweatshirt", "hoody": "hoodie"}


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _stem(word: str) -> str:
    word = SYNONYMS.get(word, word)
    if len(word) > 3 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def _query_terms(query: str) -> list[str]:
    return list(dict.fromkeys(_stem(w) for w in _words(query) if w not in STOPWORDS and len(w) > 1))


def _searchable(row) -> set[str]:
    tags = " ".join(json.loads(row["search_tags"]))
    colors = " ".join(json.loads(row["colors"]))
    text = f"{row['name']} {row['garment_type']} {row['description']} {colors} {tags}"
    return {_stem(w) for w in _words(text)}


def _hit(product: dict, stock: list[dict]) -> ProductHit:
    desc = product["description"]
    return ProductHit(
        product_id=product["product_id"],
        name=product["name"],
        category=product["category"],
        price=product["price"],
        colors=product["colors"],
        in_stock_sizes=[s["size"] for s in stock if s["quantity"] > 0],
        sold_out_sizes=[s["size"] for s in stock if s["quantity"] == 0],
        description=desc if len(desc) <= 160 else desc[:159].rstrip() + "…",
    )


def search_products(
    ctx: RunContext[ShopDeps],
    query: str = "",
    category: str | None = None,
    color: str | None = None,
    max_price: float | None = None,
    size: str | None = None,
    sort: Literal["relevance", "price_low", "price_high"] = "relevance",
    limit: int = 8,
) -> SearchResult:
    """Search the Campus Customs catalogue.

    Args:
        query: Keywords such as a college, sport, school, theme or style ("hockey hoodie",
            "Berkeley", "bulldog", "fleece"). Leave empty to browse by the other filters.
        category: One of Hoodies, Crewnecks, T-shirts, Quarter-zips, Jackets, More.
        color: Only items offered in this color (e.g. "navy", "gray").
        max_price: Only items at or below this price in USD.
        size: Only items with this size in stock (XS, S, M, L, XL, XXL).
        sort: "relevance" (default), "price_low" or "price_high".
        limit: Max products to return (1-30). Use 30 when the shopper is browsing a whole type
            of item, like "what hoodies do you have?".
    """
    limit = max(1, min(limit, 30))
    stock = db.inventory_by_product()
    terms = _query_terms(query)
    size = size.upper().strip() if size else None
    notes: list[str] = []
    if size and size not in SIZES:
        notes.append(f"Unknown size '{size}'; sizes are {', '.join(SIZES)}. Size filter ignored.")
        size = None

    scored: list[tuple[int, dict, list[dict]]] = []
    sold_out_in_size: list[tuple[int, dict]] = []
    for row in db.raw_catalogue():
        product = db.product_from_row(row)
        pstock = stock.get(product["product_id"], [])
        if category and product["category"].lower() != category.lower():
            continue
        if color and not any(color.lower() in c.lower() for c in product["colors"]):
            continue
        if max_price is not None and product["price"] > max_price:
            continue
        score = len(set(terms) & _searchable(row)) if terms else 0
        if size and not any(s["size"] == size and s["quantity"] > 0 for s in pstock):
            sold_out_in_size.append((score, product))
            continue
        scored.append((score, product, pstock))

    if terms:
        full = [t for t in scored if t[0] == len(terms)]
        if full:
            scored = full
        else:
            scored = [t for t in scored if t[0] > 0]
            if scored:
                vocab = set().union(*(_searchable(r) for r in db.raw_catalogue()))
                missing = [t for t in terms if t not in vocab]
                notes.append(
                    "No item matched every keyword; these are partial matches only."
                    + (f" Nothing in the shop mentions: {', '.join(missing)}." if missing else "")
                )

    if sort == "price_low":
        scored.sort(key=lambda t: (t[1]["price"], t[1]["name"]))
    elif sort == "price_high":
        scored.sort(key=lambda t: (-t[1]["price"], t[1]["name"]))
    else:
        scored.sort(key=lambda t: (-t[0], t[1]["name"]))

    if size:
        best = max((sc for sc, _ in sold_out_in_size), default=0)
        hidden = [p["name"] for sc, p in sold_out_in_size if not terms or (sc == len(terms) or (sc and sc == best))]
        if hidden:
            notes.append(
                f"These match but are SOLD OUT in {size} (they exist; say they're sold out in {size}): "
                + "; ".join(hidden[:6])
                + "."
            )

    hits = [_hit(p, s) for _, p, s in scored[:limit]]
    ctx.deps.seen_product_ids.update(h.product_id for h in hits)
    if not scored:
        notes.append("Nothing in the catalogue matches. Do not suggest items that were not returned.")
    return SearchResult(total_matches=len(scored), returned=len(hits), note=" ".join(notes), products=hits)


def _resolve(ctx: RunContext[ShopDeps], product: str) -> dict | LookupFailure:
    """Find one product by exact product_id or by a name that matches every keyword.

    An ambiguous or unknown name returns a LookupFailure (with candidates), so a partial
    match can never answer for a different item.
    """
    found = db.get_product(product.strip())
    if found is None:
        terms = set(_query_terms(product))
        full = [r for r in db.raw_catalogue() if terms and terms <= _searchable(r)] if terms else []
        wanted = " ".join(_words(product))
        exact = [r for r in full if " ".join(_words(r["name"])) == wanted]
        if len(exact) == 1 or len(full) == 1:
            found = db.get_product((exact or full)[0]["product_id"])
        elif full:
            ctx.deps.seen_product_ids.update(r["product_id"] for r in full[:6])
            return LookupFailure(
                error=f"'{product}' matches {len(full)} items. Ask the shopper which one, or retry with a product_id.",
                candidates=[Candidate(product_id=r["product_id"], name=r["name"]) for r in full[:6]],
            )
        else:
            return LookupFailure(error=f"No product matches '{product}'. Use search_products to find the right item.")
    ctx.deps.seen_product_ids.add(found["product_id"])
    return found


def _size_row(size: str, qty: int) -> SizeStockStatus:
    if qty == 0:
        return SizeStockStatus(size=size, quantity=0, status="sold out", label="sold out")
    if qty <= LOW_STOCK:
        return SizeStockStatus(size=size, quantity=qty, status="low stock", label=f"only {qty} left")
    return SizeStockStatus(size=size, quantity=qty, status="in stock", label="in stock")


def get_product_description(ctx: RunContext[ShopDeps], product: str) -> ProductDescription | LookupFailure:
    """What an item looks like: description, garment type and colors.

    Args:
        product: A product_id from a search result, or the product's name.
    """
    p = _resolve(ctx, product)
    if isinstance(p, LookupFailure):
        return p
    return ProductDescription(**{k: p[k] for k in ProductDescription.model_fields})


def get_price(ctx: RunContext[ShopDeps], product: str) -> PriceInfo | LookupFailure:
    """The current price of an item in USD, straight from the database.

    Args:
        product: A product_id from a search result, or the product's name.
    """
    p = _resolve(ctx, product)
    if isinstance(p, LookupFailure):
        return p
    return PriceInfo(product_id=p["product_id"], name=p["name"], price_usd=p["price"])


def check_stock(ctx: RunContext[ShopDeps], product: str, size: str | None = None) -> StockReport | LookupFailure:
    """How many of an item are in stock, for one size or every size. Use for "is X available in size Y?".

    Args:
        product: A product_id from a search result, or the product's name.
        size: XS, S, M, L, XL or XXL. Leave empty to get every size.
    """
    p = _resolve(ctx, product)
    if isinstance(p, LookupFailure):
        return p
    rows = [_size_row(s["size"], s["quantity"]) for s in p["inventory"]]
    requested = size.upper().strip() if size else None
    if requested and requested not in SIZES:
        return LookupFailure(error=f"'{size}' is not a size we make. Sizes run {', '.join(SIZES)}.")
    return StockReport(
        product_id=p["product_id"],
        name=p["name"],
        requested_size=requested,
        sizes=[r for r in rows if r.size == requested] if requested else rows,
        sizes_in_stock=[r.size for r in rows if r.quantity > 0],
        sizes_sold_out=[r.size for r in rows if r.quantity == 0],
        total_in_stock=sum(r.quantity for r in rows),
    )


def compare_products(ctx: RunContext[ShopDeps], products: list[str]) -> ProductComparison | LookupFailure:
    """Compare 2-4 items side by side: price, colors, description and which sizes are in stock.

    Use for "which is better", "what's the difference between X and Y", "X vs Y".

    Args:
        products: 2 to 4 product_ids or product names.
    """
    wanted = list(dict.fromkeys(p.strip() for p in products if p.strip()))[:4]
    if len(wanted) < 2:
        return LookupFailure(error="Give at least two products to compare. Use search_products to find them.")
    items: list[ComparedItem] = []
    not_found: list[str] = []
    for name in wanted:
        found = _resolve(ctx, name)
        if isinstance(found, LookupFailure):
            not_found.append(name)
            continue
        if any(i.product_id == found["product_id"] for i in items):
            continue
        stock = found["inventory"]
        items.append(
            ComparedItem(
                product_id=found["product_id"],
                name=found["name"],
                category=found["category"],
                price_usd=found["price"],
                colors=found["colors"],
                sizes_in_stock=[s["size"] for s in stock if s["quantity"] > 0],
                sizes_sold_out=[s["size"] for s in stock if s["quantity"] == 0],
                description=found["description"],
            )
        )
    if len(items) < 2:
        return LookupFailure(
            error="Couldn't pin down two products to compare. Ask the shopper which items they mean.",
            candidates=[Candidate(product_id=i.product_id, name=i.name) for i in items],
        )
    low = min(i.price_usd for i in items)
    high = max(i.price_usd for i in items)
    return ProductComparison(
        items=items,
        cheapest_product_ids=[i.product_id for i in items if i.price_usd == low],
        price_difference_usd=round(high - low, 2),
        not_found=not_found,
        note="Same price." if high == low else "",
    )


def catalogue_overview(ctx: RunContext[ShopDeps]) -> CatalogueOverview:
    """What the shop carries overall: categories with item counts and price ranges, and sizes."""
    products = db.list_products()
    summary = {}
    for cat in CATEGORIES:
        prices = [p["price"] for p in products if p["category"] == cat]
        if prices:
            summary[cat] = CategorySummary(items=len(prices), min_price=min(prices), max_price=max(prices))
            ctx.deps.extra_prices.update({min(prices), max(prices)})
    return CatalogueOverview(total_products=len(products), categories=summary, sizes=SIZES)


def _summarize(result: object) -> str:
    """One short line describing a tool result, for the audit trail."""
    if isinstance(result, LookupFailure):
        names = ", ".join(c.product_id for c in result.candidates[:3])
        return f"lookup failed: {result.error}" + (f" candidates: {names}" if names else "")
    if isinstance(result, SearchResult):
        ids = ", ".join(p.product_id for p in result.products[:4])
        return f"{result.returned} of {result.total_matches} matches" + (f": {ids}" if ids else "") + (", …" if result.returned > 4 else "")
    if isinstance(result, PriceInfo):
        return f"{result.product_id} ${result.price_usd:.2f}"
    if isinstance(result, ProductDescription):
        return f"{result.product_id}: description and {len(result.colors)} colors"
    if isinstance(result, StockReport):
        detail = ", ".join(f"{r.size}={r.quantity}" for r in result.sizes)
        return f"{result.product_id} {detail}"
    if isinstance(result, ProductComparison):
        ids = ", ".join(i.product_id for i in result.items)
        return f"compared {ids}; price gap ${result.price_difference_usd:.2f}"
    if isinstance(result, CatalogueOverview):
        return f"{result.total_products} products in {len(result.categories)} categories"
    return type(result).__name__


def _audited(fn):
    """Record every call (time, tool, short args, short result) on the request's deps."""

    @functools.wraps(fn)
    def wrapper(ctx: RunContext[ShopDeps], *args, **kwargs):
        started = audit.now()
        call = {"time": started, "tool": fn.__name__, "args": audit.short_args(kwargs)}
        ctx.deps.calls.append(call)
        try:
            result = fn(ctx, *args, **kwargs)
        except Exception as exc:
            call["result"] = f"error: {type(exc).__name__}"
            raise
        call["result"] = audit.short_result(_summarize(result))
        return result

    return wrapper


SHOP_TOOLS = [
    _audited(t)
    for t in (search_products, get_product_description, get_price, check_stock, compare_products, catalogue_overview)
]
