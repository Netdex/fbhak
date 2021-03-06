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
    if (fs.existsSync(config.fbapi.state_conf)) {
        debug(`Using existing session, delete ${config.fbapi.state_conf} to reset session`)
        fbapi({ appState: JSON.parse(fs.readFileSync(config.fbapi.state_conf, 'utf8')) }, (err, api) => {
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
        function auth_success() {
            fs.writeFileSync(config.fbapi.state_conf, JSON.stringify(api.getAppState()));
            debug(`Wrote app state to ${config.fbapi.state_conf}`);
            fbhak(db, api, config);
        }
        function fblogin_callback(err, api) {
            if (err) {
                switch (err.error) {
                    case 'login-approval':
                        rl.question('Enter code: ', code => {
                            err.continue(code);
                            auth_success();
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
                auth_success();
            }
        }
        rl.question('Enter email: ', email => {
            rl.question('Enter password: ', password => {
                fbapi({ email: email, password: password, forceLogin: true }, fblogin_callback);

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