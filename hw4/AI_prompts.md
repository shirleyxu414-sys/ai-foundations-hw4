# AI Prompts Log

One section per problem. Each section has the problem number/title, the prompts I typed (in my own words), and any follow-up prompt I needed. The working site, the saved database changes, and screenshots are the proof of work — no extra essay beyond the prompts.

## Setup / Background

- This is the background info, don't build anything until i give you instructions
- Campus Customs needs a customer-facing website with a built-in chatbot. You will build a React + Vite TypeScript front end and a Python FastAPI backend, powered by a PydanticAI agent. Shoppers can browse products, create an account, and ask the chatbot about merchandise: matching items appear right on the page, and every answer about price and stock comes straight from a local database.
- unzip file in that folder if any
- You are given campus_customs.db with tables for the product catalogue, inventory by size, and users (with hashed passwords). Product image file paths are in the catalogue table. Research yalebulldogblue.com to learn the style of Campus Customs page and information for your agent prompt.
- Use my portkey_api_key, if you use openai through portkey, use luna 5.6
- do you have my portkey_api_key?
- in the end, i have to push my project to a public github repo and submit the repo url
## Problem 1: Vibe coder prompts

- Create AI_prompts.md when you start the assignment, and update it as you go. This file keeps a record of everything you type to your AI coding assistant.
- Make one section for each problem, with problem number/title, prompts in my own words, and a follow-up prompt if needed.
- And you should also log my prompts, remember?

## Problem 2: Analyze the database

- Look at the database data/campus_customs.db and understand the fields of each table. Fully understand catalogue, inventory, and users (the minimum), and do better if you can.
- Follow-up: Create the file output/harness.md. List each table and its columns, and add one short line for each field saying why it matters to the shop or the chatbot.
- Keep growing the harness file in later problems including models, tools, safety and specs.

## Problem 3: Build the Campus Customs website

- Set up a React + Vite + TypeScript front end for Campus Customs. Add a nav bar at the top with links to the main pages: Home, Products, About Us, Log in, Create account.
- Follow-up: Use yalebulldogblue.com to get wording that fits the Campus Customs style for the Home and About Us pages, but write the pages in your own voice. Do not copy the text from the original site.
- Build a Products page. For each product, show its picture, name, price, and a short description. Get the pictures from the image paths in the database.
- Each product gets its own page. Put a large picture on one side, and the product details on the other: description, price, and sizes or stock if you have them. When a shopper clicks a product card on the Products page, they should land on this page.
- Put a chat box in the bottom right corner of the site. You can make it a small floating box. It does not need to work yet. Just leave an empty box for now. You will connect it to your backend later.
- Soon you will need a small API to read the database. Start simple: make a basic FastAPI app in backend/main.py that only serves products and images. Later, in Problem 5, you will grow it into the agent backend.

## Problem 4: Create account and login

- Build a simple sign-up and log-in flow. Sign up: ask for first name, last name, email, and password (a confirm-password field is a nice extra). Log in: ask for email and password.
- Follow-up: Save every new account in the users table. Store passwords in a safe way so hackers (people or AI) cannot read them.
- The database already comes with a test user (test@campuscustoms.yale.edu, with the password given in the assignment). Use it while you build. Check that you can log in with this user, and that a new account you make also works.
- Also update output/harness.md with how auth works, what you store for a user and how to protect password.

## Problem 5: PydanticAI agent backend

- Build the shop chatbot as a PydanticAI agent that runs behind FastAPI. Connect it to the chat box on your front end. Put the API app in backend/main.py (the file you run with Uvicorn). Keep the agent in four files next to it: backend/prompts/prompt.md (system prompt, grow this same file later), backend/agent.py (agent entry / wiring), backend/tools.py (tools the agent can call), backend/models.py (Pydantic / PydanticAI structured types).
- Add a chat route in main.py. When the website sends a message, this route returns the agent's reply. Add whatever else you need for products and login too. You will need your AI model API key to run the agent.
- What's this? (asked about the two running background tasks in the app)
- Write the Campus Customs voice and the basic safety rules in prompts/prompt.md. You will add more tools and safety rules later. In models.py, add or update the types for chat replies and product cards when you need them.
- In output/harness.md, write down how the front end talks to FastAPI, and how the agent gets loaded (which prompt file and model you use). Make sure the backend runs from the backend/ folder, like this: uvicorn main:app --reload --port 8000

## Problem 6: Product info and stock

