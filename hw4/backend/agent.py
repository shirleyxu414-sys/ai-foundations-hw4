"""Campus Customs shop agent: PydanticAI + OpenAI Responses API through the Portkey gateway."""

from __future__ import annotations

import logging
import os
import re
import time
from pathlib import Path

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

from openai import AsyncOpenAI  # noqa: E402
from pydantic_ai import Agent, ModelRetry, RunContext  # noqa: E402
from pydantic_ai.exceptions import ModelHTTPError, UnexpectedModelBehavior, UsageLimitExceeded  # noqa: E402
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, ToolCallPart, UserPromptPart  # noqa: E402
from pydantic_ai.models.openai import OpenAIResponsesModel  # noqa: E402
from pydantic_ai.providers.openai import OpenAIProvider  # noqa: E402
from pydantic_ai.usage import UsageLimits  # noqa: E402

import audit  # noqa: E402
import db  # noqa: E402
from models import ChatResponse, PageContext, PageResults, ProductCard, ShopDeps, ShopReply  # noqa: E402
from tools import SHOP_TOOLS  # noqa: E402

HERE = Path(__file__).resolve().parent
PROMPT_PATH = HERE / "prompts" / "prompt.md"
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-5.6-luna").strip() or "gpt-5.6-luna"
PORTKEY_BASE_URL = os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1").rstrip("/")
MAX_MODEL_REQUESTS = 8
MAX_CARDS = 30
SHOP_TOOL_NAMES = {t.__name__ for t in SHOP_TOOLS}
PRICE_RE = re.compile(r"\$\s?(\d+(?:\.\d{1,2})?)")
QTY_RE = re.compile(r"\b(\d+)\s*(?:\*\*)?\s*(?:left|in stock|available|units?|pieces?)\b", re.IGNORECASE)

log = logging.getLogger("campus_customs.agent")
_agent: Agent[ShopDeps, ShopReply] | None = None


def _build_agent() -> Agent[ShopDeps, ShopReply]:
    api_key = os.getenv("PORTKEY_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("PORTKEY_API_KEY is not set (put it in a .env file).")
    client = AsyncOpenAI(
        api_key=api_key,
        base_url=PORTKEY_BASE_URL,
        default_headers={"x-portkey-api-key": api_key},
    )
    agent = Agent(
        OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client)),
        deps_type=ShopDeps,
        output_type=ShopReply,
        instructions=PROMPT_PATH.read_text(encoding="utf-8"),
        tools=SHOP_TOOLS,
        retries=2,
    )

    @agent.instructions
    def shopper_context(ctx: RunContext[ShopDeps]) -> str:
        d = ctx.deps
        if d.user_id is None:
            return "The shopper is browsing as a guest (not logged in). You know nothing about them and have no saved history."
        full = f"{d.first_name} {d.last_name}".strip()
        return (
            f"The shopper is logged in. Name: {full}. Email: {d.email}. "
            "Earlier messages in this conversation are their saved chat history from past visits. "
            "Greet them by first name when it fits."
        )

    @agent.instructions
    def page_context(ctx: RunContext[ShopDeps]) -> str:
        d = ctx.deps
        lines = [f"Where the shopper is on the website right now: the {d.page} page."]
        if d.current_product:
            p = d.current_product
            lines.append(
                f"They are looking at the product page for \"{p['name']}\" (product_id={p['product_id']}). "
                "Words like \"this\", \"it\", \"this one\" or \"this hoodie\" mean that product unless they name another. "
                "Still look up price, stock and colors with your tools."
            )
        if d.visible_products:
            names = "; ".join(f"{i}. {p['name']} (product_id={p['product_id']})" for i, p in enumerate(d.visible_products, 1))
            lines.append(
                "The product grid on screen shows, in order: " + names + ". "
                "\"The first one\", \"the cheapest of these\" or \"these\" refer to that grid."
            )
        return " ".join(lines)

    @agent.output_validator
    def grounded(ctx: RunContext[ShopDeps], out: ShopReply) -> ShopReply:
        """Reject replies that quote a price or stock count no tool returned this turn."""
        products = [p for p in (db.get_product(pid) for pid in ctx.deps.seen_product_ids) if p]
        prices = {round(p["price"], 2) for p in products} | ctx.deps.extra_prices
        prices |= {round(abs(a - b), 2) for a in list(prices) for b in list(prices) if a != b}  # compare_products price gaps
        counts = {s["quantity"] for p in products for s in p["inventory"]}
        counts |= {sum(s["quantity"] for s in p["inventory"]) for p in products}
        bad_prices = [m for m in PRICE_RE.findall(out.reply) if round(float(m), 2) not in prices]
        bad_counts = [m for m in QTY_RE.findall(out.reply) if int(m) not in counts]
        if bad_prices or bad_counts:
            ctx.deps.grounding_rejections += 1
            problems = [f"${m}" for m in bad_prices] + [f"{m} in stock/left" for m in bad_counts]
            raise ModelRetry(
                f"Your reply mentions {', '.join(problems)}, which no tool returned for these items. "
                "Look the item up with get_price or check_stock and use only those numbers."
            )
        return out

    return agent


