# Usability Improvements (Problem 9)

Two front-end improvements and two agent/backend improvements. Details of how each works are in `harness.md`.

## Front end

### 1. Search and sort on the Products page

**What I added:** A search box and a sort menu (Name A–Z, Price low to high, Price high to low) above the category buttons. Typing filters the grid instantly by name, category, type, description and color, so "navy hockey" finds the navy hockey items. It works together with the category buttons and also filters the results the chat puts on the page. If nothing matches, the page says so and offers a **Clear search** button.

**Why it helps:**
- **Shopper:** With 102 items, scrolling a grid is slow. Shoppers can jump straight to what they want, and sorting by price answers "what's cheapest?" without asking anyone.
- **Business:** Shoppers who find something quickly are more likely to buy, and a clear "nothing matches" message keeps them from leaving on a blank page.

### 2. Suggested questions in the chat

**What I added:** A new chat window shows tap-to-send question chips ("What hoodies do you have?", "Anything with a bulldog on it?", "What's your cheapest item?", "Show me crewnecks"). On a product page the chips change to "Do you have this in other colors?", "Which sizes are in stock?" and "How much is this?". The chat also shows a clear message if the shopper is sending messages too fast.

**Why it helps:**
- **Shopper:** An empty chat box doesn't say what the assistant can do. The chips show it and let people start with one tap, which is easy on a phone.
- **Business:** More visitors actually use the assistant, and the suggested questions steer them toward the things the store can answer well: browsing, price and stock.

## Agent / backend

### 3. `compare_products` tool

**What I added:** A new agent tool that compares 2 to 4 items side by side (price, colors, description, sizes in stock and sold out, cheapest item and price gap). The prompt now tells the agent to use it for "X or Y?", "what's the difference?" and "which is cheaper?", and to keep the answer short. If a name is unclear, the tool returns candidates and the agent asks which item was meant.

**Why it helps:**
- **Shopper:** Choosing between two similar items is the most common shopping question. They get one clear answer, for example "$23 cheaper, and it has M in stock", instead of having to open two pages.
- **Business:** The price gap and stock are worked out by code from the database, so the agent can't get them wrong or promise a size that's sold out. It also needs fewer model steps than several separate lookups, which is faster and cheaper per answer.

### 4. Chat rate limit

**What I added:** Each logged-in shopper, or each guest by IP address, can send 10 chat messages a minute. Going over returns a "please wait" message (HTTP 429). The check runs before the AI model is called.

**Why it helps:**
- **Shopper:** One person's loop, script or stuck Enter key can't slow the assistant down for everyone else, and normal chatting never gets near the limit.
- **Business:** Every chat message is a paid call to the AI model. The limit caps the cost of accidents and abuse, and blocked requests cost nothing.

## How each was checked

All four are checked automatically in real Chrome against the live site. The screenshots and results are in `app_check.html`.

| Improvement | Check |
|---|---|
| Search and sort | Typing "navy hockey" narrowed 102 items to 5; price sort was verified in both directions; a nonsense search showed the "Nothing matches" message and Clear search restored all 102. |
| Suggested questions | A fresh chat showed the 4 chips; clicking one sent the question and filled the page with the matching hoodies. |
| `compare_products` | Compared two hoodies through the live agent; both prices and the $23 gap matched the database. |
| Rate limit | A burst of 12 messages returned answers for some and HTTP 429 for the rest; the chat box showed the "please wait" message. |
