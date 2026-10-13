# aethelinc

One-page website for Aethel, an offshore aviation company.

Structure: a landing section, then the footer. Nothing else. No deck content on the page.

Plain HTML, CSS and a few lines of JS. No build step.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Content rules

- Anything not yet achieved is labelled `target`.
- Say "Design stage. No flight yet." until there is a flight.
- No padded claims: no contact lists, search counts or tool names as traction.
- No em dashes in copy.

## To do

- Replace the placeholder email in the Contact section (`index.html`).
- Landing section is a placeholder hero. Rework it.
- Footer is adapted from the Lumen Studio footer in the Figma "Footers" file: dark, stippled art, giant wordmark. The stipple is generated in `script.js` from the Aethel mark.
- Replace the placeholder email and LinkedIn in the footer.
