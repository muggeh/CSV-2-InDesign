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
 *   For each present field after the first, use dividers[field.originalIndex - 1].
 *   Absent fields suppress their own dividers without leaving gaps.
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
        var dividerIndex = present[p].index - 1;
        segments.push({ text: dividers[dividerIndex], type: "divider" });
        segments.push({ text: present[p].value,       type: "field"   });
    }

    return segments;
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

    // Resolve optional character styles
    var charStyleTitle   = null;
    var charStyleDivider = null;
    if (config.characterStyles) {
        if (config.characterStyles.title) {
            charStyleTitle   = resolveCharStyle(doc, config.characterStyles.title);
        }
        if (config.characterStyles.divider) {
            charStyleDivider = resolveCharStyle(doc, config.characterStyles.divider);
        }
    }

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
                if      (seg.type === "title"   && charStyleTitle)   { charStyle = charStyleTitle;   }
                else if (seg.type === "divider" && charStyleDivider) { charStyle = charStyleDivider; }

                if (charStyle) {
                    story.characters
                         .itemByRange(story.characters[charsBefore],
                                      story.characters[charsAfter - 1])
                         .applyCharacterStyle(charStyle);
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
            story.paragraphs[p].applyParagraphStyle(paraStyle, true);
        }
    }

    alert(
        "Done.\n" +
        recordSegments.length + " book record" +
        (recordSegments.length === 1 ? "" : "s") + " inserted."
    );
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
