import re
import json
import os

bash_file = r'c:\Users\rites\Documents\Code\AI\TelegramCloud\create_telegramcloud_issues.sh'
output_file = r'c:\Users\rites\Documents\Code\AI\TelegramCloud\issues.json'

with open(bash_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Regex to find create_issue "Title" "labels" <<'EOF'\nBody\nEOF
# Multi-line match for the EOF block
pattern = re.compile(r'create_issue\s+"(.*?)"\s+"(.*?)"\s+<<\'EOF\'\n(.*?)\nEOF', re.DOTALL)

issues = []
for match in pattern.finditer(content):
    title = match.group(1)
    labels = match.group(2).split(',')
    body = match.group(3).strip()
    issues.append({
        "title": title,
        "labels": labels,
        "body": body
    })

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(issues, f, indent=2)

print(f"Extracted {len(issues)} issues to {output_file}")
