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
exports.encodeCoords = void 0;
const sdk = require("matrix-js-sdk");
require("localenv");
const fetch = require('node-fetch');
const client = sdk.createClient("https://matrix.cryptovoxels.com");
client.login("m.login.password", { "user": "bot", "password": process.env.BOT_PASSWORD }).then((response) => {
    createParcelRooms();
    // createBurbRooms()
    // createRoom('baking', 'Baking', 'Updates from the lightmap baking bot')
});
function createRoom(alias, name, description) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield client.createRoom({
            "visibility": "public",
            "preset": "public_chat",
            "room_alias_name": alias,
            "name": name,
            "topic": description,
            "creation_content": {
                "m.federate": false,
                "m.room.history_visibility": "world_readable"
            }
        });
    });
}
function createParcelRooms() {
    return __awaiter(this, void 0, void 0, function* () {
        let allowJoin = true;
        let allowRead = true;
        let f = yield fetch('https://www.cryptovoxels.com/api/parcels.json');
        let r = yield f.json();
        let parcels = r.parcels.slice(2318);
        console.log(`Creating ${parcels.length} rooms...`);
        for (const parcel of parcels) {
            let alias = `parcel-${parcel.id}`;
            let name = parcel.name || parcel.address;
            let description = `${parcel.name ? parcel.address : ''} - https://www.cryptovoxels.com/parcels/${parcel.id}`;
            try {
                let room = yield client.createRoom({
                    "visibility": "public",
                    "preset": "public_chat",
                    "room_alias_name": alias,
                    "name": name,
                    "topic": description,
                    "creation_content": {
                        "m.federate": false,
                        "m.room.history_visibility": "world_readable"
                    }
                });
                console.log(` * Created rooom #${alias}`);
                let roomId = room.room_id;
                yield client.setGuestAccess(roomId, { allowJoin, allowRead });
            }
            catch (e) {
                // console.log(e.data)
                if (e.data && e.data.errcode == 'M_ROOM_IN_USE') {
                    console.log(` * Room #${alias} exists, updating topic`);
                }
                else {
                    console.error('createRoom error', e);
                }
                let a = yield client.getRoomIdForAlias('#' + alias + ':matrix.cryptovoxels.com');
                let roomId = a.room_id;
                yield client.joinRoom(roomId);
                yield client.setRoomTopic(roomId, description);
                yield client.setGuestAccess(roomId, { allowJoin, allowRead });
                // console.log(r)
            }
        }
    });
}
exports.encodeCoords = (v) => {
    let { x, y } = v;
    const coords = [];
    coords.push(x < 0 ? Math.abs(x) + 'W' : x + 'E');
    coords.push(y < 0 ? Math.abs(y) + 'S' : y + 'N');
    return coords.join(',');
};
// client.publicRooms(function(err, data) {
//   console.log("Public Rooms: %s", JSON.stringify(data));
// });
