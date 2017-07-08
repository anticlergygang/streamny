const url = require('url');
const zlib = require('zlib');
const http = require('http');
const https = require('https');
const request = require('request');

const sign = (unsignedmessage) => {
    return unsignedmessage;
};
const unsign = (signedmessage) => {
    return signedmessage;
};

const fs = require('fs');
const mime = require('mime-types');
const directoryToObject = (baseDir, objToBe, options) => {
    // console.log(`converting directory: '${baseDir}'`);
    var directories = [];
    fs.readdirSync(baseDir).forEach((dirOrFile) => {
        if (dirOrFile.indexOf('.') != -1) {
            if (options['ignoreTypes'].indexOf(mime.lookup(dirOrFile)) != -1) {
                // console.log(`ignoring file because type: '${baseDir.split('/')[baseDir.split('/').length-1]}/${dirOrFile}'`);
                objToBe[`${baseDir.split('/')[baseDir.split('/').length-1]}`][`${dirOrFile}`] = {};
            } else if (options['ignoreFlies'].indexOf(dirOrFile) != -1) {
                // console.log(`ignoring file because filename: '${baseDir.split('/')[baseDir.split('/').length-1]}/${dirOrFile}'`);
                objToBe[`${baseDir.split('/')[baseDir.split('/').length-1]}`][`${dirOrFile}`] = {};
            } else {
                // console.log(`reading file: '${baseDir.split('/')[baseDir.split('/').length-1]}/${dirOrFile}'`);
                objToBe[`${baseDir.split('/')[baseDir.split('/').length-1]}`][`${dirOrFile}`] = fs.readFileSync(`${baseDir}/${dirOrFile}`, 'utf8');
            }
        } else {
            // console.log(`found directory: '${dirOrFile}'`);
            objToBe[`${dirOrFile}`] = {};
            directories.push(`${baseDir}/${dirOrFile}`);
        }
    });
    while (directories.length >= 1) {
        directoryToObject(directories.pop(), objToBe, options);
    }
};

var resFiles = {};
var hls = {};
var db = {};
directoryToObject('/usr/local/nginx/streamny/db', db, {
    'ignoreTypes': [],
    'ignoreFlies': []
});
directoryToObject('/usr/local/nginx/streamny/resFiles', resFiles, {
    'ignoreTypes': [],
    'ignoreFlies': []
});
var users = JSON.parse(db['users']['users.json']);
var liveStreams = [];
setInterval(() => {
    liveStreams = fs.readdirSync('/usr/local/nginx/streamny/hls');
    directoryToObject('/usr/local/nginx/streamny/hls', hls, {
        'ignoreTypes': ['video/mp2t'],
        'ignoreFlies': []
    });
}, 2000);

const httpsOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/streamny.net/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/streamny.net/fullchain.pem')
}

var urlParsed;
var httpsServer = https.createServer(httpsOptions, (req, res) => {
    urlParsed = url.parse(req.url, true);
    if (urlParsed.pathname.indexOf('/hls/') != -1) {
        liveStreams.forEach(function(e) {
            if (unsign(e) == urlParsed.pathname.split('/')[2]) {
                if (mime.lookup(urlParsed.pathname) == 'application/vnd.apple.mpegurl') {
                    var ae = req.headers['accept-encoding'];
                    if (ae.match(/\bgzip\b/)) {
                        zlib.gzip(hls[`${e}`]['index.m3u8'], function(err, zip) {
                            if (err) throw err;
                            res.writeHead(200, { 'content-encoding': 'gzip' });
                            res.end(zip);
                        });
                    } else {
                        res.end(hls[`${e}`]['index.m3u8'], 'utf-8');
                    }
                } else if (mime.lookup(urlParsed.pathname) == 'video/mp2t') {
                    res.writeHead(200, { 'Content-Type': `${mime.lookup(urlParsed.pathname)}` });
                    var stream = fs.createReadStream(`/usr/local/nginx/streamny/hls/${e}/${urlParsed.pathname.split('/')[3]}`, { bufferSize: 64 * 1024 });
                    stream.pipe(res);
                }
            }
        });
    } else {
        switch (urlParsed.pathname) {
            case '/':
                {
                    res.end(resFiles['html']['streamny.html']);
                    break;
                }
            case '/classempire':
                {
                    res.end(resFiles['html']['classempire.html']);
                    break;
                }
            case '/js/streamScript.js':
                {
                    res.end(resFiles['js']['streamScript.js']);
                    break;
                }
            case '/css/streamStyle.css':
                {
                    res.end(resFiles['css']['streamStyle.css']);
                    break;
                }
            default:
                {
                    res.end();
                }
        }
    }
}).listen(443, '198.199.79.193');
http.createServer((req, res) => {
    res.writeHead(302, {
        'Location': 'https://streamny.net/'
    });
    res.end();
}).listen(80, '198.199.79.193');

