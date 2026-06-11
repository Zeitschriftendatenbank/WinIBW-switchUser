var Users;

function initSwitchUser() {
    Users = {};
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
}

function switchUser() {
    if (typeof Users === 'undefined' || Users === null) {
        initSwitchUser();
    }

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

    activeWindow.command('log ' + user + ' ' + pwd, false);
                alert('IDN1: ' + idn);
    activeWindow.command('\\sys ' + getProfileString('cbs', 'sys', 'ZENTRALKATALOG'), false);
                alert('IDN: ' + idn);
    activeWindow.command('\\bes ' + getProfileString('cbs', 'bes', '1.12'), false);
                alert('IDN3: ' + idn);
    if (idn) {

        activeWindow.command('f \\PPN ' + idn, false);
    }
}

