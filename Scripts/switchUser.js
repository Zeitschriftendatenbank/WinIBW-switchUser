var Users;

function initSwitchUser() {
    // initiiere das CSV-Objekt
    var csv = new CSV();
    activeWindow.writeProfileString('csv', 'filepath', 'user');
    // diese tsv muss im Unterverzeichnis 'user' des Anwendungsprofils liegen.
    csv.csvFilename = "winibw_users.tsv";
    csv.startLine = 2;
    // werte getrennt mit
    csv.delimiter = "\t";
    Users = {};
    Users.iln = {};
    Users.eln = {};
    Users.user = {};

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

    if (typeof Users === 'object') {
        var eln_cnt = __countProperties(Users.eln);
        var iln_cnt = __countProperties(Users.iln);
        var user_cnt = __countProperties(Users.user);
        messageBox('User-Objekt erstellt', 'ELN: ' + eln_cnt + '\nILN: ' + iln_cnt + '\nUser: ' + user_cnt, 'message-icon');
    }
}

function __countProperties(obj) {
    var count = 0;
    for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) count++;
    }
    return count;
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

        var iln = __getIlnFromTw();
        if (!iln) return false;

        var eln = Users.iln[iln];
        //var eln = activeWindow.variable('P3GOI');
        //alert('ELN: ' + typeof eln);
        //users = Users.eln[eln];

        if (eln === undefined) {
            eln = activeWindow.variable('P3GOI');
            users.push(Users.eln[eln]);
        } else {
            switch (eln.length) {
                case 0:
                    alert('Keine ELN zu ILN ' + iln + ' gefunden.');
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

    var user = __promptUsers(users);
    if (!user) {
        alert('Kein Benutzer ausgewählt.');
        return false;
    }
    //var newWindow = false;
    var pwd = getProfileString('switchUser', 'master', '');
    if (!pwd) {
        pwd = getProfileString('switchUser', user, '');
        if (!pwd) {
            var thePrompter = utility.newPrompter();
            var ret = thePrompter.prompt('Switch User', 'Bitte Passwort eingeben:', '', 'Passwort speichern=', false);
            if (!ret) {
                return false;
            }
            pwd = thePrompter.getEditValue();
            if (thePrompter.getCheckValue()) {
                activeWindow.writeProfileString('switchUser', user, pwd);
            }
        }
    }
    var idn = activeWindow.variable('P3GPP');
    activeWindow.command('log ' + user + ' ' + pwd, true);
    activeWindow.command('\\sys ' + getProfileString('cbs', 'sys', 'ZENTRALKATALOG'));
    activeWindow.command('\\bes ' + getProfileString('cbs', 'bes', '1.12'));
    if(idn) {
        activeWindow.command('f \\PPN ' + idn);
    }
}

function __promptUsers(users) {
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

function __getIlnFromTw() {
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
    alert('Keine ILN in Kategorie 805 vorhanden.');
    return false;
}