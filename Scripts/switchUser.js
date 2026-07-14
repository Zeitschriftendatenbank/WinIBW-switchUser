var Users;
var CSV;
var MISC;
var Notify;
// Lightweight Users placeholder to allow calling Users.logOn/Users.switchTo
// before heavy initialization (TSV parsing, master password retrieval).
if (typeof Users === 'undefined' || Users === null) {
    Users = {
        _inited: false,
        ensureInit: function () {
            if (!this._inited) {
                try { initSwitchUser(); } catch (e) { /* init will populate Users */ }
                this._inited = true;
            }
        },
        logOn: function (user, pwd, newWindow) {
            this.ensureInit();
            if (!user) return false;
            if (typeof pwd === 'undefined' || pwd === null) return false;

            var origWindowId = null;
            try { origWindowId = activeWindow.windowID; } catch (e) { origWindowId = null; }

                // Temporarily disable command history to avoid logging passwords
                var prevShowHistory = null;
                try {
                    try { prevShowHistory = getProfileString('prefs', 'showHistoryCommands', 'true'); } catch (e) { prevShowHistory = 'true'; }
                    try { writeProfileString('prefs', 'showHistoryCommands', 'false'); } catch (e) {}

            MISC.wait('log ' + user + ' ' + pwd, !!newWindow);
            if (MISC.checkScreen(['SY'])) {
                MISC.wait('\\sys ' + getProfileString('cbs', 'sys', 'ZENTRALKATALOG'), false);
            }
            if (MISC.checkScreen(['FS'])) {
                MISC.wait('\\bes ' + getProfileString('cbs', 'bes', '1.12'), false);
            }
                } finally {
                    // restore preference
                    try { if (prevShowHistory !== null) writeProfileString('prefs', 'showHistoryCommands', prevShowHistory); } catch (e) {}
                }
            // Wait up to 2s for the activeWindow id to change (heuristic)
            var start = new Date().getTime();
            var newId = origWindowId;
            try {
                while (new Date().getTime() - start < 2000) {
                    if (typeof activeWindow !== 'undefined' && activeWindow.windowID !== origWindowId) {
                        newId = activeWindow.windowID;
                        break;
                    }
                }
            } catch (e) {
                // ignore
            }

            // If we requested a new window but id didn't change, still return current id if login likely succeeded
            return newId || false;
        },
        switchTo: function (user, newWindow) {
            this.ensureInit();
            newWindow = !!newWindow || false;
            if (!user) return false;
            if (!Users.user[user]) return false; // user not known

            var pwd;
            if (Users.pwd[user]) {
                pwd = Users.pwd[user];
            } else if (Users.pwd['master']) {
                pwd = Users.pwd['master'];
            } else {
                var thePrompter = utility.newPrompter();
                var ret = thePrompter.prompt('Switch User', 'Passwort nicht gefunden. Bitte Passwort für ' + user + ' eingeben:', '', 'Passwort im Hintergrund speichern?', false);
                if (!ret) {
                    return false; // canceled
                }
                pwd = thePrompter.getEditValue();
                if (thePrompter.getCheckValue()) {
                    Users.setPw(user, pwd);
                }
            }

            // Open login in a new window and return its id
            var winId = Users.logOn(user, pwd, newWindow);
            return winId;
        }
    }
}

