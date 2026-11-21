const fs = require("fs");
const path = require("path");

const LISTS = [
    {
        name: "ads",
        urls: [
            "https://easylist.to/easylist/easylist.txt",
            "https://easylist-downloads.adblockplus.org/indianlist.txt"
        ],
        outFile: "ads.json",
        startId: 1,
        maxRules: 15000,
        extractCosmetic: true,
        extraRules: [
            {
                id: 19001,
                priority: 1,
                action: { type: "block" },
                condition: {
                    urlFilter: "||youtube.com/pagead/",
                    resourceTypes: ["xmlhttprequest", "script", "image", "sub_frame"]
                }
            },
            {
                id: 19002,
                priority: 1,
                action: { type: "block" },
                condition: {
                    urlFilter: "||youtube.com/api/stats/ads",
                    resourceTypes: ["xmlhttprequest", "ping"]
                }
            },
            {
                id: 19003,
                priority: 1,
                action: { type: "block" },
                condition: {
                    urlFilter: "||youtube.com/ptracking",
                    resourceTypes: ["xmlhttprequest", "ping"]
                }
            },
            {
                id: 19004,
                priority: 1,
                action: { type: "block" },
                condition: {
                    urlFilter: "||googleads.g.doubleclick.net^",
                    resourceTypes: ["xmlhttprequest", "script", "image", "sub_frame"]
                }
            },
            {
                id: 19005,
                priority: 1,
                action: { type: "block" },
                condition: {
                    urlFilter: "||colombiaonline.com^",
                    resourceTypes: ["script", "image", "xmlhttprequest", "sub_frame"]
                }
            },
            {
                id: 19006,
                priority: 1,
                action: { type: "block" },
                condition: {
                    urlFilter: "||clmbtech.com^",
                    resourceTypes: ["script", "image", "xmlhttprequest", "sub_frame"]
                }
            },
            {
                id: 19007,
                priority: 1,
                action: { type: "block" },
                condition: {
                    urlFilter: "||spclient.wg.spotify.com/ads/",
                    resourceTypes: ["xmlhttprequest", "script", "image", "media"]
                }
            },
            {
                id: 19008,
                priority: 1,
                action: { type: "block" },
                condition: {
                    urlFilter: "||spclient.wg.spotify.com/ad-logic/",
                    resourceTypes: ["xmlhttprequest", "script"]
                }
            },
            {
                id: 19009,
                priority: 1,
                action: { type: "block" },
                condition: {
                    urlFilter: "||adeventtracker.spotify.com^",
                    resourceTypes: ["xmlhttprequest", "ping", "script"]
                }
            },
            {
                id: 19010,
                priority: 1,
                action: { type: "block" },
                condition: {
                    urlFilter: "||gabo-receiver-service.spotify.com^",
                    resourceTypes: ["xmlhttprequest", "ping"]
                }
            }
        ]
    },
    {
        name: "trackers",
        urls: ["https://easylist.to/easylist/easyprivacy.txt"],
        outFile: "trackers.json",
        startId: 20001,
        maxRules: 8000,
        extractCosmetic: false,
        extraRules: []
    },
    {
        name: "annoyances",
        urls: ["https://easylist.to/easylist/fanboy-annoyance.txt"],
        outFile: "annoyances.json",
        startId: 30001,
        maxRules: 5000,
        extractCosmetic: false,
        extraRules: []
    }
];

const cosmeticMap = {}; // { "timesofindia.indiatimes.com": Set(["#ad-box", ...]) }

function addCosmeticRule(line) {
    // Match domain-specific cosmetic rules: domain1.com,domain2.com##.selector
    const idx = line.indexOf("##");
    if (idx <= 0) return; // Skip generic global rules (##.ad) to keep CSS fast

    const domainsPart = line.slice(0, idx);
    const selector = line.slice(idx + 2).trim();

    // Skip non-standard procedural selectors that Chrome CSS doesn't understand
    if (
        !selector ||
        selector.includes(":-abp-") ||
        selector.includes(":has-text") ||
        selector.includes(":upward") ||
        selector.includes(":style(")
    ) {
        return;
    }

    const domains = domainsPart.split(",");
    for (const d of domains) {
        const domain = d.trim().toLowerCase();
        if (!domain || domain.startsWith("~")) continue; // Skip exception domains
        if (!cosmeticMap[domain]) cosmeticMap[domain] = new Set();
        cosmeticMap[domain].add(selector);
    }
}

async function buildList({ name, urls, outFile, startId, maxRules, extractCosmetic, extraRules }) {
    const rules = [...extraRules];
    const seen = new Set(extraRules.map((r) => r.condition.urlFilter));
    let id = startId;

    for (const url of urls) {
        console.log(`Fetching ${name} from ${url}...`);
        const res = await fetch(url);
        const text = await res.text();
        const lines = text.split("\n");

        for (const raw of lines) {
            let line = raw.trim();
            if (!line || line.startsWith("!") || line.startsWith("@@")) continue;

            // Extract per-site cosmetic rules (##)
            if (line.includes("##")) {
                if (extractCosmetic) addCosmeticRule(line);
                continue;
            }
            if (line.includes("#")) continue;

            // Parse network rules + $third-party option
            let isThirdParty = false;
            if (line.includes("$")) {
                const [pattern, options] = line.split("$");
                if (options.includes("domain=") || options.includes("redirect=") || options.includes("csp=")) {
                    continue;
                }
                isThirdParty = options.includes("third-party");
                line = pattern;
            }

            if (
                rules.length < maxRules &&
                /^\|\|[a-z0-9.-]+(\/[a-z0-9._/-]*)?\^?$/i.test(line) &&
                !seen.has(line)
            ) {
                seen.add(line);
                const condition = {
                    urlFilter: line,
                    resourceTypes: ["script", "image", "xmlhttprequest", "sub_frame", "ping"]
                };
                if (isThirdParty) condition.domainType = "thirdParty";

                rules.push({
                    id: id++,
                    priority: 1,
                    action: { type: "block" },
                    condition
                });
            }
        }
    }

    const outPath = path.join(__dirname, "..", "rules", outFile);
    fs.writeFileSync(outPath, JSON.stringify(rules, null, 2));
    console.log(`Generated ${rules.length} rules in rules/${outFile}`);
}

async function buildAll() {
    for (const list of LISTS) {
        await buildList(list);
    }

    // Convert Sets to Arrays and save rules/cosmetic-rules.json
    const cosmeticJson = {};
    let domainCount = 0;
    for (const [domain, set] of Object.entries(cosmeticMap)) {
        cosmeticJson[domain] = Array.from(set);
        domainCount++;
    }

    const cosmeticPath = path.join(__dirname, "..", "rules", "cosmetic-rules.json");
    fs.writeFileSync(cosmeticPath, JSON.stringify(cosmeticJson));
    console.log(`Generated cosmetic rules for ${domainCount} domains in rules/cosmetic-rules.json`);
}

buildAll();