# CSV-2-InDesign

Tool for importing a CSV file containing a list of books (with metadata) into an Adobe InDesign document. Each CSV row becomes one formatted paragraph in a selected text frame.

---

## Files

| File | Purpose |
|---|---|
| `import-booklist.jsx` | ExtendScript script — run this from inside InDesign |
| `booklist-config.json` | Configuration: field order, dividers, paragraph style name |
| `sample-booklist.csv` | Example CSV for testing |
| `reference/` | Reference InDesign document showing the target layout |

---

## Requirements

- Adobe InDesign (any recent version supporting ExtendScript)
- A UTF-8 encoded CSV file with a header row
- A text frame in your document where the book list should appear

---

## Quick Start

1. Open your InDesign document.
2. Click inside the text frame where book entries should be inserted.
3. Open the Scripts panel: **Window > Utilities > Scripts**.
4. Navigate to `import-booklist.jsx` and double-click it.
5. Select your CSV file when prompted.
6. Done — one paragraph per book record is inserted.

---

## CSV Format

- UTF-8 encoding (with or without BOM)
- First row must be a header row with column names matching the `label` values in `booklist-config.json`
- Column order does not matter — matching is done by header name
- Empty cells are treated as absent fields (their dividers are suppressed)
- Quoted fields (RFC 4180) are supported — use `"` to wrap fields containing commas

### Default expected column names

```
Title, Author, ISNI, Publisher, Publishing location,
Translator, Translated by, ISBN, Form, Copyright and year
```

Not all columns need to be present in the CSV. Unrecognised columns are ignored.

---

## Configuration (`booklist-config.json`)

```json
{
  "csvDelimiter": ",",
  "paragraphStyle": "Boeklijst item",
  "insertMode": "selectedFrame",
  "fields": [ ... ],
  "dividers": [ ... ]
}
```

| Key | Description |
|---|---|
| `csvDelimiter` | Column separator character in the CSV (default: `,`) |
| `paragraphStyle` | Exact name of the InDesign paragraph style to apply to each entry |
| `insertMode` | `"selectedFrame"` (default) inserts into the selected frame; `"newFrame"` creates a new frame |
| `fields` | Ordered array of field definitions (see below) |
| `dividers` | Array of strings inserted between consecutive present fields (length must be `fields.length - 1`) |

### Field definition

```json
{ "key": "isni", "label": "ISNI", "prefix": "(", "suffix": ")" }
```

| Property | Required | Description |
|---|---|---|
| `key` | Yes | Internal identifier (used in `dividers` logic) |
| `label` | Yes | CSV column header name to match |
| `prefix` | No | String prepended to the value when the field is present |
| `suffix` | No | String appended to the value when the field is present |

`prefix` and `suffix` are applied only when the field has a value, making it safe to use parentheses (e.g. around ISNI) without leaving stray brackets when the field is absent.

### Divider logic

The `dividers` array has one entry fewer than `fields`. Entry `i` is the separator inserted between `fields[i]` and `fields[i+1]`.

When a field is absent, its divider is suppressed and the divider of the next present field is used instead. This ensures no double-punctuation when fields are skipped.

**Example** — fields `[Title, Author, ISNI, Publisher]`, dividers `[". ", " ", ". "]`:

| Present fields | Result |
|---|---|
| All four | `Title. Author (ISNI). Publisher` |
| ISNI absent | `Title. Author. Publisher` |
| Author and ISNI absent | `Title. Publisher` |

---

## Paragraph Style

The script applies the paragraph style named in `"paragraphStyle"` to every inserted line. If the style does not exist in the document, a warning is shown and the text is inserted without a style.

Make sure the paragraph style exists in your document before running the script, or create it afterwards and apply it manually.

---

## Known Limitations

- Multi-line CSV fields (quoted fields containing literal newlines) are not supported.
- Each book record receives the same paragraph style. To use different styles per field, consider InDesign's tagged text format instead.
- The script inserts at the end of the target story. To insert at a specific position, place your cursor there before running.
