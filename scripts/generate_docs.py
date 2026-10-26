# scripts/generate_docs.py
import zipfile
import html
import os

DOCX_PATH = "docs/One-Buffalo-AI-Mastery-Guide.docx"
HTML_PATH = "docs/One-Buffalo-AI-Mastery-Guide.html"

# Content definition
content_data = [
    {"type": "title", "text": "🦬 One Buffalo Tracker: Engineering Assessment & Agentic AI Mastery Guide"},
    {"type": "subtitle", "text": "From Resilient Edge Architecture to Staff-Level Pair Programming with Antigravity"},
    {"type": "meta", "text": "Generated for olfhq • Project: One Buffalo Dashboard (onebuffalotracker.fyi) • October 2026"},

    {"type": "h1", "text": "1. Engineering Skill Level Assessment"},
    {"type": "p", "text": "Based on a structural and behavioral audit of the One-Buffalo-Dashboard codebase, your software engineering instincts operate at a Senior / Lead Systems Architect level:"},
    {
        "type": "bullets",
        "items": [
            ("Pragmatic, Zero-Maintenance Architecture: ", "Instead of choosing heavy server-side frameworks (Next.js, Remix, Docker) that require recurring hosting fees and compute management, you deployed a high-performance static PWA on GitHub Pages with custom domain routing (onebuffalotracker.fyi)."),
            ("Defensive Dual-Layer Resilience: ", "The data scraper (scripts/scrape.js) updates canonical data.json while synchronizing inline FALLBACK_DATA directly into bills.html, sabres.html, and index.html. The application remains fully functional with zero UI glitches even during total upstream API outages or offline scenarios."),
            ("Applied Mathematical Modeling: ", "In scripts/scrape.js, you developed custom logistic regression log-odds algorithms (calculateLiveNhlWinChance and calculateLiveNflWinChance) incorporating score differentials, non-linear time-decay curves, and baseline win probabilities."),
            ("Verification-First Quality Gate: ", "A 4-tier automated test harness (audit_deep.js, test_out_of_town_cards.js, audit_stats.js, audit_full_codebase.js) runs via GitHub Actions CI/CD to prevent regressions prior to auto-committing upstream.")
        ]
    },
    {"type": "callout", "text": "Staff-Level Insight: Because you possess strong architectural foundations, you do not need generic beginner prompt templates. Your highest leverage comes from Context Engineering, Executable Contract Prompting, and Subagent Orchestration."},

    {"type": "h1", "text": "2. Curated YouTube Playlist"},
    {"type": "h2", "text": "Part 1: The Engine (What We Built & Deepening the Foundations)"},

    {
        "type": "playlist_item",
        "num": "1",
        "title": "Building Offline-First Progressive Web Apps",
        "creator": "Google Chrome Developers / Jake Archibald",
        "search_url": "https://www.youtube.com/results?search_query=Google+Chrome+Developers+Building+Offline+First+Web+Apps+Jake+Archibald",
        "desc": "Deep dive into Service Worker lifecycle management, Stale-While-Revalidate caching strategies, and safely bypassing service worker caches for high-frequency client-side polling endpoints (such as your 25s ESPN score updates)."
    },
    {
        "type": "playlist_item",
        "num": "2",
        "title": "Logistic Regression & Log-Odds to Probability",
        "creator": "StatQuest with Josh Starmer",
        "search_url": "https://www.youtube.com/results?search_query=StatQuest+Josh+Starmer+Logistic+Regression+Log+Odds",
        "desc": "Clear visual deconstruction of the sigmoid logit function ln(p / (1 - p)) implemented in scripts/scrape.js. Demonstrates how time remaining acts as a confidence variance factor that converges toward certainty at the final whistle."
    },
    {
        "type": "playlist_item",
        "num": "3",
        "title": "Automating Pipelines with GitHub Actions & Quality Gates",
        "creator": "Fireship / GitHub",
        "search_url": "https://www.youtube.com/results?search_query=Fireship+GitHub+Actions+in+100+Seconds+and+Full+Tutorial",
        "desc": "Covers scheduled cron runners, dirty git diff assertions, and headless Node.js test execution directly mirroring your .github/workflows/update.yml configuration."
    },

    {"type": "h2", "text": "Part 2: The AI Pair Programmer (Prompting & Agentic Orchestration)"},

    {
        "type": "playlist_item",
        "num": "4",
        "title": "Intro to Large Language Models (The LLM OS)",
        "creator": "Andrej Karpathy",
        "search_url": "https://www.youtube.com/watch?v=zjkBMFhNj_g",
        "desc": "Karpathy explains the fundamental mental model: the LLM is the CPU, the context window is RAM, and agent tools (terminal, file read/write, web search) are disk and I/O. Essential for understanding how to optimize context memory."
    },
    {
        "type": "playlist_item",
        "num": "5",
        "title": "Quit Tokenmaxxing: Context Engineering for AI Agents",
        "creator": "AWS Developers / Latent Space",
        "search_url": "https://www.youtube.com/results?search_query=AWS+Developers+Quit+Tokenmaxxing+Context+Engineering+Techniques",
        "desc": "Explains why 'tokenmaxxing' (stuffing giant files into prompt context) degrades reasoning. Outlines context rot, context poisoning, and how selective context curation dramatically increases accuracy."
    },
    {
        "type": "playlist_item",
        "num": "6",
        "title": "Acceptance Testing Is the FUTURE of Programming",
        "creator": "Continuous Delivery (Dave Farley)",
        "search_url": "https://www.youtube.com/results?search_query=Dave+Farley+Continuous+Delivery+Acceptance+Testing+is+the+FUTURE+of+programming",
        "desc": "Dave Farley explains why natural language is too vague for coding assistants, and why executable test suites (ATDD/TDD) serve as the ultimate unambiguous prompt for AI agents."
    },
    {
        "type": "playlist_item",
        "num": "7",
        "title": "Building Effective Agents",
        "creator": "Anthropic (Alex Albert & Erik Schluntz)",
        "search_url": "https://www.youtube.com/results?search_query=Anthropic+Building+more+effective+AI+agents+Alex+Albert+Erik",
        "desc": "Breakdown of modern agentic design patterns: orchestrator-workers, prompt chaining, tool calling, and automated evaluator-optimizer loops that match Antigravity's architecture."
    },
    {
        "type": "playlist_item",
        "num": "8",
        "title": "How to Actually Succeed with AI Development",
        "creator": "Continuous Delivery (Dave Farley)",
        "search_url": "https://www.youtube.com/results?search_query=Dave+Farley+Continuous+Delivery+How+to+Actually+Succeed+with+AI+Development",
        "desc": "How senior engineers establish strict architectural boundaries and automated verification harnesses so AI agents accelerate output without accumulating technical debt."
    },

    {"type": "h1", "text": "3. Executive Prompting Blueprints for Antigravity"},
    {"type": "p", "text": "Adopt these four battle-tested prompting patterns when collaborating with Antigravity:"},

    {"type": "h2", "text": "Pattern 1: The Contract-First (Spec-Driven) Prompt"},
    {"type": "p", "text": "Rather than describing line-by-line coding steps, define the strict contract, data invariants, and verification criteria:"},
    {
        "type": "code",
        "text": """Goal: Add an NHL tiebreaker matrix to `sabres.html`.

Contract & Invariants:
1. Inputs: Reads from `data.json` under `sabres.tiebreakers`.
2. Output: Render a 3-column responsive flex grid (#1 Seed, Wildcard 1, Wildcard 2).
3. Invariant: Vanilla CSS only. Do not add external CDNs or JS libraries.
4. Verification: Run `npm test` and assert all 4 audit suites pass."""
    },

    {"type": "h2", "text": "Pattern 2: The Self-Correcting Test Loop Prompt"},
    {"type": "p", "text": "Leverage Antigravity's terminal execution capability by instructing it to run in a test-verification loop:"},
    {
        "type": "code",
        "text": """Goal: Fix the overtime time-decay anomaly in `calculateLiveNhlWinChance`.
Action Loop:
1. Add a failing unit test in `test/audit_stats.js` for an OT scenario (0-0 score, 1:30 left in OT).
2. Edit `scripts/scrape.js` to fix the decay curve.
3. Run `npm test` autonomously until the test passes.
4. Report the mathematical diff."""
    },

    {"type": "h2", "text": "Pattern 3: The Architectural Interrogation"},
    {"type": "p", "text": "Before letting the agent write hundreds of lines of code, force it to challenge your assumptions and surface hidden edge cases:"},
    {
        "type": "callout",
        "text": "\"I want to add a push-notification system for live Bills scores. Before writing any code, interview me on my constraints using /grill-me. Challenge my data frequency, battery impact on mobile PWAs, and serverless cost limits.\""
    },

    {"type": "h2", "text": "Pattern 4: Antigravity Slash Commands Reference"},
    {
        "type": "bullets",
        "items": [
            ("/plan: ", "Drafts an architectural step-by-step roadmap before files are modified."),
            ("/grill-me: ", "Triggers an interactive design interview to resolve ambiguities before execution."),
            ("/boost: ", "Activates multi-perspective deep reasoning for complex mathematical or structural problems."),
            ("/compact: ", "Compresses conversation history to eliminate context rot and save token capacity."),
            ("/learn: ", "Persists repository rules and preferred coding standards across sessions.")
        ]
    }
]

