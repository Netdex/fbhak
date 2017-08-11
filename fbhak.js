const
    fbapi = require('facebook-chat-api'),
    debug = require('debug')('fbhak'),
    readline = require('readline'),
    c = require('chalk'),
    fs = require('fs'),
    path = require('path'),
    express = require('express'),
    expressp = require('express-promise-router');

debug.enabled = true;

function dbinit(db, conf) {
    debug("Initializing database...");

    db.query(
        `
        CREATE TABLE IF NOT EXISTS presence_data (
            userid      text,
            timestamp   TIMESTAMPTZ,
            status      integer
        );
        CREATE TABLE IF NOT EXISTS friend_data (
            userid      text NOT NULL,
            name        text,
            nick        text,
            gender      text,
            url         text,
            PRIMARY KEY(userid)
        );
        `, (err, res) => {
            if (err) {
                debug(err);
                return;
            }
        }
    );
}

function fbinit(api, db, conf) {
    api.setOptions({
        updatePresence: true,
        logLevel: conf.fbapi.logging
    });

    let uid = api.getCurrentUserID();
    let cifo = api.getUserInfo(uid, (err, ret) => {
        if (err) debug(err);
        console.log(`Logged into ${c.cyan(ret[uid].name)}`);
    });

    debug("Dumping friends");
    api.getFriendsList((err, arr) => {
        if (err) {
            debug(err);
            return;
        }
        for (let friend of arr) {
            db.query(`INSERT INTO friend_data(userid, name, nick, gender, url) VALUES($1, $2, $3, $4, $5) ON CONFLICT(userid) DO NOTHING`,
                [friend.userID, friend.fullName, friend.alternateName, friend.gender, friend.profileUrl]);
        }
    });

    debug("Listening to api events");
    api.listen((err, msg) => {
        if (err) {
            debug(err);
            return;
        }

        switch (msg.type) {
            case 'presence':
                db.query(
                    `INSERT INTO presence_data(userid, timestamp, status) SELECT $1, $2, $3 
                    WHERE NOT EXISTS (SELECT * FROM presence_data WHERE userid=$1 AND timestamp=$2 AND status=$3)`,
                    [msg.userID, new Date(msg.timestamp), msg.statuses]
                ).catch(rsn => {
                    debug("Failed to insert presence data into db", rsn);
                });
                //console.log(JSON.stringify(msg));
                break;
        }
    });
}

function webapi(db, conf) {
    let api = expressp()
        .get('/users', async (req, res, next) => {
            let result = [];
            try {
                let query = await db.query(
                    'SELECT * FROM friend_data ORDER BY name'
                );
                result = query.rows;
            } catch (err) {
                debug(err);
            }
            res.end(JSON.stringify(result));
        })
        .get('/activity/:uid/:start/:end', async (req, res, next) => {
            let result = [];
            try {
                let startDate = new Date(parseInt(req.params.start));
                let endDate = new Date(parseInt(req.params.end));

                let query = await db.query(
                    'SELECT * FROM presence_data WHERE userid = $1 AND timestamp BETWEEN $2 AND $3 ORDER BY timestamp',
                    [req.params.uid, startDate, endDate]
                );
                result = query.rows;
            } catch (err) {
                debug(err);
            }
            res.end(JSON.stringify(result));
        });

    let server = express()
        .use(express.static(path.join(__dirname, 'static/dist')))
        .use('/data', api);

    let listener = server.listen(conf.server.port, '0.0.0.0', function () {
        debug("Started local express server");
    });

    process.on('SIGINT', function () {
        debug("\nGracefully shutting down from SIGINT (Ctrl-C)");
        listener.close();
        process.exit();
    });
}

module.exports = function (db, api, conf) {
    dbinit(db, conf);
    webapi(db, conf);
    fbinit(api, db, conf);
}