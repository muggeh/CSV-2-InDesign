# CSV-2-InDesign — User Guide

## Table of Contents

1. [What this tool does](#1-what-this-tool-does)
2. [Requirements](#2-requirements)
3. [File overview](#3-file-overview)
4. [First-time setup in InDesign](#4-first-time-setup-in-indesign)
5. [Preparing your CSV file](#5-preparing-your-csv-file)
6. [The configuration file](#6-the-configuration-file)
7. [Running the script](#7-running-the-script)
8. [Formatting features](#8-formatting-features)
9. [Troubleshooting](#9-troubleshooting)
10. [Complete configuration reference](#10-complete-configuration-reference)

---

## 1. What this tool does

CSV-2-InDesign is an Adobe InDesign script that reads a CSV file containing a list of books and their metadata, and inserts the entries as formatted text into a text frame in your InDesign document.

For each book record in the CSV, the script:

- Assembles the available fields into a single formatted entry
- Skips any fields that are empty, suppressing their dividers automatically
- Applies paragraph and character styles defined in your InDesign document
- Optionally inserts an empty line between records

A typical entry might look like:

```
De hongerwinter  |  Henk van Oord (0000000123456789). Querido, Amsterdam. 978-90-214-1234-5. Paperback, © 2021
```

Or, with a line break after the title:

```
De hongerwinter
Henk van Oord (0000000123456789). Querido, Amsterdam. 978-90-214-1234-5. Paperback, © 2021
```

The exact format is fully configurable through the config file.

---

## 2. Requirements

- **Adobe InDesign** — any version that supports ExtendScript (CS6 through current)
- A **UTF-8 encoded CSV file** with a header row
- A text frame in your InDesign document where the entries should appear

---

## 3. File overview

```
CSV-2-InDesign/
  import-booklist.jsx       The script. Run this from InDesign's Scripts panel.
  booklist-config.json      Configuration file. Edit this to match your document
                            and your desired output format.
  sample-booklist.csv       A sample CSV for testing.
  reference/                Folder for reference InDesign documents.
  user-guide.md             This file.
  README.md                 Short overview and quick-start.
```

The script and the config file must be in the **same folder**. If they are separated, the script will prompt you to locate the config file manually.

---

## 4. First-time setup in InDesign

Before running the script for the first time, create the paragraph and character styles the script will apply to the inserted text. The style names must match exactly what you set in `booklist-config.json`.

### 4.1 Paragraph style (required)

This style is applied to every inserted book entry. Open the **Paragraph Styles** panel (**Window > Styles > Paragraph Styles**) and create a new style.

Suggested settings:

| Setting | Example value |
|---|---|
| Name | `Boeklijst item` |
| Font | Your body font, e.g. Minion Pro Regular 9/11 |
| Space Before | `3 mm` (if you want spacing between records without using empty lines) |
| Hyphenation | Off (book titles should not be hyphenated) |

The name you choose here must be entered as `"paragraphStyle"` in the config file.

### 4.2 Character style for titles (optional)

If you want book titles to appear in bold (or a different typeface), create a character style.

**Window > Styles > Character Styles > New Character Style**

| Setting | Value |
|---|---|
| Name | `Boeklijst titel` |
| Font Style | Bold (or Bold Italic, etc.) |
| All other settings | Leave on `[Same as Paragraph Style]` |

Only set the properties you want to override — leave everything else unset so the paragraph style's settings remain in effect.

### 4.3 Character style for dividers (optional)

If you want the divider strings (e.g. `  |  `) to appear in a different colour or weight:

**New Character Style**

| Setting | Value |
|---|---|
| Name | `Boeklijst divider` |
| Character Color | Pick a colour from your swatches |
| Font Style | Leave as `[Same as Paragraph Style]` unless you want a different weight |

### 4.4 Adding the styles to the config

Open `booklist-config.json` and make sure the style names match:

```json
"paragraphStyle": "Boeklijst item",

"characterStyles": {
    "title":   "Boeklijst titel",
    "divider": "Boeklijst divider"
}
```

The character styles are optional. If you do not want either, you can remove the `"characterStyles"` block entirely, or simply remove the individual key you do not need.

---

## 5. Preparing your CSV file

### 5.1 Format requirements

- **Encoding**: UTF-8 (with or without BOM — both are handled)
- **First row**: a header row with column names
- **Delimiter**: comma `,` by default (configurable)
- **Quoting**: fields containing commas must be wrapped in double quotes, e.g. `"War, Memory and Identity"`
- **Empty fields**: leave the cell blank — the script will treat it as absent and suppress the surrounding divider

### 5.2 Column names

The column names in the header row must match the `"label"` values defined in `booklist-config.json`. The default labels and their meaning are:

| Column name | Description |
|---|---|
| `Title` | Book title |
| `Author` | Author name(s) |
| `ISNI` | International Standard Name Identifier |
| `Publisher` | Publisher name |
| `Publishing location` | City of publication |
| `Translator` | Translator name(s) |
| `Translated by` | Language translated from (e.g. "From the English") |
| `ISBN` | ISBN-13 |
| `Form` | Physical form (e.g. Paperback, Hardcover) |
| `Copyright and year` | Copyright notice and year (e.g. © 2021) |

You do not need to include all columns — the script will simply treat any missing column as always absent. Columns whose names do not match any label in the config are ignored.

**Column order does not matter.** Matching is done by header name, not position.

### 5.3 Example CSV

```csv
Title,Author,ISNI,Publisher,Publishing location,Translator,Translated by,ISBN,Form,Copyright and year
De hongerwinter,Henk van Oord,0000000123456789,Querido,Amsterdam,,,978-90-214-1234-5,Paperback,© 2021
Het verdriet van België,Hugo Claus,,De Bezige Bij,Amsterdam,,,978-90-234-5678-1,Hardcover,© 1983
"War, Memory and Identity",Anne Frank,,Boom,Amsterdam,Jan de Vries,From the English,978-90-8953-123-4,Paperback,© 2019
De aanslag,Harry Mulisch,,De Bezige Bij,Amsterdam,,,,Paperback,© 1982
```

Record 1 uses all fields. Record 2 has no ISNI, Translator, or Translated by. Record 3 has a comma in the title (handled by quoting). Record 4 has no ISNI, Translator, Translated by, or ISBN.

### 5.4 Saving from Excel or Numbers

- **Excel (Windows)**: File > Save As > CSV UTF-8 (Comma delimited)
- **Excel (Mac)**: File > Save As > CSV UTF-8
- **Numbers**: File > Export To > CSV > Unicode (UTF-8)
- **LibreOffice Calc**: File > Save As > Text CSV, set character set to UTF-8

---

## 6. The configuration file

`booklist-config.json` controls everything about how the script formats and inserts the book entries. Open it in any text editor.

### 6.1 Top-level settings

```json
{
  "csvDelimiter":            ",",
  "paragraphStyle":          "Boeklijst item",
  "insertMode":              "selectedFrame",
  "emptyLineBetweenRecords": true
}
```

| Key | Type | Default | Description |
|---|---|---|---|
| `csvDelimiter` | string | `","` | The column separator character in the CSV file. Use `";"` for semicolon-delimited files. |
| `paragraphStyle` | string | — | **Required.** The exact name of the InDesign paragraph style to apply to each entry. |
| `insertMode` | string | `"selectedFrame"` | Where to insert the text. See section 6.5. |
| `emptyLineBetweenRecords` | boolean | `false` | When `true`, an empty paragraph is inserted before each record (from the second onwards). |

### 6.2 The `fields` array

Defines which fields exist, in what order they appear in the output, and how to find them in the CSV.

```json
"fields": [
    { "key": "title",   "label": "Title" },
    { "key": "author",  "label": "Author" },
    { "key": "isni",    "label": "ISNI",  "prefix": "(", "suffix": ")" },
    ...
]
```

Each entry has:

| Property | Required | Description |
|---|---|---|
| `key` | Yes | Internal identifier. Must be unique. Used only internally — not visible in output. |
| `label` | Yes | The column header name in the CSV. Must match exactly (case-sensitive). |
| `prefix` | No | A string prepended to the field value when the field is present. |
| `suffix` | No | A string appended to the field value when the field is present. |

`prefix` and `suffix` are **only applied when the field has a value**. When the field is absent, no prefix or suffix appears. This makes it safe to wrap a field in parentheses — you will never get stray `()` in the output.

Example: ISNI with `"prefix": "("` and `"suffix": ")"`:
- ISNI = `0000000123456789` → output: `(0000000123456789)`
- ISNI = _(empty)_ → output: nothing

### 6.3 The `dividers` array

Defines the text inserted between consecutive fields. There must always be **exactly one fewer divider than there are fields**.

```
fields:   [ Title,    Author,   ISNI,   Publisher,  ...  ]
dividers: [       d0,       d1,      d2,          d3 ...  ]
```

Divider `d0` sits between Title and Author, `d1` between Author and ISNI, and so on.

Each entry can be either a **plain string** or an **object** with a `"text"` and optional `"style"` property:

```json
"dividers": [
    "  |  ",
    " ",
    ". ",
    { "text": " - ", "style": "Boeklijst divider B" },
    "  |  ",
    ", ",
    ". ",
    ". ",
    ", "
]
```

Plain strings use the global `"characterStyles": { "divider": "..." }` style (if set). An object with `"style"` overrides that with a specific character style for that one divider position. Both formats can be freely mixed in the same array.

If you want a divider to have no character style at all — even when a global `"divider"` style is set — omit the `"style"` key or set it to `null`:

```json
{ "text": "  |  " }
{ "text": "  |  ", "style": null }
```

#### Divider suppression when a field is absent

When a field is absent, its surrounding dividers are not simply left as-is. Instead, the script uses the divider that "belongs to" the next present field — meaning the divider immediately to the left of that field in the array. Absent fields effectively skip over their slot.

**Example** — fields `[Title, Author, ISNI, Publisher]`, dividers `["  |  ", " ", ". "]`:

| Present fields | Result |
|---|---|
| All four | `Title  \|  Author (ISNI). Publisher` |
| ISNI absent | `Title  \|  Author. Publisher` |
| Author and ISNI absent | `Title. Publisher` |
| Only Title | `Title` |

This ensures the output is always clean, with no double punctuation or orphaned separators.

#### Designing dividers that work with absent fields

Because the divider used is always the one belonging to the right-hand field, each divider must read naturally both when its left-hand field is present and when it is not.

For example, divider `d2` (between ISNI and Publisher) is `". "`. This works:
- When ISNI is present: `Author (ISNI). Publisher` ✓
- When ISNI is absent: `Author. Publisher` ✓

A divider like `") "` would fail when ISNI is absent: `Author) Publisher` ✗. This is why ISNI uses `prefix`/`suffix` instead of building the parentheses into the dividers.

### 6.4 Character styles

```json
"characterStyles": {
    "title":   "Boeklijst titel",
    "divider": "Boeklijst divider"
}
```

| Key | Description |
|---|---|
| `title` | Character style applied to the title (the first field in the `fields` array). |
| `divider` | Default character style applied to every divider string that has no per-divider style. |

Both keys are optional. Remove any key you do not want applied. Remove the entire `"characterStyles"` block if you want no character-level formatting.

#### Per-divider styles

Individual dividers can override the global `"divider"` style by using the object format in the `"dividers"` array (see section 6.3). This allows different dividers to have different colours or other formatting:

```json
"characterStyles": {
    "title":   "Boeklijst titel",
    "divider": "Boeklijst divider grijs"
},

"dividers": [
    { "text": "  |  ", "style": "Boeklijst divider rood" },
    " ",
    ". ",
    { "text": " - ",   "style": "Boeklijst divider blauw" },
    "  |  "
]
```

In this example, `  |  ` uses `Boeklijst divider rood`, ` - ` uses `Boeklijst divider blauw`, and the plain-string dividers (` `, `. `, and the second `  |  `) fall back to the global `Boeklijst divider grijs`.

**Priority order**: per-divider `"style"` → global `"characterStyles": { "divider" }` → no style applied.

All named styles must exist in the InDesign document before the script runs. If a style is not found, the script shows a warning once per missing style name and continues without applying it.

### 6.5 Insert mode

```json
"insertMode": "selectedFrame"
```

| Value | Behaviour |
|---|---|
| `"selectedFrame"` | Inserts into the text frame that is selected in InDesign. You must select a frame before running the script. |
| `"newFrame"` | Creates a new text frame covering most of the last page and inserts there. |

### 6.6 Empty lines between records

```json
"emptyLineBetweenRecords": true
```

When `true`, the script inserts an empty paragraph before each record (except the first). The empty paragraph receives the same paragraph style as the book entries.

**Alternative approach**: Set this to `false` and instead add **Space Before** to the paragraph style itself (e.g. `3 mm`). This is typically more precise typographically because the spacing is controlled by the style rather than by an extra character, and it does not create an empty paragraph at the very top of the frame.

---

## 7. Running the script

### Step 1 — Install the script

Place `import-booklist.jsx` and `booklist-config.json` in a location accessible from InDesign's Scripts panel. The easiest option is to copy them to InDesign's user scripts folder:

- **macOS**: `~/Library/Preferences/Adobe InDesign/[version]/[language]/Scripts/Scripts Panel/`
- **Windows**: `%APPDATA%\Adobe\InDesign\[version]\[language]\Scripts\Scripts Panel\`

Alternatively, you can run the script from any location using the Scripts panel's navigation.

### Step 2 — Open your document

Open the InDesign document you want to populate. Make sure the paragraph style and any character styles are already defined (see section 4).

### Step 3 — Select the target text frame

Click inside the text frame where the book entries should be inserted. The script inserts at the **end** of the frame's story, so position your cursor there if the frame already contains text you want to keep.

If `"insertMode"` is set to `"newFrame"`, skip this step.

### Step 4 — Run the script

Open the Scripts panel (**Window > Utilities > Scripts**). Navigate to `import-booklist.jsx` and double-click it.

### Step 5 — Select your CSV file

A file picker will appear. Navigate to your CSV file and click Open.

### Step 6 — Done

The script inserts all records and shows a summary alert. Click OK. The entries are now in your text frame with paragraph and character styles applied.

---

## 8. Formatting features

### 8.1 Bold titles

Create a character style with bold font weight (see section 4.2) and set its name as `"characterStyles": { "title": "..." }` in the config. The script applies this style to the title of every book record.

### 8.2 Coloured or styled dividers

Create a character style with the desired colour or other formatting (see section 4.3) and set `"characterStyles": { "divider": "..." }`. This style is applied to every divider string in every record — including `  |  `, `. `, `, `, and any other string you have defined.

### 8.3 Empty line between records

Set `"emptyLineBetweenRecords": true` in the config. An empty paragraph is inserted before each record from the second one onwards. For more typographic control, use Space Before on the paragraph style instead (see section 6.6).

### 8.4 Line break within a record

To continue a field on a new line within the same paragraph, use `"\n"` as the divider value at that position. This inserts a **forced line break** (soft return), keeping the two lines part of the same paragraph.

Example — to break after the title:

```json
"dividers": [
    "\n",
    " ",
    ". ",
    ...
]
```

Result:
```
De hongerwinter
Henk van Oord (0000000123456789). Querido, Amsterdam. ...
```

The title and the remaining fields are still one paragraph. The paragraph style's indentation and spacing settings apply to the whole entry.

To start a completely new paragraph at that point instead (which would receive its own paragraph style application), use `"\r"` instead of `"\n"`. Note that paragraph returns inside records are less common and can complicate paragraph-level formatting.

### 8.5 Prefix and suffix on a field

Use the `"prefix"` and `"suffix"` properties on a field to wrap its value in fixed strings — for example, parentheses around ISNI:

```json
{ "key": "isni", "label": "ISNI", "prefix": "(", "suffix": ")" }
```

The prefix and suffix are only applied when the field has a value. When the field is absent, nothing is added.

---

## 9. Troubleshooting

### "booklist-config.json was not found next to the script"

The script expects `booklist-config.json` to be in the same folder as `import-booklist.jsx`. A file picker will appear so you can locate it manually. To avoid this prompt in the future, move both files to the same folder.

### "Config is missing required key"

Your config file is missing one of the required keys: `"fields"`, `"dividers"`, or `"paragraphStyle"`. Open the file in a text editor and check that all three are present.

### "dividers must have exactly N entries"

The `"dividers"` array must have exactly one fewer entry than the `"fields"` array. Count your fields and dividers and correct the mismatch. A config with 10 fields needs exactly 9 dividers.

### "Config JSON parse error"

The config file contains invalid JSON. Common causes:
- A trailing comma after the last item in an array or object
- A missing comma between items
- Unescaped special characters in a string

Open the file in a text editor or paste it into an online JSON validator to find the error.

### "Warning: paragraph style not found"

The paragraph style named in `"paragraphStyle"` does not exist in the currently open InDesign document. Check that the name matches exactly (including capitalisation and spaces). The script will continue without applying the style.

### "Warning: character style not found"

Same as above, but for a character style. The script will continue and insert the text without that style applied.

### "No text frame is selected"

You must click inside a text frame in your document before running the script. Simply clicking on the frame is sufficient — an active text cursor is not required if you click the frame with the Selection tool.

### Fields appear in the wrong order or are missing

Check that the column header names in your CSV match the `"label"` values in the config exactly (case-sensitive, no extra spaces). The script maps columns by name, not by position.

### Unexpected dividers appear / dividers are missing

Verify that the `"dividers"` array has the correct number of entries and that each entry is at the correct index. Remember: divider at index `i` sits between `fields[i]` and `fields[i+1]`.

### Special characters (©, é, ü, etc.) appear garbled

Save your CSV as UTF-8. In Excel on Windows, use **Save As > CSV UTF-8 (Comma delimited)** — not the plain **CSV** option, which uses a legacy encoding that can corrupt special characters.

---

## 10. Complete configuration reference

Below is a fully annotated example of `booklist-config.json` showing every available option.

```json
{
  // Column separator used in the CSV file.
  // Default: ","  —  use ";" for semicolon-separated files.
  "csvDelimiter": ",",

  // Exact name of the InDesign paragraph style applied to every book entry.
  // The style must exist in the document before the script runs.
  "paragraphStyle": "Boeklijst item",

  // Where to insert the text.
  // "selectedFrame"  — inserts into the currently selected text frame (default).
  // "newFrame"       — creates a new text frame on the last page of the document.
  "insertMode": "selectedFrame",

  // When true, an empty paragraph is inserted before each record (except the first).
  // Default: false
  "emptyLineBetweenRecords": true,

  // Optional character styles.
  // Remove any key whose style you do not want applied.
  // Remove the entire "characterStyles" block to disable character-level formatting.
  "characterStyles": {
    // Style applied to the title field (the first field in the "fields" array).
    "title":   "Boeklijst titel",

    // Style applied to every divider string.
    "divider": "Boeklijst divider"
  },

  // Ordered list of fields. The output for each record follows this order.
  // Fields not present in the CSV (or with an empty value) are skipped,
  // and their dividers are suppressed automatically.
  "fields": [
    // "key"    — internal identifier. Must be unique. Not visible in output.
    // "label"  — must match the CSV column header exactly (case-sensitive).
    // "prefix" — optional string prepended to the value when the field is present.
    // "suffix" — optional string appended to the value when the field is present.

    { "key": "title",              "label": "Title" },
    { "key": "author",             "label": "Author" },
    { "key": "isni",               "label": "ISNI",              "prefix": "(", "suffix": ")" },
    { "key": "publisher",          "label": "Publisher" },
    { "key": "publishingLocation", "label": "Publishing location" },
    { "key": "translator",         "label": "Translator" },
    { "key": "translatedBy",       "label": "Translated by" },
    { "key": "isbn",               "label": "ISBN" },
    { "key": "form",               "label": "Form" },
    { "key": "copyright",          "label": "Copyright and year" }
  ],

  // Divider strings inserted between consecutive present fields.
  // Must have exactly (fields.length - 1) entries = 9 entries for 10 fields.
  //
  // Index i sits between fields[i] and fields[i+1]:
  //   index 0  between Title            and Author
  //   index 1  between Author           and ISNI
  //   index 2  between ISNI             and Publisher
  //   index 3  between Publisher        and Publishing location
  //   index 4  between Publishing loc.  and Translator
  //   index 5  between Translator       and Translated by
  //   index 6  between Translated by    and ISBN
  //   index 7  between ISBN             and Form
  //   index 8  between Form             and Copyright and year
  //
  // Special values:
  //   "\n"  — forced line break (soft return). The next field starts on a new line
  //           but remains in the same paragraph.
  //   "\r"  — hard paragraph return. The next field starts a new paragraph.
  "dividers": [
    "  |  ",
    " ",
    ". ",
    ", ",
    "  |  ",
    ", ",
    ". ",
    ". ",
    ", "
  ]
}
```

> **Note**: The JSON format does not support comments. The annotations above are for documentation purposes only — remove them if you paste this directly into your config file, as they will cause a parse error.

---

*CSV-2-InDesign — ExtendScript tool for Adobe InDesign*
