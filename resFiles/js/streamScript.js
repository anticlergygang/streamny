$(document).ready(() => {
    window.addEventListener('keydown', function(e) {
        if (e.keyCode == 32 && e.target == document.body) {
            e.preventDefault();
        }
    });
    if (Hls.isSupported()) {
        var video = document.getElementById('mainStreamPlayer');
        var hls = new Hls();
        hls.loadSource(`/hls/${document.title}/index.m3u8`);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            video.play();
        });
    } else {
        var video = document.getElementById('mainStreamPlayer');
        video.setAttribute('src', `/hls/${document.title}/index.m3u8`);
    }
    var chatEle = document.querySelector('#chat');
    var inputEle = document.querySelector('#message');
    var sendMessageEle = document.querySelector('#sendMessage');
    var sendRegisterEle = document.querySelector('#sendRegister');
    var socket = new WebSocket(`wss://streamny.net/${document.title}`, "streamny-protocol");
    socket.onopen = () => {
        socket.send(JSON.stringify({
            'accessToken': localStorage.getItem('accessToken') || 'noToken',
            'type': 'open'
        }));
    };
    socket.onmessage = (event) => {
        var fromServer = JSON.parse(event.data);
        console.log(fromServer);
        switch (fromServer.type) {
            case 'welcome':
                {
                    console.log('welcome');
                    break;
                }
            case 'register':
                {
                    localStorage.setItem('accessToken', fromServer.accessToken);
                    socket.send(JSON.stringify({
                        'accessToken': localStorage.getItem('accessToken') || 'noToken',
                        'type': 'open'
                    }));
                    break;
                }
            case 'chat':
                {
                    var h1 = document.createElement('h1');
                    var hr = document.createElement('hr');
                    h1.innerText = `${fromServer.from}: ${fromServer.msg}`;
                    h1.appendChild(hr);
                    chatEle.insertBefore(h1, chatEle.childNodes[2]);
                    break;
                }
            default:
                {
                    console.log(`wtf is this message...\n${JSON.stringify(fromServer,null,2)}`);
                }
        }
    };
    $(sendMessageEle).on('click', (e) => {
        if (inputEle.value == "") {

        } else {
            socket.send(JSON.stringify({
                'accessToken': localStorage.getItem('accessToken'),
                'type': 'chat',
                'to': document.title,
                'msg': inputEle.value
            }));
            inputEle.value = "";
        }
    });
    $(document).keypress((e) => {
        if (inputEle.value == "") {

        } else {
            if (e.which == 13) {
                socket.send(JSON.stringify({
                    'accessToken': localStorage.getItem('accessToken'),
                    'type': 'chat',
                    'to': document.title,
                    'msg': inputEle.value
                }));
                inputEle.value = "";
            }
        }
    });
});
