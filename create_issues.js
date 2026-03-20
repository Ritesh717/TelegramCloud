const https = require('https');
const fs = require('fs');
const path = require('path');

const REPO = "Ritesh717/TelegramCloud";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
    console.error("Error: GITHUB_TOKEN environment variable is not set.");
    console.log("Usage: $env:GITHUB_TOKEN='your_token'; node create_issues.js");
    process.exit(1);
}

const issuesPath = path.join(__dirname, 'issues.json');
if (!fs.existsSync(issuesPath)) {
    console.error("Error: issues.json not found. Run parse_issues.py first.");
    process.exit(1);
}

const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));

async function createIssue(issue) {
    const data = JSON.stringify({
        title: issue.title,
        body: issue.body,
        labels: issue.labels
    });

    const options = {
        hostname: 'api.github.com',
        port: 443,
        path: `/repos/${REPO}/issues`,
        method: 'POST',
        headers: {
            'Authorization': `token ${TOKEN}`,
            'User-Agent': 'Node.js-Script',
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (d) => { body += d; });
            res.on('end', () => {
                if (res.statusCode === 201) {
                    console.log(`Successfully created issue: ${issue.title}`);
                    resolve();
                } else {
                    console.error(`Failed to create issue: ${issue.title} (Status: ${res.statusCode})`);
                    console.error(body);
                    reject(new Error(`Status ${res.statusCode}`));
                }
            });
        });

        req.on('error', (e) => {
            console.error(`Error creating issue: ${issue.title}`);
            console.error(e);
            reject(e);
        });

        req.write(data);
        req.end();
    });
}

async function run() {
    console.log(`Starting to create ${issues.length} issues for ${REPO}...`);
    for (const issue of issues) {
        try {
            await createIssue(issue);
            // Small delay to avoid hitting rate limits too fast (though 31 is well within 5000/hr)
            await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
            console.error("Stopping due to error.");
            break;
        }
    }
    console.log("Done.");
}

run();
