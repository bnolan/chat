"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Homeserver = exports.Chat = exports.enterParcel = exports.toggle = exports.login = void 0;
const preact_1 = require("preact");
const preact_2 = require("unistore/full/preact");
const home_server_1 = require("./home-server");
// @ts-ignore
// require('./style.less')
/* @jsx h */
let hs;
Object.assign(window, { hs });
const tryJson = t => {
    try {
        return JSON.parse(t);
    }
    catch (e) {
        return null;
    }
};
let rooms = {}; // tryJson(localStorage.getItem('rooms')) || {}
let store = preact_2.createStore({
    roomCount: 0,
    rooms,
    currentRoom: '!tCdBIpyqHRthBhJtYE:matrix.cryptovoxels.com'
});
Object.assign(window, { store });
store.subscribe(state => {
    // console.log(state.rooms)
    localStorage.setItem('rooms', JSON.stringify(state.rooms));
});
const TIMEOUT = 30000;
function createActions(store) {
    const actions = {
        sync(state) {
            return __awaiter(this, void 0, void 0, function* () {
                // First sync nextBatch is null
                let filter = {
                    room: {
                        timeline: {
                            limit: 50,
                        }
                    }
                };
                let m = yield hs.sync(state.nextBatch, filter, state.nextBatch && TIMEOUT); // null, 0, 0)
                console.log('sync', m);
                // This is wrong - sync should call another action to get the latest state
                let rooms = Object.assign({}, store.getState().rooms);
                Object.keys(m.rooms.join).forEach(key => {
                    let room = m.rooms.join[key];
                    let timeline = [].concat(room.state.events).concat(room.timeline.events);
                    let tryState = (type, key) => {
                        let state = timeline.find(e => e.type === type);
                        if (state && key in state.content) {
                            return state.content[key];
                        }
                        else {
                            return '';
                        }
                    };
                    let name = tryState('m.room.name', 'name');
                    let alias = tryState('m.room.canonical_alias', 'alias').split(/:/)[0];
                    let topic = tryState('m.room.topic', 'topic');
                    if (!name) {
                        let heroes = room.summary['m.heroes'];
                        if (heroes) {
                            alias = heroes[0].split(/:/)[0];
                        }
                    }
                    let events = room.timeline.events;
                    if (rooms[key]) {
                        let other = events.filter(e => e.type !== 'm.room.redaction');
                        let room = rooms[key];
                        room.events.push(...other);
                        // console.log('events length: ', room.events.length)
                        let redactions = events.filter(e => e.type === 'm.room.redaction');
                        // console.log('redactions', redactions.length)
                        redactions.forEach(r => {
                            room.events = room.events.filter(e => e.event_id !== r.redacts);
                        });
                        // console.log('events length post redact: ', room.events.length)
                    }
                    else {
                        // console.log('wtf assigned')
                        rooms[key] = { name, events, alias, topic };
                    }
                });
                // Delete rooms we left
                Object.keys(m.rooms.leave).forEach(key => {
                    delete rooms[key];
                });
                let roomCount = Object.keys(rooms).length;
                let nextBatch = m.next_batch;
                setTimeout(() => store.action(actions.sync)(), 50);
                return { rooms, roomCount, nextBatch };
            });
        },
        postMessage(state, message) {
            return __awaiter(this, void 0, void 0, function* () {
                let content = {
                    body: message,
                    msgtype: "m.text"
                };
                let roomId = state.currentRoom;
                yield hs.send(roomId, 'm.room.message', hs.txnId, content);
            });
        },
        setRoom(state, roomId) {
            return { currentRoom: roomId };
        },
        leave(state, roomId) {
            hs.leave(roomId);
            let rooms = Object.assign({}, state.rooms);
            delete rooms[roomId];
            let { currentRoom } = state;
            if (state.currentRoom == roomId) {
                currentRoom = null;
            }
            return { rooms, currentRoom };
        },
        login(state, username, password) {
            return __awaiter(this, void 0, void 0, function* () {
                hs = new home_server_1.default('https://matrix.cryptovoxels.com');
                const loginData = yield hs.passwordLogin(username, password);
                let accessToken = loginData.access_token;
                hs.setAccessToken(accessToken);
                setTimeout(() => store.action(actions.sync)(), 50);
                return {
                    deviceId: loginData.device_id,
                    userId: loginData.user_id,
                    accessToken
                };
            });
        },
        enterParcel(state, id) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!hs) {
                    return {};
                }
                if (state.parcelRoom) {
                    yield store.action(actions.leave)(state.parcelRoom);
                }
                let parcelRoom = (yield hs.join(`#parcel-${id}:matrix.cryptovoxels.com`)).room_id;
                let currentRoom = parcelRoom;
                return { parcelRoom, currentRoom };
            });
        },
        toggleChat(state) {
            return { visible: !this.state.visible };
        }
    };
    return actions;
}
let actions = createActions(store);
// exported helpers so we dont leak unistore everywhere
function login(username, password) {
    // console.log('leaking secrets', username, password)
    store.action(actions.login)(username.toLowerCase(), password);
}
exports.login = login;
function toggle() {
    store.action(actions.toggleChat)();
}
exports.toggle = toggle;
function enterParcel(id) {
    store.action(actions.enterParcel)(id);
}
exports.enterParcel = enterParcel;
Object.assign(window, { actions });
const dated = (d) => {
    return `Today at ${d.getHours()}:${d.getMinutes()} PM`;
};
class RoomMessagesClass extends preact_1.Component {
    onKeydown(e) {
        if (e.keyCode == 13) {
            this.send();
            e.preventDefault();
        }
    }
    send() {
        this.props.postMessage(this.state.text);
        this.setState({ text: '' });
        // process.nextTick(() => {
        //   this.textarea.blur()
        // })
    }
    get textarea() {
        return document.querySelector('.matrix-chat .room textarea');
    }
    componentDidUpdate(prevProps) {
        if (prevProps.room == this.props.room) {
            this.scroll('smooth');
        }
        else {
            this.scroll();
        }
    }
    // Auto is jump to scroll, 'smooth' is animated
    scroll(behavior = 'auto') {
        window.requestAnimationFrame(() => {
            let el = document.querySelector('.matrix-chat .scroll div:last-child');
            if (el) {
                el.scrollIntoView({ behavior });
            }
        });
    }
    render() {
        let room = this.props.rooms[this.props.room];
        if (!room) {
            return null;
        }
        let events = room.events;
        events = events.filter(e => e.type === 'm.room.message');
        let messages = events.map(e => {
            let redacted = e.unsigned && e.unsigned.redacted_by;
            if (redacted) {
                return null;
            }
            let char = e.sender.slice(1, 2);
            let hue = 360 / 26 * (char.toLowerCase().charCodeAt(0) - 97);
            let color = `hsl(${hue}, 75%, 60%)`;
            return (preact_1.h("div", { key: e.event_id, className: 'message' },
                preact_1.h("div", { style: { backgroundColor: color }, class: 'avatar' }, char),
                preact_1.h("p", null,
                    preact_1.h("span", { style: { color }, class: 'name' }, e.sender.split(/:/)[0].slice(1)),
                    preact_1.h("span", { class: 'meta' }, dated(new Date(e.origin_server_ts)))),
                preact_1.h("p", null, redacted ? 'Message deleted' : e.content.body)));
        });
        return (preact_1.h("div", { className: 'room' },
            preact_1.h("h3", null,
                room.name,
                ":"),
            preact_1.h("div", { className: 'messages' },
                preact_1.h("div", { class: 'scroll' }, messages)),
            preact_1.h("div", { className: 'form' },
                preact_1.h("textarea", { value: this.state.text, placeholder: 'Post a message...', onInput: e => this.setState({ text: e.target['value'] }), onKeyDown: e => this.onKeydown(e) }))));
    }
}
const RoomMessages = preact_2.connect('rooms,boolean', actions)(RoomMessagesClass);
class AppClass extends preact_1.Component {
    render() {
        // if (!this.props.visible) {
        //   return null
        // }
        // @ts-ignore
        let rooms = Object.keys(this.props.rooms).map((key) => {
            let value = this.props.rooms[key];
            let onClick = e => {
                this.props.setRoom(key);
            };
            let leave = e => {
                this.props.leave(key);
            };
            let c = key === this.props.currentRoom ? 'active' : '';
            return (preact_1.h("li", { className: c },
                value.name
                    ? preact_1.h("span", { onClick: onClick },
                        preact_1.h("b", null, value.name),
                        preact_1.h("br", null),
                        preact_1.h("small", null, value.topic))
                    : preact_1.h("span", { onClick: onClick },
                        preact_1.h("b", null, value.alias)),
                preact_1.h("button", { onClick: leave }, "\u00D7")));
        });
        return (preact_1.h("section", null,
            preact_1.h("h3", null, "Rooms:"),
            preact_1.h("ul", { class: 'rooms' }, rooms),
            preact_1.h(RoomMessages, { room: this.props.currentRoom })));
    }
}
const App = preact_2.connect('currentRoom,rooms', actions)(AppClass);
exports.Chat = () => {
    return (preact_1.h(preact_2.Provider, { store: store },
        preact_1.h(App, null)));
};
exports.Homeserver = () => {
    return hs;
};
if (typeof window !== 'undefined' && window.location && window.location.port == '9966') {
    let div = document.createElement('div');
    div.className = 'matrix-chat';
    document.body.appendChild(div);
    // require('./style.less')
    preact_1.render(preact_1.h(exports.Chat, null), div);
    setTimeout(() => {
        login('bnolan', '');
    }, 250);
}