# ----------------- DOCX GENERATION -----------------
def generate_docx(filepath):
    import io

    rels_list = []
    rel_id_counter = 1

    def add_hyperlink_rel(target):
        nonlocal rel_id_counter
        r_id = f"rIdLink{rel_id_counter}"
        rel_id_counter += 1
        rels_list.append((r_id, target))
        return r_id

    # Build document.xml paragraphs
    doc_body = []

    for item in content_data:
        itype = item["type"]
        if itype == "title":
            doc_body.append(f"""
            <w:p>
                <w:pPr>
                    <w:pStyle w:val="Title"/>
                    <w:spacing w:before="240" w:after="120"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:b/>
                        <w:sz w:val="48"/>
                        <w:color w:val="003366"/>
                    </w:rPr>
                    <w:t>{html.escape(item['text'])}</w:t>
                </w:r>
            </w:p>
            """)
        elif itype == "subtitle":
            doc_body.append(f"""
            <w:p>
                <w:pPr>
                    <w:spacing w:after="120"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:i/>
                        <w:sz w:val="28"/>
                        <w:color w:val="C60C30"/>
                    </w:rPr>
                    <w:t>{html.escape(item['text'])}</w:t>
                </w:r>
            </w:p>
            """)
        elif itype == "meta":
            doc_body.append(f"""
            <w:p>
                <w:pPr>
                    <w:spacing w:after="360"/>
                    <w:pBdr><w:bottom w:val="single" w:sz="8" w:space="8" w:color="CCCCCC"/></w:pBdr>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:sz w:val="18"/>
                        <w:color w:val="666666"/>
                    </w:rPr>
                    <w:t>{html.escape(item['text'])}</w:t>
                </w:r>
            </w:p>
            """)
        elif itype == "h1":
            doc_body.append(f"""
            <w:p>
                <w:pPr>
                    <w:spacing w:before="360" w:after="140"/>
                    <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="003366"/></w:pBdr>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:b/>
                        <w:sz w:val="34"/>
                        <w:color w:val="003366"/>
                    </w:rPr>
                    <w:t>{html.escape(item['text'])}</w:t>
                </w:r>
            </w:p>
            """)
        elif itype == "h2":
            doc_body.append(f"""
            <w:p>
                <w:pPr>
                    <w:spacing w:before="240" w:after="100"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:b/>
                        <w:sz w:val="26"/>
                        <w:color w:val="1A365D"/>
                    </w:rPr>
                    <w:t>{html.escape(item['text'])}</w:t>
                </w:r>
            </w:p>
            """)
        elif itype == "p":
            doc_body.append(f"""
            <w:p>
                <w:pPr>
                    <w:spacing w:before="60" w:after="120" w:line="276" w:lineRule="auto"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:sz w:val="22"/>
                        <w:color w:val="222222"/>
                    </w:rPr>
                    <w:t xml:space="preserve">{html.escape(item['text'])}</w:t>
                </w:r>
            </w:p>
            """)
        elif itype == "callout":
            doc_body.append(f"""
            <w:p>
                <w:pPr>
                    <w:spacing w:before="160" w:after="160"/>
                    <w:ind w:left="360" w:right="360"/>
                    <w:shd w:val="clear" w:color="auto" w:fill="F0F4F8"/>
                    <w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="003366"/></w:pBdr>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:sz w:val="21"/>
                        <w:color w:val="1A365D"/>
                        <w:i/>
                    </w:rPr>
                    <w:t xml:space="preserve">{html.escape(item['text'])}</w:t>
                </w:r>
            </w:p>
            """)
        elif itype == "bullets":
            for bold_lead, body in item["items"]:
                doc_body.append(f"""
                <w:p>
                    <w:pPr>
                        <w:spacing w:before="40" w:after="60"/>
                        <w:ind w:left="480" w:hanging="240"/>
                    </w:pPr>
                    <w:r>
                        <w:rPr><w:sz w:val="22"/><w:color w:val="003366"/></w:rPr>
                        <w:t xml:space="preserve">• </w:t>
                    </w:r>
                    <w:r>
                        <w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="111111"/></w:rPr>
                        <w:t xml:space="preserve">{html.escape(bold_lead)}</w:t>
                    </w:r>
                    <w:r>
                        <w:rPr><w:sz w:val="22"/><w:color w:val="333333"/></w:rPr>
                        <w:t xml:space="preserve">{html.escape(body)}</w:t>
                    </w:r>
                </w:p>
                """)
        elif itype == "playlist_item":
            r_id = add_hyperlink_rel(item["search_url"])
            doc_body.append(f"""
            <w:p>
                <w:pPr>
                    <w:spacing w:before="140" w:after="40"/>
                </w:pPr>
                <w:r>
                    <w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="003366"/></w:rPr>
                    <w:t xml:space="preserve">Track {item['num']}: </w:t>
                </w:r>
                <w:hyperlink r:id="{r_id}">
                    <w:r>
                        <w:rPr>
                            <w:b/>
                            <w:sz w:val="24"/>
                            <w:color w:val="0066CC"/>
                            <w:u w:val="single"/>
                        </w:rPr>
                        <w:t>{html.escape(item['title'])}</w:t>
                    </w:r>
                </w:hyperlink>
                <w:r>
                    <w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="666666"/></w:rPr>
                    <w:t xml:space="preserve"> — {html.escape(item['creator'])}</w:t>
                </w:r>
            </w:p>
            <w:p>
                <w:pPr>
                    <w:spacing w:before="0" w:after="120"/>
                    <w:ind w:left="280"/>
                </w:pPr>
                <w:r>
                    <w:rPr><w:sz w:val="21"/><w:color w:val="444444"/></w:rPr>
                    <w:t xml:space="preserve">{html.escape(item['desc'])}</w:t>
                </w:r>
            </w:p>
            """)
        elif itype == "code":
            lines = item["text"].split("\n")
            doc_body.append(f"""
            <w:p>
                <w:pPr>
                    <w:spacing w:before="120" w:after="120"/>
                    <w:ind w:left="360" w:right="360"/>
                    <w:shd w:val="clear" w:color="auto" w:fill="F4F5F7"/>
                    <w:pBdr>
                        <w:top w:val="single" w:sz="4" w:space="8" w:color="DDDDDD"/>
                        <w:left w:val="single" w:sz="16" w:space="8" w:color="4A5568"/>
                        <w:bottom w:val="single" w:sz="4" w:space="8" w:color="DDDDDD"/>
                        <w:right w:val="single" w:sz="4" w:space="8" w:color="DDDDDD"/>
                    </w:pBdr>
                </w:pPr>
            """)
            for line in lines:
                doc_body.append(f"""
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>
                        <w:sz w:val="19"/>
                        <w:color w:val="1E293B"/>
                    </w:rPr>
                    <w:t xml:space="preserve">{html.escape(line)}</w:t>
                </w:r>
                <w:r><w:br/></w:r>
                """)
            doc_body.append("</w:p>")

    # Assemble document.xml
    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    {"".join(doc_body)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""

    # Assemble document.xml.rels
    rels_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    ]
    for r_id, target in rels_list:
        rels_xml_lines.append(f'  <Relationship Id="{r_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="{html.escape(target)}" TargetMode="External"/>')
    rels_xml_lines.append('</Relationships>')
    document_xml_rels = "\n".join(rels_xml_lines)

    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

    root_rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    # Write to zip
    with zipfile.ZipFile(filepath, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types_xml)
        z.writestr("_rels/.rels", root_rels_xml)
        z.writestr("word/document.xml", document_xml)
        z.writestr("word/_rels/document.xml.rels", document_xml_rels)

    print(f"Created {filepath} successfully.")

