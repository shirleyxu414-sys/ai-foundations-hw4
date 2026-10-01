# Design changes

The site was restyled from a dark black-and-pink theme into a Yale shop. Every change below has one job: help a shopper find an item faster, trust what they see, and feel comfortable buying.

## What changed and why it should help

| Change | Why shoppers stay longer and buy more |
|---|---|
| **Yale Blue on a light, airy page** with warm cream panels and a little gold | Looks like an official Yale store, so it earns trust. The light background makes product photos and prices easy to read; all text measures 4.5:1 contrast or better. |
| **Deep-blue banner nav, white text, gold underline on the current page** | Shoppers always know where they are and how to get to Products, About and their account. The gold "Create account" button is the one bright action in the bar. |
| **Collectible product cards** (white, thin blue border, rounded, soft shadow; lift and blue glow on hover) | Cards look tappable and worth exploring. The hover feedback invites people to open more items instead of scrolling past. |
| **Bold navy price** on every card | The price is the first thing a buyer looks for. Making it the strongest text removes a click. |
| **Size chips on every card** (blue = in stock, grey and crossed out = sold out) | A shopper sees at a glance what they can actually buy, before opening the page. Nobody wastes time falling for an item that is sold out in their size. |
| **Size buttons on the product page** (blue buttons, grey crossed-out for sold out, exact count when picked) | Removes the "is my size here?" doubt right at the moment of decision. |
| **Search box and sort menu** | Finding "navy hockey" or the cheapest hoodie takes seconds instead of scrolling 102 items. Shoppers who find what they want are the ones who buy. |
| **Gold "Sale" badge** (ready for any item marked on sale) | Draws the eye to deals. The database has no sale items today, so none show, and the site never invents one. |
| **Bulldog Bot** (mascot face, blue header, friendly greeting, starter questions) | A friendly guide makes shopping feel personal and low-pressure. The starter questions show what it can do, so more visitors try it. |
| **Chat answers appear as cards on the page**, with the chat floating over the page | A question like "what hoodies do you have?" turns straight into a browsable shelf. The chat floats in the corner and never shifts the page, so the shopper's place is never lost. |
| **One white background behind every product photo** (the supplied photos mixed black and white) | A patchwork grid looks cheap. Uniform photos look like one professional catalogue, so the products themselves stand out and shoppers keep scrolling. |
| **Collection cards that open their own products**, and category buttons that only appear when they have items | Every click leads somewhere useful. Nobody lands on the whole catalogue by mistake or on an empty "0 items" page. |
| **Compact hero with a real product** (clean two-line headline, tight text, a sharp hoodie photo in a card beside the text) | Shows what the shop sells in the first second, instead of a mostly empty banner. A smaller hero means the collections and products appear higher, so people scroll less to start shopping. |
| **Icons, pale numbers and specific places on the home cards** (Ingalls Rink, Old Campus, commencement, the Yale Bowl) | Icons let people scan; the concrete places make each card feel like it is about them, which raises the odds they click through. |
| **More visible chatbot** (bulldog button, gentle gold pulse, first-visit "Ask me anything", hero "Ask Bulldog Bot" button) | Shoppers who ask questions find the right size and stock faster and are less likely to leave unsure. The pulse and bubble draw attention once without nagging, and the chat never opens on its own. |
| **Collegiate skyline and Yale wording** on the home page | Tells a new visitor within a second what the shop is and who it is for, which lowers bounces. |

## What stayed the same

Layout, routes and features are unchanged, so nothing that already worked had to be relearned: the nav links, product pages, log-in flow and chat all work as before. Only colours, type, spacing, cards and the mascot are new.

## How it was checked

`output/app_check.html` shows screenshots and automated checks of the live site: colours and contrast, card style and hover, size chips against the database, the gold underline, the chat header and the phone layout.
