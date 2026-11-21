const fs = require("fs");
const path = require("path");

const EASYLIST_URL = "https://easylist.to/easylist/easylist.txt";
const MAX_RULES = 5000; // Stay well within Chrome's 30k static limit

async function build() {
  const res = await fetch(EASYLIST_URL);
  const text = await res.text();
  const lines = text.split("\n");

  const rules = [];
  let id = 1;

  for (const raw of lines) {
    const line = raw.trim();
    // Match simple domain-blocking rules like ||example.com^
    if (/^\|\|[a-z0-9.-]+\^$/i.test(line)) {
      rules.push({
        id: id++,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: line,
          resourceTypes: ["script", "image", "xmlhttprequest", "sub_frame"]
        }
      });
      if (rules.length >= MAX_RULES) break;
    }
  }

  const outPath = path.join(__dirname, "..", "rules", "ads.json");
  fs.writeFileSync(outPath, JSON.stringify(rules, null, 2));
  console.log(`Generated ${rules.length} rules in rules/ads.json`);
}

build();