function validateToken(token) {
    var validToken = false;
    if (Object.keys(users).indexOf(unsign(token)) == -1) {} else {
        if (users[unsign(token)]['accessToken'] == token) {
            validToken = true;
        }
    }
    return validToken;
}

var WebSocketServer = require('websocket').server;
wsServer = new WebSocketServer({
    httpServer: httpsServer,
    autoAcceptConnections: false
});
wsServer.on('request', function(request) {
    // console.log(`origin: ${request.origin}`);
    if (request.origin != 'https://streamny.net') {
        console.log(`rejected connection from '${request.origin}'`);
        request.reject();
    } else {
        var connection = request.accept('streamny-protocol', request.origin);
        connection['chatRoom'] = request.resourceURL.pathname.replace('/', '');
        console.log(`chat room: ${connection['chatRoom']}`);
        connection.on('message', (message) => {
            var fromClient = JSON.parse(message.utf8Data);
            console.log(JSON.stringify(fromClient, null, 2));
            switch (fromClient.type) {
                case 'open':
                    {
                        if (validateToken(fromClient.accessToken)) {
                            connection.sendUTF(JSON.stringify({
                                'type': 'welcome'
                            }));
                        } else {
                            var newAT = sign(`Anon${Object.keys(users).length}`);
                            users[unsign(`${newAT}`)] = {
                                'accessToken': newAT,
                                'uses': 0
                            };
                            connection.sendUTF(JSON.stringify({
                                'type': 'register',
                                'accessToken': newAT
                            }));
                        }
                        break;
                    }
                case 'chat':
                    {
                        if (validateToken(fromClient.accessToken)) {
                            if (fromClient.msg.indexOf('!register') != -1) {
                                var messageParts = fromClient.msg.split(' ');
                                if (Object.keys(users).indexOf(messageParts[1]) != -1) {
                                    connection.sendUTF(JSON.stringify({
                                        'type': 'chat',
                                        'from': 'console',
                                        'msg': 'username is taken, try again'
                                    }));
                                } else {
                                    // delete users[unsign(fromClient.accessToken)];
                                    var newAT = sign(messageParts[1]);
                                    users[unsign(`${newAT}`)] = {
                                        'accessToken': newAT,
                                        'password': sign(messageParts[2]),
                                        'uses': 0
                                    };
                                    connection.sendUTF(JSON.stringify({
                                        'type': 'chat',
                                        'from': 'console',
                                        'msg': 'registered!'
                                    }));
                                    connection.sendUTF(JSON.stringify({
                                        'type': 'register',
                                        'accessToken': newAT
                                    }));
                                }
                            } else if (fromClient.msg.indexOf('!login') != -1) {
                                var messageParts = fromClient.msg.split(' ');
                                if (messageParts[2] == unsign(users[messageParts[1]]['password'])) {
                                    connection.sendUTF(JSON.stringify({
                                        'type': 'chat',
                                        'from': 'console',
                                        'msg': 'logged in!'
                                    }));
                                    connection.sendUTF(JSON.stringify({
                                        'type': 'register',
                                        'accessToken': users[messageParts[1]]['accessToken']
                                    }));
                                } else {
                                    connection.sendUTF(JSON.stringify({
                                        'type': 'chat',
                                        'from': 'console',
                                        'msg': 'username and/or password is/are wrong!'
                                    }));
                                }
                            } else {
                                wsServer.connections.forEach((conn) => {
                                    if (conn.chatRoom == fromClient.to) {
                                        conn.sendUTF(JSON.stringify({
                                            'type': 'chat',
                                            'from': unsign(fromClient.accessToken),
                                            'msg': fromClient.msg
                                        }));
                                    }
                                });
                            }
                        } else {
                            connection.sendUTF(JSON.stringify({
                                'type': 'register'
                            }));
                        }
                        break;
                    }
                default:
                    {
                        console.log(`wtf is this message...\n${JSON.stringify(fromClient,null,2)}`);
                    }
            }
        });
        connection.on('close', function(reasonCode, description) {
            //if the user is in a chatroom, inform the others in the room to update the room listing
        });
    }
});
