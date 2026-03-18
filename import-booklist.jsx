/**
 * import-booklist.jsx
 * CSV-to-InDesign book list importer
 *
 * Reads a UTF-8 CSV file of book metadata and inserts formatted
 * entries into the selected text frame of the active InDesign document.
 * Field order, dividers, paragraph style, and character styles are defined
 * in booklist-config.json.
 *
 * Usage:
 *   1. Open your InDesign document.
 *   2. Select the text frame where entries should be inserted.
 *   3. Run this script from the Scripts panel.
 *   4. Select your CSV file when prompted.
 *
 * The script looks for booklist-config.json in the same folder as itself.
 * If not found there, a file picker dialog will appear.
 */

#target indesign
#targetengine main

(function () {

    // -------------------------------------------------------------------------
    // Entry point
    // -------------------------------------------------------------------------

    var scriptFile = new File($.fileName);

    // 1. Locate config file
    var configFile = locateConfigFile(scriptFile);
    if (!configFile) { return; }

    // 2. Select CSV file
    var csvFile = File.openDialog("Select book list CSV file", "CSV:*.csv,Text:*.txt,All:*.*");
    if (!csvFile) { return; }

    // 3. Load and validate config
    var config = loadConfig(configFile);
    if (!config) { return; }

    // 4. Parse CSV
    var records = parseCSV(csvFile, config.csvDelimiter);
    if (!records) { return; }
    if (records.length < 2) {
        alert("The CSV file contains no data rows (only a header row or is empty).");
        return;
    }

    // 5. Map CSV header to field keys
    var headerMap = buildHeaderMap(records[0], config.fields);

    // 6. Build segment lists for each record
    //    Each record is an array of { text, type } segments
    //    type: "title" | "divider" | "field"
    var recordSegments = [];
    for (var i = 1; i < records.length; i++) {
        var segs = buildSegments(records[i], headerMap, config.fields, config.dividers);
        if (segs.length > 0) {
            recordSegments.push(segs);
        }
    }

    if (recordSegments.length === 0) {
        alert("No non-empty records were found in the CSV file.");
        return;
    }

    // 7. Insert into document
    insertIntoDocument(recordSegments, config);

})();


// =============================================================================
// Config loading
// =============================================================================

function locateConfigFile(scriptFile) {
    var defaultConfig = new File(scriptFile.parent + "/booklist-config.json");
    if (defaultConfig.exists) {
        return defaultConfig;
    }
    alert("booklist-config.json was not found next to the script.\nPlease locate it manually.");
    var picked = File.openDialog("Select booklist-config.json", "JSON:*.json,All:*.*");
    return picked || null;
}

function loadConfig(file) {
    file.encoding = "UTF-8";
    if (!file.open("r")) {
        alert("Cannot open config file:\n" + file.fsName);
        return null;
    }
    var raw = file.read();
    file.close();

    var config;
    try {
        config = eval("(" + raw + ")");
    } catch (e) {
        alert("Config JSON parse error:\n" + e.message);
        return null;
    }

    // Validate required keys
    var required = ["fields", "dividers", "paragraphStyle"];
    for (var i = 0; i < required.length; i++) {
        if (config[required[i]] === undefined) {
            alert("Config is missing required key: \"" + required[i] + "\"");
            return null;
        }
    }

    if (!config.fields.length) {
        alert("Config \"fields\" array is empty.");
        return null;
    }

    if (config.dividers.length !== config.fields.length - 1) {
        alert(
            "Config error: \"dividers\" must have exactly " +
            (config.fields.length - 1) +
            " entries (one fewer than \"fields\").\n" +
            "Currently has " + config.dividers.length + " entries."
        );
        return null;
    }

    // Apply defaults for optional keys
    if (config.csvDelimiter            === undefined) { config.csvDelimiter            = ","; }
    if (config.insertMode              === undefined) { config.insertMode              = "selectedFrame"; }
    if (config.emptyLineBetweenRecords === undefined) { config.emptyLineBetweenRecords = false; }

    // Normalize dividers: plain strings become { text, style: null }
    // Objects with { "text", "style" } are kept as-is (style may be omitted/null)
    for (var d = 0; d < config.dividers.length; d++) {
        var entry = config.dividers[d];
        if (typeof entry === "string") {
            config.dividers[d] = { text: entry, style: null };
        } else {
            if (typeof entry.style === "undefined") { entry.style = null; }
        }
    }

    return config;
}


// =============================================================================
// CSV parsing
// =============================================================================