function initSwitchUser() {
    // Ensure required global objects are present
    function ensureDependencies() {
        var missing = [];
        try { if (!CSV) missing.push('CSV'); } catch (e) { missing.push('CSV'); }
        try { if (!MISC) missing.push('MISC'); } catch (e) { missing.push('MISC'); }
        try { if (!Notify) missing.push('Notify'); } catch (e) { missing.push('Notify'); }
        if (missing.length > 0) {
            var msg = 'Fehler: Fehlende Objekte: ' + missing.join(', ');
            try {
                if (typeof Notify !== 'undefined' && typeof Notify.error === 'function') {
                    Notify.error(msg);
                } else {
                    application.messageBox('Fehler', msg, 'error-icon');
                }
            } catch (e) { }
            return false;
        }
        return true;
    }

    if (!ensureDependencies()) return;


    // do not overwrite Users; populate its properties instead
    Users.iln = {};
    Users.eln = {};
    Users.user = {};
    Users.pwd = {};
    Users.PATH = "%APPDATA%\\OCLC\\WinIBW4\\user\\";
    Users.FILENAME = "winibw_users.tsv";
    Users.master = false;

    Users.setPw = function (user, pwd) {
        var ps1 = Users.PATH + "setpw.ps1";
        var cmd = 'powershell -ExecutionPolicy Bypass -File "' + ps1 + '" ' + Users.PATH + user + '_pw.txt ' + pwd;
        var result = Users.shell(cmd);
        if (!result) {
            return false;
        }
        Users.pwd[user] = pwd;
        return pwd;
    }

    Users.getPw = function (user) {
        if (Users.pwd[user]) {
            return Users.pwd[user];
        }
        var ps1 = Users.PATH + "getpw.ps1";
        var cmd = 'powershell -ExecutionPolicy Bypass -File "' + ps1 + '" ' + Users.PATH + user + '_pw.txt';
        var pwd = Users.shell(cmd);
        Users.pwd[user] = pwd;
        return pwd;
    }

    Users.shell = function (cmd) {
        var shell = new ActiveXObject("WScript.Shell");
        var exec = shell.Exec(cmd);
        while (exec.Status == 0) {
            var start = new Date().getTime();
            while (new Date().getTime() - start < 100) {
                // busy-waiting to pause script execution
            }
        }
        var output = exec.StdOut.ReadAll();
        var err = exec.StdErr.ReadAll();
        if (err) {
            //messageBox('PowerShell Error', err, 'error-icon');
            return false;
        }
        return output;
    }

    Users.promptUsers = function (users) {
        var usrs = [];
        for (var i = 0; i < users.length; i++) {
            var uid = users[i];
            var name = Users.user[uid] || '';
            usrs[i] = uid + ' | ' + name;
        }
        var thePrompter = utility.newPrompter();
        var ret = thePrompter.select('Switch User', 'Bitte Benutzer auswählen', usrs.join("\n"));

        if (!ret) {
            return false;
        }
        var sep = ' | ';
        var idx = ret.indexOf(sep);
        if (idx === -1) return ret;
        return ret.substring(0, idx);
    }

    Users.getIlnFromTw = function () {
        var tagcontent = '';

        if ('' != (tagcontent = application.activeWindow.findTagContent('805', 0, false))) {
            var iln = false;
            var regex = /\$c(\d\d\d\d)/g;
            var array = [];
            regex.lastIndex = 0;
            while ((array = regex.exec(tagcontent)) !== null) {
                return iln = array[1];
            }
        }
        Notify.warning('Keine ILN in Kategorie 805 vorhanden.');
        return false;
    }

    var tsvFileInput = utility.newFileInput();
    var filePath = getProfileString('switchUser', 'file', '');
    if (filePath !== '') {
        if (!tsvFileInput.open(filePath)) {
            Notify.error('Fehler beim Öffnen der Datei: ' + filePath + '. Bitte wählen Sie die Datei winibw_users.tsv aus, um fortzufahren.');
            return;
        }
    } else {
        if (!tsvFileInput.openViaGUI('Bitte wählen Sie die Datei winibw_users.tsv aus', Users.PATH, 'winibw_users.tsv', '*.tsv', 'TSV-Dateien')) {
            Notify.warning('Keine Datei ausgewählt. Bitte wählen Sie die Datei winibw_users.tsv aus, um fortzufahren.');
            return;
        }
    }
    activeWindow.writeProfileString('switchUser', 'file', tsvFileInput.getPath() + '\\' + Users.FILENAME);
    activeWindow.writeProfileString('csv', 'filepath', tsvFileInput.getPath());
    tsvFileInput.close();

    // initiiere das CSV-Objekt
    var csv = new CSV();
    csv.csvFilename = Users.FILENAME;
    csv.startLine = 2;
    // werte getrennt mit
    csv.delimiter = "\t";


    var arrayUnique = function (arr) {
        var r = [];
        o: for (var i = 0, n = arr.length; i < n; i++) {
            for (var x = 0, y = r.length; x < y; x++) {
                if (r[x] == arr[i]) continue o;
            }
            r[r.length] = arr[i];
        }
        return r;
    }

    csv.setProperties(function () {
        if (Users.eln[csv.line['eln']]) {
            Users.eln[csv.line['eln']].push(csv.line['USER_WIN'] || csv.line['USER_WEB']);
            Users.eln[csv.line['eln']] = arrayUnique(Users.eln[csv.line['eln']]);
        } else {
            Users.eln[csv.line['eln']] = [csv.line['USER_WIN'] || csv.line['USER_WEB']];
        }
        if (Users.iln[csv.line['iln']]) {
            Users.iln[csv.line['iln']].push(csv.line['eln']);
            Users.iln[csv.line['iln']] = arrayUnique(Users.iln[csv.line['iln']]);
        } else {
            Users.iln[csv.line['iln']] = [csv.line['eln']];
        }
        Users.user[csv.line['USER_WIN'] || csv.line['USER_WEB']] = csv.line['USER_NAME'];
    }, ["USER_WIN", "USER_WEB", "eln", "iln", "USER_NAME"], false, false, false, false);

    csv.api();

    var countProperties = function (obj) {
        var count = 0;
        for (var k in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, k)) count++;
        }
        return count;
    }

    if (typeof Users === 'object') {
        var eln_cnt = countProperties(Users.eln);
        if (eln_cnt === 0) {
            Notify.warning('Warnung: Es wurden keine Benutzer aus der TSV-Datei geladen. Bitte überprüfen Sie die Datei ' + Users.FILENAME + ' im Verzeichnis ' + Users.PATH);
            return;
        }
        var iln_cnt = countProperties(Users.iln);
        var user_cnt = countProperties(Users.user);
        Notify.info('User-Liste aus Datei ' + Users.FILENAME + ' erstellt\nAnzahl ELN: ' + eln_cnt + '\nAnzahl ILN: ' + iln_cnt + '\nAnzahl User: ' + user_cnt);
    }
    Notify.info("Master-Passwort wird abgerufen... Der Vorgang kann einige Sekunden dauern.");
    var pw = Users.getPw('master');
    if (!pw) {
        var prompter = utility.newPrompter();
        //if (prompter.confirm("Master-Passwort", "Master-Passwort konnte nicht abgerufen werden. Möchten Sie es jetzt setzen?")) {
        if (prompter.prompt("Master-Passwort", "Master-Passwort konnte nicht abgerufen werden. Möchten Sie es jetzt setzen?", '', '', false)) {
            Users.setPw('master', prompter.getEditValue());
            if (Users.pwd['master']) {
                Notify.info("Master-Passwort erfolgreich gesetzt.");
            } else {
                Notify.error("Master-Passwort konnte nicht gesetzt werden. Bitte überprüfen Sie die Berechtigungen des Verzeichnisses " + Users.PATH);
            }
        }
    } else {
        Users.master = pw;
        Notify.info("Master-Passwort erfolgreich abgerufen.");
    }
    Users._inited = true;
}