- Give the agent tools that look up real information from campus_customs.db: product description, price, and how many are in stock (by size, when the customer asks).
- The agent must use the database. It should not make up prices or quantities. If a size is out of stock, say it clearly.
- The above prompt is also problem 5.
- I was wrong, it's for problem 6.
- Add more to prompts/prompt.md so the agent knows to use these tools when asked about price or stock. Add or update the return types in models.py. In output/harness.md, list each tool, and explain which fields you put in the model for lookup results, and why.

## Problem 7: Chat search that updates the page

- Problem 7: Chat search that updates the page
- Now we will add a nice feature to the site. When a customer asks about a type of item, like "what hoodies do you have?", the agent should search the database. Then the website should show the matching items as product cards. Each card shows the image, name, price, and a short description.
- It's an API contract. The agent returns structured product matches, and the front end shows them on the website. It looks cool.
- After your new feature loads the dynamic product cards, check that the single-item page you built in Problem 3 still works. Every product card, including the ones the chat just added, should open the detail page (large image and full info) when clicked. Update prompts/prompt.md and output/harness.md. Make it clear how the search results get to the page.

## Problem 8: Customer memory

- When a shopper is logged in, save their chat history in a table in the database. Load it again when they come back. The agent should know who it is talking to (name and email). Put this in agent deps, or use another clear way, or let the agent call a tool to get it.
- Also pass enough page context to the agent. For example, if someone is on a product page and asks "do you have this in pink?", the agent should know which product they mean. Hint: you can put code into the agent context.
- Guests can chat, but history only needs to persist for logged-in users. In output/harness.md, write down how you save the chat history, what customer details the agent sees, and how you pass the page context.

## Problem 9: Usability improvements

- Problem 9: Usability improvements
- Now make it better. Pick and build: 2 front-end improvements, 2 agent / backend improvements.
- So that you know. Front-end improvements make the site look better and easier to use. Agent / backend improvements make the agent's answers better, more accurate, or safer. They can be new agent tools, or changes that make the agent faster or cheaper to run.
- Create output/usability.md while you build. For each improvement, write: what you added, and why it helps a Campus Customs shopper or the business.
- Also make sure every improvement actually works in the running app.

## Problem 10: Style the website

