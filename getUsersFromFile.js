// getUsersFromFile.js
// WinIBW4 script function to read winibw_users.tsv using WinIBW API
// and return matching USER_WIN / USER_WEB entries for a given ELN or ILN.

// Usage examples:
// var results = getUsersFromTSV({ELN: '0010'});
// var results = getUsersFromTSV({ILN: '0044', filePath: 'h:\\WinIBW4\\switchUser\\winibw_users.tsv'});

function expandToken(token) {
    token = String(token).trim();
    if (token === '') return [];
    var ranges = token.match(/^(\d+)-(\d+)$/);
    if (ranges) {
        var start = parseInt(ranges[1], 10);
        var end = parseInt(ranges[2], 10);
        var out = [];
        if (end >= start) {
            for (var i = start; i <= end; i++) out.push(String(i));
        }
        return out;
    }
    return [token];
}

function splitField(field) {
    if (field === null || field === undefined) return [];
    var tokens = String(field).split(/[,;\s]+/).filter(function(t) { return t !== ''; });
    var expanded = [];
    for (var i = 0; i < tokens.length; i++) {
        var e = expandToken(tokens[i]);
        for (var j = 0; j < e.length; j++) expanded.push(e[j]);
    }
    return expanded.length ? expanded : [null];
}

function numericNormalize(s) {
    if (s === null || s === undefined) return null;
    var digits = String(s).replace(/\D+/g, '');
    return digits === '' ? null : parseInt(digits, 10);
}

function tryOpenFile(newFileInputObj, fullPath) {
    try {
        if (newFileInputObj.open(fullPath)) return true;
    } catch (e) {}
    return false;
}

function getUsersFromTSV(options) {
    options = options || {};
    var ELN = options.ELN || options.eln || null;
    var ILN = options.ILN || options.iln || null;
    var filePath = options.filePath || null; // absolute path if provided
    var results = [];
    var seen = {};

    if (!ELN && !ILN) {
        throw new Error('Provide ELN or ILN');
    }

    var fi = utility.newFileInput;
    var opened = false;

    // Try provided full path first
    if (filePath) {
        try {
            opened = fi.open(filePath);
        } catch (e) { opened = false; }
    }

    // Try common special directories
    if (!opened) {
        try {
            opened = fi.openSpecial('ProfD', '\\switchUser\\winibw_users.tsv');
        } catch (e) { opened = false; }
    }
    if (!opened) {
        try { opened = fi.openSpecial('BinDir', '\\switchUser\\winibw_users.tsv'); } catch (e) { opened = false; }
    }

    // Last resort: try filename in current working dir
    if (!opened) {
        try { opened = fi.open('winibw_users.tsv'); } catch (e) { opened = false; }
    }

    if (!opened) {
        throw new Error('Could not open winibw_users.tsv - provide filePath or place file in ProfD/BinDir');
    }

    // Read lines
    try {
        // If file has header, we'll skip lines starting with 'USER_WIN' etc.
        while (!fi.isEOF()) {
            var line = fi.readLine();
            if (!line) continue;
            // Split on tabs; some lines may use other separators, but TSV expected
            var cols = line.split('\t');
            // Trim columns
            for (var k = 0; k < cols.length; k++) cols[k] = cols[k] !== undefined ? cols[k].trim() : '';

            // Skip possible header row
            var hdr = (cols[0] || '').toLowerCase() + '\t' + (cols[1] || '').toLowerCase();
            if (hdr.indexOf('user_win') !== -1 || hdr.indexOf('user_web') !== -1) continue;

            var userWinField = cols[0] || '';
            var userWebField = cols[1] || '';
            var rowELN = cols[2] || '';
            var rowILN = cols[3] || '';

            var match = false;
            if (ELN) {
                if (rowELN === ELN) match = true;
                else {
                    var a = numericNormalize(rowELN);
                    var b = numericNormalize(ELN);
                    if (a !== null && b !== null && a === b) match = true;
                }
            }
            if (ILN && !match) {
                if (rowILN === ILN) match = true;
                else {
                    var a2 = numericNormalize(rowILN);
                    var b2 = numericNormalize(ILN);
                    if (a2 !== null && b2 !== null && a2 === b2) match = true;
                }
            }

            if (match) {
                var expandedWin = splitField(userWinField);
                var expandedWeb = splitField(userWebField);
                for (var i = 0; i < expandedWin.length; i++) {
                    for (var j = 0; j < expandedWeb.length; j++) {
                        var entry = { USER_WIN: expandedWin[i] === null ? null : expandedWin[i], USER_WEB: expandedWeb[j] === null ? null : expandedWeb[j] };
                        var key = (entry.USER_WIN === null ? '' : entry.USER_WIN) + '|' + (entry.USER_WEB === null ? '' : entry.USER_WEB);
                        if (!seen[key]) {
                            seen[key] = true;
                            results.push(entry);
                        }
                    }
                }
            }
        }
    } finally {
        try { fi.close(); } catch (e) {}
    }

    return results;
}

// Export for module or CommonJS environments (optional)
if (typeof module !== 'undefined' && module.exports) module.exports = { getUsersFromTSV };
