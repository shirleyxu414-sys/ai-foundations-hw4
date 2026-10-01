"""Pydantic / PydanticAI structured types shared by the API, agent, and tools."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field

SIZES = ["XS", "S", "M", "L", "XL", "XXL"]


class SizeStock(BaseModel):
    size: str
    quantity: int


class Product(BaseModel):
    product_id: str
    name: str
    garment_type: str
    category: str
    description: str
    colors: list[str]
    price: float
    image_url: str


class ProductCard(Product):
    """A product with stock by size. Built from the database, never by the model."""

    inventory: list[SizeStock]


class ProductHit(BaseModel):
    """Compact product summary that search_products returns to the model."""

    product_id: str
    name: str
    category: str
    price: float
    colors: list[str]
    in_stock_sizes: list[str]
    sold_out_sizes: list[str]
    description: str


class SearchResult(BaseModel):
    total_matches: int
    returned: int
    note: str = ""
    products: list[ProductHit] = Field(default_factory=list)


StockStatus = Literal["in stock", "low stock", "sold out"]


class Candidate(BaseModel):
    product_id: str
    name: str


class LookupFailure(BaseModel):
    """Returned instead of data when a product can't be pinned down, so the model never guesses."""

    error: str
    candidates: list[Candidate] = Field(default_factory=list)


class ProductDescription(BaseModel):
    product_id: str
    name: str
    garment_type: str
    description: str
    colors: list[str]


class PriceInfo(BaseModel):
    product_id: str
    name: str
    price_usd: float
    currency: Literal["USD"] = "USD"


class SizeStockStatus(BaseModel):
    size: str
    quantity: int
    status: StockStatus
    label: str = Field(description='Shopper-facing wording, e.g. "sold out", "only 2 left", "in stock"')


class StockReport(BaseModel):
    product_id: str
    name: str
    requested_size: str | None = None
    sizes: list[SizeStockStatus]
    sizes_in_stock: list[str]
    sizes_sold_out: list[str]
    total_in_stock: int


class ComparedItem(BaseModel):
    product_id: str
    name: str
    category: str
    price_usd: float
    colors: list[str]
    sizes_in_stock: list[str]
    sizes_sold_out: list[str]
    description: str


class ProductComparison(BaseModel):
    items: list[ComparedItem]
    cheapest_product_ids: list[str] = Field(description="Ids tied for the lowest price")
    price_difference_usd: float = Field(description="Highest price minus lowest price")
    not_found: list[str] = Field(default_factory=list, description="Requested names that matched nothing or were ambiguous")
    note: str = ""


class CategorySummary(BaseModel):
    items: int
    min_price: float
    max_price: float


class CatalogueOverview(BaseModel):
    total_products: int
    categories: dict[str, CategorySummary]
    sizes: list[str]


class ShopReply(BaseModel):
    """The agent's structured final answer."""

    reply: str = Field(description="Friendly answer to the shopper, in Markdown. Keep it short.")
    product_ids: list[str] = Field(
        default_factory=list,
        description=(
            "product_id values (copied exactly from tool results) of the items to show as cards, "
            "most relevant first. Up to 30 for a browse question, otherwise just the items discussed. "
            "Empty if no products apply."
        ),
    )
    show_on_page: bool = Field(
        default=False,
        description=(
            "True when the shopper is browsing a type of item (e.g. 'what hoodies do you have?', "
            "'anything with a bulldog?') and the matches should fill the website's product grid. "
            "False for questions about one specific item, greetings or account questions."
        ),
    )
    page_title: str | None = Field(
        default=None,
        description="Short heading for the product grid when show_on_page is true, e.g. 'Hoodies' or 'Bulldog gear'.",
    )


@dataclass
class ShopDeps:
    """Per-request context handed to tools and dynamic instructions."""

    user_id: int | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    calls: list[dict] = field(default_factory=list)  # audit record of each tool call this request
    grounding_rejections: int = 0  # times the reply check sent the answer back for a rewrite
    current_product: dict | None = None
    visible_products: list[dict] = field(default_factory=list)
    page: str = "other"
    seen_product_ids: set[str] = field(default_factory=set)
    extra_prices: set[float] = field(default_factory=set)  # price-range figures from catalogue_overview


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class PageContext(BaseModel):
    """What the shopper is looking at when they send a message. Ids are re-checked against the database."""

    page: Literal["home", "products", "product", "about", "login", "signup", "other"] = "other"
    product_id: str | None = Field(default=None, max_length=120)
    visible_product_ids: list[str] = Field(default_factory=list, max_length=30)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    context: PageContext = Field(default_factory=PageContext)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=20)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list)


class PageResults(BaseModel):
    """Search results the website shows in its main product grid."""

    title: str
    query: str
    products: list[ProductCard]


class ChatResponse(BaseModel):
    reply: str
    products: list[ProductCard] = Field(default_factory=list)
    page: PageResults | None = None
    tools_used: list[str] = Field(default_factory=list)