- Problem 10: Style the website
- Make the whole site feel like a Yale shop. Use Yale Blue as the main color, but keep the background light and airy so it does not feel heavy. Mix in a warm cream and a small touch of gold for accents. Make the top nav bar look like a university banner: deep blue with white text, and a gold underline on the page you are on.
- Make each product card look like a collectible card: white card, thin blue border, rounded corners, and a soft shadow. When you hover over it, it lifts up a little and the border glows blue. Show the price in bold navy, and tag any sale item with a small gold badge. For sizes that are in stock, show a blue button. For sizes that are sold out, grey them out and cross them with a line. Make it clear at a glance what a shopper can buy.
- Make the chatbot feel like a friendly Yale bulldog mascot. Put "Bulldog Bot" in the chat header on a blue background.
- Write output/design.md: what you changed, and why it should make shoppers stay longer and buy more. Keep it short and concrete.
- Redesign the three feature cards on the home page so they do not look like three identical white boxes. (1) Add a large icon at the top of each card: a medal for "Officially licensed", a ruler for "XS through XXL", and a robot for "Straight from the stockroom", in Yale Blue. (2) Give each card a different accent color on its top edge (navy, medium blue, and gold). (3) Make the middle card stand out: dark blue background with white text, while the other two stay white with blue text. (4) On hover, let each card lift up slightly with a soft shadow.
- Move Officially licensed to the middle card
- Make the chatbot more visible on the site. (1) Style the floating chat button in the bottom right: a bulldog mascot face instead of a plain circle, with a thin gold border and a soft shadow, so it stands out. (2) Add a gentle pulse animation: every 3 seconds, a soft gold ring expands outward once. Keep it subtle. (3) Add a small speech bubble next to the button that says "Ask me anything", on first visit only, hidden once the chat is opened. (4) In the hero section, turn the "Join the pack" line into a clickable link that opens the chat panel. Do not auto-open the chat panel. Keep everything else on the page the same.
- Improve the "Find your people" section. (1) Add a light blue circular icon at the top of each card: a house for Residential Colleges, a hockey stick for Varsity Sports, a graduation cap for Graduate Schools, and a family for Yale Family. (2) Make the big number (01, 02, 03, 04) a large, very light grey decorative number in the card background, with the title sitting on top of it. (3) On hover, make the card border turn Yale Blue and slide the arrow to the right slightly, so the cards feel clickable. (4) Keep the copy, but make each card mention one specific place or thing for scene: for example, Ingalls Rink for Varsity Sports, and commencement for Graduate Schools. Do not change the game day banner below. Keep the layout as four cards in a row.
- Tighten the hero section. (1) Make the headline fit on one line (or break cleanly as "Wear your corner / of Yale") so "Yale" does not sit alone on its own line. Reduce the gap between the eyebrow text, headline, paragraph, and buttons by about one third. (2) On the right side of the hero, add a featured product image: a folded navy crewneck or hoodie, slightly rotated with a soft shadow, sitting in front of the skyline illustration. The skyline stays as a background layer. (3) Keep the two buttons and all the current text unchanged. The goal: the hero should feel like one composed block, with text on the left and a real product on the right, not a mostly empty page.
- The hero product image looks blurry and pixelated because the source image is low resolution and being stretched too large. Fix it this way: (1) Look at the product images in the database and pick the sharpest, highest-resolution one for the hero. (2) Instead of showing the hoodie as a cut-out floating image, put it inside a white rounded card with a soft shadow, like the product cards on the Products page. (3) Show the image at a fixed size around 420px wide and never stretch it beyond its natural size. Use object-fit: cover inside the card. (4) Keep everything else in the hero the same.
- Can you make the hero smaller?
- The chat panel is part of the page layout, so when it opens it pushes the hero section down and squeezes it. Fix it by making the chat panel float over the page instead: (1) position: fixed, anchored to the bottom right of the viewport (about 20px from the right and 20px from the bottom), fixed width around 360px and max-height around 500px. (2) z-index: 1000 so the panel floats above all page content. (3) A soft shadow around the panel so it reads as a floating window. (4) Opening and closing the chat must not change the layout of anything behind it; the hero must stay exactly where it is. (5) Keep the panel header, messages, and input box exactly as they are.
- Rename the "Join the pack" button in the hero to "Ask Bulldog Bot", and keep it opening the chat panel. Add a small paw or speech-bubble icon inside the button before the text. Do not change any other buttons or text.
- Improve the About Us page. (1) Keep the first three cards ("Who we are", "Who we dress", "What's on the racks") in one row, and turn the fourth card ("A chatbot that checks first") into a full-width banner card below them, dark blue background and white text. (2) Add an icon to each of the three small cards: a building for "Who we are", a graduate cap for "Who we dress", and a t-shirt for "What's on the racks", in Yale Blue. (3) Add a paw icon to the chatbot banner card. (4) Turn the last line "Start a chat with our assistant" into a gold button that opens the chat panel, the same behavior as the hero button "Ask Bulldog Bot". Keep all the card text unchanged.

## Problem 11: Site testing (app check)

- Test the live site and save the results in output/app_check.html, a page you can open by double-clicking it. Include clear screenshots and short captions for each feature.
- The app check should cover at least: (1) chat checking the stock level of an item (real stock and price from the database); (2) the search-result cards appearing after a category question (like "what hoodies do you have?"); (3) one of the usability features you added in Problem 9.
- Make the HTML easy to grade: give each check a heading, a screenshot, and one or two sentences on what the screenshot proves.
- Put the screenshot image files in output/app_check_images/ and link them from app_check.html with relative paths (for example app_check_images/inventory.png).
- (screenshot of the Create account form with the Last name box sticking out of the card) Fix it, and why there is "Yale Bulldog Blue" in the home page.
- Make the background color consistent, it doesn't look nice. (screenshot of the product grid: some photos have black backgrounds, some white)
- After clicking in, there are the same items for every module. It doesn't make any sense. (screenshot of the home page "Find your people" cards)
- And those prompts should be logged under problem 11.
- When I searched for T-shirts, nothing came up. Fix the relevant problems. (screenshot: the T-shirts button inside the Warm layers collection showing 0 items)
- Still can see the bug. (screenshot: the Products grid still showing photos with black backgrounds)
- What happened here? (screenshot: on a narrow screen a product card is cut off on the right, its text is clipped, and the page scrolls sideways)

## Problem 12: Audit trail, safety, finish harness

- Keep an append-only output/audit_trail.json of what the agent does: time, tool name, short args, result, and why it stopped. Never wipe it between runs. Think of some safety rules for the agent and include them in the prompts/prompt.md.
- Finish output/harness.md so it is clear how the whole system works: the model fields in models.py and why you chose them; tools and abilities; safety rules; specs (loop limits, result caps, models, how to run front end and back end).

## Problem 13: Push to GitHub and submit the URL

- Now work on Problem 13: push to Github and submit the url
- put your code in a folder named hw4