def get_agent() -> Agent[ShopDeps, ShopReply]:
    global _agent
    if _agent is None:
        _agent = _build_agent()
    return _agent


def _to_history(turns: list[dict]) -> list[ModelMessage]:
    history: list[ModelMessage] = []
    for t in turns:
        if t["role"] == "user":
            history.append(ModelRequest(parts=[UserPromptPart(content=t["content"])]))
        else:
            history.append(ModelResponse(parts=[TextPart(content=t["content"])]))
    return history


def _cards(product_ids: list[str], seen: set[str]) -> list[ProductCard]:
    """Build cards from the DB, keeping only ids the tools actually returned this turn."""
    cards: list[ProductCard] = []
    for pid in dict.fromkeys(product_ids):
        if pid not in seen:
            continue
        product = db.get_product(pid)
        if product is not None:
            cards.append(ProductCard(**product))
        if len(cards) == MAX_CARDS:
            break
    return cards


def _apply_context(deps: ShopDeps, context: PageContext | None) -> None:
    """Copy page context into deps, keeping only products that really exist in the database."""
    if context is None:
        return
    deps.page = context.page
    if context.product_id:
        deps.current_product = db.get_product(context.product_id)
        if deps.current_product:
            deps.seen_product_ids.add(context.product_id)
    for pid in dict.fromkeys(context.visible_product_ids):
        product = db.get_product(pid)
        if product:
            deps.visible_products.append(product)
            deps.seen_product_ids.add(pid)


def _record(deps: ShopDeps, started: float, message: str, stopped: str, requests: int | None, cards: int, reply: str) -> None:
    """Append one entry to the audit trail: what the agent did for this request and why it stopped."""
    audit.append_entry(
        {
            "time": audit.now(),
            "event": "chat",
            "user": deps.user_id if deps.user_id is not None else "guest",
            "page": deps.page,
            "model": MODEL_NAME,
            "message_chars": len(message),
            "tool_calls": deps.calls,
            "model_requests": requests,
            "grounding_rewrites": deps.grounding_rejections,
            "cards_shown": cards,
            "reply_chars": len(reply),
            "stopped": stopped,
            "duration_ms": round((time.monotonic() - started) * 1000),
        }
    )


BLOCKED_REPLY = (
    "I'm not able to respond to that message here, but I'm happy to help with Campus Customs shopping. "
    "If you're going through something difficult or feel unsafe, please reach out to campus counseling, "
    "call or text 988 (US), or call 911 in an emergency. 💙"
)


def _is_content_filtered(exc: Exception) -> bool:
    """The model provider's own safety filter refused the message (HTTP 400, content policy)."""
    return isinstance(exc, ModelHTTPError) and exc.status_code == 400 and "content management policy" in str(exc)


def _stop_reason(exc: Exception) -> str:
    if _is_content_filtered(exc):
        return "stopped: message blocked by the model provider's content filter"
    if isinstance(exc, UsageLimitExceeded):
        return f"stopped: request limit reached ({MAX_MODEL_REQUESTS} model calls)"
    if isinstance(exc, UnexpectedModelBehavior):
        return "stopped: reply kept failing the price/stock check or the format"
    return f"stopped: error ({type(exc).__name__})"


async def run_chat(
    message: str, history: list[dict], user: dict | None = None, context: PageContext | None = None
) -> ChatResponse:
    started = time.monotonic()
    deps = ShopDeps()
    _apply_context(deps, context)
    if user:
        deps.user_id, deps.first_name, deps.last_name, deps.email = (
            user["id"], user["first_name"], user["last_name"], user["email"],
        )
    try:
        run = await get_agent().run(
            message,
            message_history=_to_history(history),
            deps=deps,
            usage_limits=UsageLimits(request_limit=MAX_MODEL_REQUESTS),
        )
    except Exception as exc:
        if _is_content_filtered(exc):
            log.warning("message blocked by the provider's content filter")
            reply = BLOCKED_REPLY
        else:
            log.exception("agent run failed")
            reply = "Sorry, I hit a snag reaching the stockroom. Please try again in a moment. 💙"
        _record(deps, started, message, _stop_reason(exc), None, 0, reply)
        return ChatResponse(reply=reply)

    finish = next((m.finish_reason for m in reversed(run.new_messages()) if isinstance(m, ModelResponse)), None)
    tools_used = list(
        dict.fromkeys(
            p.tool_name
            for m in run.new_messages()
            if isinstance(m, ModelResponse)
            for p in m.parts
            if isinstance(p, ToolCallPart) and p.tool_name in SHOP_TOOL_NAMES
        )
    )
    out = run.output
    cards = _cards(out.product_ids, deps.seen_product_ids)
    page = None
    if out.show_on_page and len(cards) >= 2:
        page = PageResults(title=(out.page_title or "Matching items").strip()[:60], query=message, products=cards)
    _record(deps, started, message, f"final answer (finish_reason={finish or 'stop'})", run.usage.requests, len(cards), out.reply)
    return ChatResponse(reply=out.reply, products=cards, page=page, tools_used=tools_used)