function parseCSV(file, delimiter) {
    file.encoding = "UTF-8";
    if (!file.open("r")) {
        alert("Cannot open CSV file:\n" + file.fsName);
        return null;
    }
    var raw = file.read();
    file.close();

    // Strip UTF-8 BOM if present
    raw = raw.replace(/^\uFEFF/, "");

    // Normalize line endings to \n
    raw = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    var rawLines = raw.split("\n");
    var records  = [];
    for (var i = 0; i < rawLines.length; i++) {
        var line = rawLines[i];
        if (line.replace(/\s/g, "") === "") { continue; }
        records.push(parseCSVLine(line, delimiter));
    }
    return records;
}

/**
 * Parse a single CSV line into an array of field strings.
 * Handles RFC 4180: quoted fields, commas inside quotes, escaped quotes ("").
 */
function parseCSVLine(line, delimiter) {
    var fields   = [];
    var field    = "";
    var inQuotes = false;

    for (var i = 0; i < line.length; i++) {
        var ch   = line.charAt(i);
        var next = line.charAt(i + 1);

        if (inQuotes) {
            if (ch === '"') {
                if (next === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === delimiter) {
                fields.push(field);
                field = "";
            } else {
                field += ch;
            }
        }
    }
    fields.push(field);
    return fields;
}


// =============================================================================
// Header mapping
// =============================================================================

/**
 * Build a map from field key -> CSV column index, using the label in config.
 * Strips leading BOM and surrounding whitespace from header cells.
 */
function buildHeaderMap(headerRow, fields) {
    var map = {};
    for (var f = 0; f < fields.length; f++) {
        var label = trim(fields[f].label);
        for (var c = 0; c < headerRow.length; c++) {
            var cell = trim(headerRow[c]).replace(/^\uFEFF/, "");
            if (cell === label) {
                map[fields[f].key] = c;
                break;
            }
        }
    }
    return map;
}


// =============================================================================
// Segment building
// =============================================================================

/**
 * Build an ordered array of text segments for one book record.
 * Each segment: { text: string, type: "title" | "divider" | "field" }
 *
 * The "title" type is assigned to the first field in the config (index 0).
 * All inserted divider strings get type "divider".
 * All other field values get type "field".
 *
 * Divider algorithm:
 *   For each present field after the first, scan the dividers between the previous
 *   present field and this one. If a line-break divider (\n or \r) is found in that
 *   gap, use it — preserving the line break even when the field directly after the
 *   \n is absent. Otherwise fall back to the divider immediately left of this field.
 *
 *   This prevents a trailing divider at the end of a line: when the field after a
 *   \n is absent, the \n is still used rather than the | of the next present field.
 */
function buildSegments(row, headerMap, fields, dividers) {
    var present = [];
    for (var f = 0; f < fields.length; f++) {
        var key    = fields[f].key;
        var colIdx = headerMap[key];
        var value  = "";

        if (colIdx !== undefined && colIdx < row.length) {
            value = trim(row[colIdx]);
        }

        if (value !== "") {
            if (fields[f].prefix) { value = fields[f].prefix + value; }
            if (fields[f].suffix) { value = value + fields[f].suffix; }
            present.push({ value: value, index: f });
        }
    }

    if (present.length === 0) { return []; }

    var segments = [];
    segments.push({
        text: present[0].value,
        type: present[0].index === 0 ? "title" : "field"
    });

    for (var p = 1; p < present.length; p++) {
        var div = selectDivider(dividers, present[p - 1].index, present[p].index);
        segments.push({ text: div.text, type: "divider", dividerStyle: div.style });
        segments.push({ text: present[p].value, type: "field" });
    }

    return segments;
}

/**
 * Pick the divider to insert between two consecutive present fields.
 *
 * Scans all dividers in the gap [prevIndex .. currIndex - 1].
 * If a line-break divider (\n or \r) is found, it is returned so that the
 * line break is preserved even when the field directly to its right is absent.
 * Otherwise returns dividers[currIndex - 1] (the standard right-hand rule).
 */
function selectDivider(dividers, prevIndex, currIndex) {
    for (var d = prevIndex; d < currIndex; d++) {
        if (dividers[d].text === "\n" || dividers[d].text === "\r") {
            return dividers[d];
        }
    }
    return dividers[currIndex - 1];
}


// =============================================================================
// InDesign insertion
// =============================================================================

function insertIntoDocument(recordSegments, config) {
    if (!app.documents.length) {
        alert("No InDesign document is open.");
        return;
    }
    var doc = app.activeDocument;

    // Resolve paragraph style
    var paraStyle = resolveParaStyle(doc, config.paragraphStyle);

    // [None] character style — used to remove any applied character style
    // on segments that should carry no explicit styling
    var noneCharStyle = doc.characterStyles[0];

    // Resolve optional character styles
    var charStyleTitle   = null;
    var charStyleField   = null;
    var charStyleDivider = null;
    if (config.characterStyles) {
        if (config.characterStyles.title) {
            charStyleTitle   = resolveCharStyle(doc, config.characterStyles.title);
        }
        if (config.characterStyles.field) {
            charStyleField   = resolveCharStyle(doc, config.characterStyles.field);
        }
        if (config.characterStyles.divider) {
            charStyleDivider = resolveCharStyle(doc, config.characterStyles.divider);
        }
    }

    // Cache for per-divider character styles (resolved lazily, once per style name)
    var dividerStyleCache = {};

    // Get target text frame
    var frame = getTargetFrame(doc, config.insertMode);
    if (!frame) { return; }

    var story = frame.parentStory;

    // Remember paragraph count before insertion
    var paragraphsBefore = story.paragraphs.length;

    // Start at end of story
    var insertionPoint = story.insertionPoints[-1];

    // If story already has content, open with a new paragraph
    if (story.characters.length > 0) {
        insertionPoint.contents = "\r";
        insertionPoint = story.insertionPoints[-1];
    }

    for (var r = 0; r < recordSegments.length; r++) {
        var segs = recordSegments[r];

        // Optional empty line before each record after the first
        if (config.emptyLineBetweenRecords && r > 0) {
            insertionPoint.contents = "\r";
            insertionPoint = story.insertionPoints[-1];
        }

        // Insert each segment and apply character style immediately
        for (var s = 0; s < segs.length; s++) {
            var seg         = segs[s];
            var charsBefore = story.characters.length;

            insertionPoint.contents = seg.text;
            insertionPoint = story.insertionPoints[-1];

            var charsAfter = story.characters.length;
            var rangeLen   = charsAfter - charsBefore;

            if (rangeLen > 0) {
                var charStyle = null;
                if (seg.type === "title" && charStyleTitle) {
                    charStyle = charStyleTitle;
                } else if (seg.type === "field" && charStyleField) {
                    charStyle = charStyleField;
                } else if (seg.type === "divider") {
                    if (seg.dividerStyle) {
                        // Resolve per-divider style lazily; cache to avoid repeated lookups
                        if (dividerStyleCache[seg.dividerStyle] === undefined) {
                            dividerStyleCache[seg.dividerStyle] = resolveCharStyle(doc, seg.dividerStyle);
                        }
                        charStyle = dividerStyleCache[seg.dividerStyle] || charStyleDivider;
                    } else {
                        charStyle = charStyleDivider;
                    }
                }

                var range = story.characters.itemByRange(
                    story.characters[charsBefore],
                    story.characters[charsAfter - 1]
                );

                if (charStyle) {
                    // Apply the explicit character style (title bold, divider colour, field, etc.)
                    range.applyCharacterStyle(charStyle);
                } else {
                    // No explicit style: clear both applied character styles AND any locally
                    // inherited formatting (e.g. bold inherited from a preceding title).
                    // applyCharacterStyle([None]) alone does not remove local overrides.
                    range.applyCharacterStyle(noneCharStyle);
                    range.clearOverrides(OverrideType.CHARACTER_ONLY);
                }
            }
        }

        // Paragraph return after each record except the last
        if (r < recordSegments.length - 1) {
            insertionPoint.contents = "\r";
            insertionPoint = story.insertionPoints[-1];
        }
    }

    // Apply paragraph style to all newly inserted paragraphs
    if (paraStyle) {
        var totalParagraphs = story.paragraphs.length;
        for (var p = paragraphsBefore; p < totalParagraphs; p++) {
            story.paragraphs[p].applyParagraphStyle(paraStyle, false);
        }
    }

    // Hide dividers that land at the start or end of a visual line
    hideLineBoundaryDividers(frame, config, doc);

    alert(
        "Done.\n" +
        recordSegments.length + " book record" +
        (recordSegments.length === 1 ? "" : "s") + " inserted."
    );
}

/**
 * After insertion, scan every visual line in the text frame.
 * Any divider string that starts or ends a line is made invisible
 * by setting its fill colour to [Paper].
 *
 * The characters remain in place — no text reflows — only the colour
 * changes, so the spacing around the hidden divider is preserved.
 *
 * Note: if the text frame is later resized, run the script again
 * (after clearing the frame) so the line boundaries are re-evaluated.
 */
function hideLineBoundaryDividers(frame, config, doc) {
    // Collect unique non-linebreak divider strings, sorted longest-first
    // so that longer patterns are matched before shorter ones
    var divTexts = [];
    for (var d = 0; d < config.dividers.length; d++) {
        var t = config.dividers[d].text;
        if (t === "\n" || t === "\r" || t.length === 0) { continue; }
        var found = false;
        for (var x = 0; x < divTexts.length; x++) {
            if (divTexts[x] === t) { found = true; break; }
        }
        if (!found) { divTexts.push(t); }
    }
    divTexts.sort(function (a, b) { return b.length - a.length; });

    if (divTexts.length === 0) { return; }

    var paperSwatch = doc.swatches.itemByName("[Paper]");
    if (!paperSwatch || !paperSwatch.isValid) { return; }

    var story = frame.parentStory;

    // Force InDesign to finish composing the text before reading line positions
    app.redraw();

    // Safety check — frame must still be valid after redraw
    if (!frame.isValid) { return; }

    // Gather visual lines — try frame.lines first (lines visible in this frame),
    // fall back to story.lines if frame.lines is empty or inaccessible
    var lines;
    try {
        lines = frame.lines;
        if (!lines || lines.length === 0) {
            lines = story.lines;
        }
    } catch (e) {
        try { lines = story.lines; } catch (e2) { return; }
    }

    if (!lines || lines.length === 0) { return; }

    // First pass: collect character ranges to hide as absolute story indices.
    // We do this before applying any colour changes to avoid layout invalidation
    // during the scan.
    var rangesToHide = [];

    for (var i = 0; i < lines.length; i++) {
        var line     = lines[i];
        if (line.characters.length === 0) { continue; }

        var lineText      = line.contents;
        var lineStartIdx  = line.characters[0].index;  // absolute story position

        // Trim trailing paragraph/line-end characters for end-of-line matching
        var trimmed = lineText.replace(/[\r\n\u0003\u000B]$/, "");

        // Check whether the line STARTS with a divider
        for (var d = 0; d < divTexts.length; d++) {
            var div = divTexts[d];
            if (lineText.indexOf(div) === 0) {
                rangesToHide.push({ start: lineStartIdx, end: lineStartIdx + div.length - 1 });
                break;  // only one divider can start the line
            }
        }

        // Check whether the line ENDS with a divider
        for (var d = 0; d < divTexts.length; d++) {
            var div = divTexts[d];
            if (trimmed.length >= div.length) {
                var pos = trimmed.length - div.length;
                if (trimmed.lastIndexOf(div) === pos) {
                    rangesToHide.push({ start: lineStartIdx + pos, end: lineStartIdx + pos + div.length - 1 });
                    break;  // only one divider can end the line
                }
            }
        }
    }

    // Second pass: apply [Paper] colour to the collected ranges
    for (var r = 0; r < rangesToHide.length; r++) {
        try {
            story.characters
                 .itemByRange(story.characters[rangesToHide[r].start],
                              story.characters[rangesToHide[r].end])
                 .fillColor = paperSwatch;
        } catch (e) { /* skip ranges that have become invalid */ }
    }
}

function resolveParaStyle(doc, styleName) {
    try {
        var style = doc.paragraphStyles.itemByName(styleName);
        if (style.isValid) { return style; }
    } catch (e) { /* fall through */ }

    alert(
        "Warning: paragraph style \u201C" + styleName + "\u201D was not found " +
        "in the document.\nText will be inserted without a paragraph style."
    );
    return null;
}

function resolveCharStyle(doc, styleName) {
    try {
        var style = doc.characterStyles.itemByName(styleName);
        if (style.isValid) { return style; }
    } catch (e) { /* fall through */ }

    alert(
        "Warning: character style \u201C" + styleName + "\u201D was not found " +
        "in the document.\nFormatting for this style will be skipped."
    );
    return null;
}

function getTargetFrame(doc, insertMode) {
    if (insertMode === "newFrame") {
        return createNewFrame(doc);
    }

    var sel = app.selection;
    if (!sel || sel.length === 0) {
        alert("No text frame is selected.\nPlease click inside a text frame before running the script.");
        return null;
    }

    var item = sel[0];

    if (item.constructor.name === "TextFrame") {
        return item;
    }

    if (typeof item.parentTextFrames !== "undefined" && item.parentTextFrames.length > 0) {
        return item.parentTextFrames[0];
    }

    alert("The current selection is not a text frame.\nPlease select a text frame and try again.");
    return null;
}

function createNewFrame(doc) {
    var spread = doc.spreads[doc.spreads.length - 1];
    var page   = spread.pages[0];
    var b      = page.bounds;
    var margin = 20;
    return spread.textFrames.add({
        geometricBounds: [b[0] + margin, b[1] + margin, b[2] - margin, b[3] - margin]
    });
}


// =============================================================================
// Utilities
// =============================================================================

function trim(str) {
    return String(str).replace(/^\s+|\s+$/g, "");
}
