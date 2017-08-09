const
    fbapi = require('facebook-chat-api'),
    debug = require('debug')('fbhak'),
    readline = require('readline'),
    c = require('chalk'),
    fs = require('fs'),
    path = require('path'),
    { Client } = require('pg');

let fbhak = require('./fbhak');
const config = require('./config');

debug.enabled = true;

function fblogin(db) {
    if (fs.existsSync(config.fb_state_conf)) {
        debug(`Using existing session, delete ${config.fb_state_conf} to reset session`)
        fbapi({ appState: JSON.parse(fs.readFileSync(config.fb_state_conf, 'utf8')) }, (err, api) => {
            if (err) {
                debug(err);
                return;
            }
            fbhak(db, api, config);
        });
    }
    else {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('Enter email: ', email => {
            rl.question('Enter password: ', password => {
                fbapi({ email: email, password: password, forceLogin: true }, (err, api) => {
                    function authSuccess() {
                        fs.writeFileSync(config.fb_state_conf, JSON.stringify(api.getAppState()));
                        debug(`Wrote app state to ${config.fb_state_conf}`);
                        fbhak(db, api, config);
                    }
                    if (err) {
                        switch (err.error) {
                            case 'login-approval':
                                rl.question('Enter code: ', code => {
                                    err.continue(code);
                                    authSuccess();
                                });
                                break;
                            default:
                                debug(err);
                                rl.close();
                                return;
                        }
                    }
                    else {
                        rl.close();
                        authSuccess();
                    }
                });

            });
        });
    }
}
function init() {
    console.log('fbhak - Facebook Friend Activity Logger');
    debug(`Connecting to postgres db ${config.postgres.user}@${config.postgres.host}/${config.postgres.database}`);
    let db = new Client(config.postgres);
    db.connect(err => {
        if (err) {
            debug(err);
            return;
        }
        fblogin(db);
    });
}

init();