function switchUser() {
    // Ensure Users is initialized (lazy init)
    if (typeof Users === 'undefined' || Users === null) {
        // recreate placeholder if somehow missing
        Users = {};
    }
    if (typeof Users.ensureInit === 'function') Users.ensureInit();

    var users = [];
    if ('Tw' !== activeWindow.materialCode) {
        for (var elnKey in Users.eln) {
            if (Object.prototype.hasOwnProperty.call(Users.eln, elnKey)) {
                var elnUsers = Users.eln[elnKey];
                if (Array.isArray(elnUsers)) {
                    for (var j = 0; j < elnUsers.length; j++) {
                        users.push(elnUsers[j]);
                    }
                }
            }
        }
        users.sort();
    } else {
        var iln = Users.getIlnFromTw();
        if (!iln) return false;
        var eln = Users.iln[iln];
        if (eln === undefined) {
            eln = activeWindow.variable('P3GOI');
            users.push(Users.eln[eln]);
        } else {
            switch (eln.length) {
                case 0:
                    Notify.error('Keine ELN zu ILN ' + iln + ' gefunden.');
                    return false;
                case 1:
                    users = Users.eln[eln[0]];
                    break;
                default:
                    for (var i = 0; i < eln.length; i++) {
                        var elnUsers = Users.eln[eln[i]];
                        for (var j = 0; j < elnUsers.length; j++) {
                            users.push(elnUsers[j]);
                        }
                    }
            }
        }
    }

    var user = Users.promptUsers(users);
    if (!user) {
        Notify.info('Abbruch', 'Kein Benutzer ausgewählt.');
        return false;
    }

    var pwd;
    if (Users.pwd[user]) {
        pwd = Users.pwd[user];
    } else if (Users.pwd['master']) {
        pwd = Users.pwd['master'];
    } else {
        var thePrompter = utility.newPrompter();
        var ret = thePrompter.prompt('Switch User', 'Passwort nicht gefunden. Bitte Passwort für ' + user + ' eingeben:', '', 'Passwort im Hintergrund speichern?', false);
        if (!ret) {
            return false;
        }
        pwd = thePrompter.getEditValue();
        if (thePrompter.getCheckValue()) {
            Users.setPw(user, pwd);
        }
    }
    var idn = activeWindow.variable('P3GPP');

    MISC.wait('\\LOG ' + user + ' ' + pwd);
    // activeWindow.command('\\LOG ' + user + ' ' + pwd, false);
    if (MISC.checkScreen(['SY'])) {
        MISC.wait('\\sys ' + getProfileString('cbs', 'sys', 'ZENTRALKATALOG'), false);
        //activeWindow.command('\\sys ' + getProfileString('cbs', 'sys', 'ZENTRALKATALOG'), false);
    }
    if (MISC.checkScreen(['FS'])) {
        MISC.wait('\\bes ' + getProfileString('cbs', 'bes', '1.12'), false);
        //activeWindow.command('\\bes ' + getProfileString('cbs', 'bes', '1.12'), false);
    }
    if (idn) {
        MISC.wait('\\ZOE \\PPN ' + idn, false);
        //activeWindow.command('\\ZOE \\PPN ' + idn, false);
    }


}