# ----------------- HTML GENERATION -----------------
def generate_html(filepath):
    html_parts = []
    for item in content_data:
        itype = item["type"]
        if itype == "title":
            html_parts.append(f'<h1 class="doc-title">{html.escape(item["text"])}</h1>')
        elif itype == "subtitle":
            html_parts.append(f'<p class="doc-subtitle">{html.escape(item["text"])}</p>')
        elif itype == "meta":
            html_parts.append(f'<p class="doc-meta">{html.escape(item["text"])}</p><hr class="divider"/>')
        elif itype == "h1":
            html_parts.append(f'<h2 class="section-h1">{html.escape(item["text"])}</h2>')
        elif itype == "h2":
            html_parts.append(f'<h3 class="section-h2">{html.escape(item["text"])}</h3>')
        elif itype == "p":
            html_parts.append(f'<p class="doc-text">{html.escape(item["text"])}</p>')
        elif itype == "callout":
            html_parts.append(f'<div class="callout-box">{html.escape(item["text"])}</div>')
        elif itype == "bullets":
            lis = "".join([f'<li><strong>{html.escape(b)}</strong>{html.escape(t)}</li>' for b, t in item["items"]])
            html_parts.append(f'<ul class="bullet-list">{lis}</ul>')
        elif itype == "playlist_item":
            html_parts.append(f'''
            <div class="playlist-card">
              <div class="track-header">
                <span class="track-num">Track {item["num"]}</span>
                <a href="{html.escape(item["search_url"])}" target="_blank" class="track-title">{html.escape(item["title"])}</a>
                <span class="track-creator">— {html.escape(item["creator"])}</span>
              </div>
              <p class="track-desc">{html.escape(item["desc"])}</p>
            </div>
            ''')
        elif itype == "code":
            html_parts.append(f'<pre class="code-block"><code>{html.escape(item["text"])}</code></pre>')

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>One Buffalo Tracker: Engineering Assessment & Agentic AI Mastery Guide</title>
<style>
  :root {{
    --bills-blue: #003366;
    --bills-red: #C60C30;
    --sabres-gold: #FFB81C;
    --text-dark: #1E293B;
    --text-muted: #64748B;
    --bg-light: #F8FAFC;
    --border-color: #E2E8F0;
  }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.65;
    color: var(--text-dark);
    background: #F1F5F9;
    margin: 0;
    padding: 30px 15px;
  }}
  .action-banner {{
    max-width: 860px;
    margin: 0 auto 20px auto;
    background: linear-gradient(135deg, #003366, #1A365D);
    color: white;
    padding: 18px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }}
  .action-banner h4 {{ margin: 0 0 4px 0; font-size: 1.1rem; }}
  .action-banner p {{ margin: 0; font-size: 0.9rem; opacity: 0.9; }}
  .action-btns {{ display: flex; gap: 10px; }}
  .btn {{
    padding: 9px 16px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.88rem;
    text-decoration: none;
    cursor: pointer;
    border: none;
    transition: transform 0.1s, opacity 0.2s;
  }}
  .btn-primary {{
    background: #FFB81C;
    color: #003366;
  }}
  .btn-secondary {{
    background: rgba(255,255,255,0.18);
    color: white;
    border: 1px solid rgba(255,255,255,0.4);
  }}
  .btn:hover {{ opacity: 0.92; transform: translateY(-1px); }}
  .doc-container {{
    max-width: 860px;
    margin: 0 auto;
    background: white;
    padding: 50px 60px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    border: 1px solid var(--border-color);
  }}
  .doc-title {{
    color: var(--bills-blue);
    font-size: 2.1rem;
    margin: 0 0 8px 0;
    font-weight: 800;
    letter-spacing: -0.02em;
  }}
  .doc-subtitle {{
    color: var(--bills-red);
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 12px 0;
  }}
  .doc-meta {{
    color: var(--text-muted);
    font-size: 0.9rem;
    margin: 0 0 16px 0;
  }}
  .divider {{
    border: 0;
    border-top: 2px solid var(--border-color);
    margin: 20px 0 35px 0;
  }}
  .section-h1 {{
    color: var(--bills-blue);
    font-size: 1.55rem;
    font-weight: 700;
    margin: 40px 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--bills-blue);
  }}
  .section-h2 {{
    color: #1A365D;
    font-size: 1.25rem;
    font-weight: 600;
    margin: 28px 0 12px 0;
  }}
  .doc-text {{
    font-size: 1.02rem;
    margin: 0 0 16px 0;
    color: #334155;
  }}
  .bullet-list {{
    margin: 0 0 20px 0;
    padding-left: 24px;
    color: #334155;
  }}
  .bullet-list li {{
    margin-bottom: 10px;
    font-size: 1rem;
  }}
  .bullet-list strong {{
    color: #0F172A;
  }}
  .callout-box {{
    background: #EFF6FF;
    border-left: 4px solid var(--bills-blue);
    padding: 16px 20px;
    border-radius: 6px;
    margin: 20px 0;
    font-style: italic;
    color: #1E3A8A;
    font-size: 0.98rem;
  }}
  .playlist-card {{
    background: var(--bg-light);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 14px;
    transition: border-color 0.15s;
  }}
  .playlist-card:hover {{
    border-color: #CBD5E1;
  }}
  .track-header {{
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 6px;
  }}
  .track-num {{
    background: var(--bills-blue);
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
  }}
  .track-title {{
    color: #0284C7;
    font-weight: 700;
    font-size: 1.05rem;
    text-decoration: underline;
  }}
  .track-creator {{
    color: var(--text-muted);
    font-size: 0.9rem;
    font-style: italic;
  }}
  .track-desc {{
    margin: 0;
    color: #475569;
    font-size: 0.95rem;
  }}
  .code-block {{
    background: #0F172A;
    color: #E2E8F0;
    padding: 16px 20px;
    border-radius: 8px;
    font-family: Consolas, Monaco, "Courier New", monospace;
    font-size: 0.9rem;
    overflow-x: auto;
    line-height: 1.5;
  }}
</style>
</head>
<body>

<div class="action-banner">
  <div>
    <h4>📄 Export to Google Docs in 5 Seconds</h4>
    <p>Upload the generated <code>One-Buffalo-AI-Mastery-Guide.docx</code> to Google Drive or copy directly to docs.new.</p>
  </div>
  <div class="action-btns">
    <button class="btn btn-primary" onclick="copyDocument()">📋 Copy for Google Docs</button>
    <a href="https://docs.new" target="_blank" class="btn btn-secondary">Open docs.new ↗</a>
  </div>
</div>

<div class="doc-container" id="printable-doc">
  {''.join(html_parts)}
</div>

<script>
function copyDocument() {{
  const doc = document.getElementById('printable-doc');
  const listener = function(e) {{
    e.clipboardData.setData('text/html', doc.innerHTML);
    e.clipboardData.setData('text/plain', doc.innerText);
    e.preventDefault();
  }};
  document.addEventListener('copy', listener);
  document.execCommand('copy');
  document.removeEventListener('copy', listener);
  alert('Document copied! Now open docs.new and press Ctrl+V (or Cmd+V) to paste with full formatting intact.');
}}
</script>

</body>
</html>"""

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(full_html)
    print(f"Created {filepath} successfully.")

if __name__ == "__main__":
    generate_docx(DOCX_PATH)
    generate_html(HTML_PATH)
