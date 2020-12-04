import * as sdk from "matrix-js-sdk";
import 'localenv'

const fetch = require('node-fetch');

const client = sdk.createClient("https://matrix.cryptovoxels.com");

client.login("m.login.password", {"user": "bot", "password": process.env.BOT_PASSWORD}).then((response) => {

  createParcelRooms()
  createBurbRooms()
  // createRoom('baking', 'Baking', 'Updates from the lightmap baking bot')
})

async function createRoom(alias, name, description) {
  return await client.createRoom({ 
    "visibility":"public",
    "preset": "public_chat",
    "room_alias_name": alias,
    "name": name,
    "topic": description,
    "creation_content": {
      "m.federate": false,
      "m.room.history_visibility": "world_readable"
    }
  })
}

async function createParcelRooms () {
    let allowJoin = true
    let allowRead = true

    let f = await fetch('https://www.cryptovoxels.com/api/parcels.json')
    let r = await f.json()

    let parcels = r.parcels.slice(2318)

    console.log(`Creating ${parcels.length} rooms...`)

    for (const parcel of parcels) {
      let alias = `parcel-${parcel.id}`
      let name = parcel.name || parcel.address
      let description = `${parcel.name ? parcel.address : ''} - https://www.cryptovoxels.com/parcels/${parcel.id}`

      try {
        let room = await client.createRoom({ 
          "visibility":"public",
          "preset": "public_chat",
          "room_alias_name": alias,
          "name": name,
          "topic": description,
          "creation_content": {
            "m.federate": false,
            "m.room.history_visibility": "world_readable"
          }
        })

        console.log(` * Created rooom #${alias}`)

        let roomId = room.room_id

        await client.setGuestAccess(roomId, { allowJoin, allowRead })
      } catch (e) {
        // console.log(e.data)

        if (e.data && e.data.errcode == 'M_ROOM_IN_USE') {
          console.log(` * Room #${alias} exists, updating topic`)
        } else {
          console.error('createRoom error', e)
        }

        let a = await client.getRoomIdForAlias('#' + alias + ':matrix.cryptovoxels.com')
        let roomId = a.room_id

        await client.joinRoom(roomId)
        await client.setRoomTopic(roomId, description)
        await client.setGuestAccess(roomId, { allowJoin, allowRead })
        // console.log(r)
      }
    }
}

export const encodeCoords = (v: any) => {
  let { x, y } = v

  const coords = []

  coords.push(x < 0 ? Math.abs(x) + 'W' : x + 'E')
  coords.push(y < 0 ? Math.abs(y) + 'S' : y + 'N')

  return coords.join(',')
}

async function createIslandRooms () {
    let allowJoin = true
    let allowRead = true

    let f = await fetch('https://www.cryptovoxels.com/api/islands.json')
    let r = await f.json()

    let rooms = r.islands.map(i => {
      return { name: i.name, r.parcels.slice(2318)

    console.log(`Creating ${parcels.length} rooms...`)

    for (const parcel of parcels) {
      let alias = `parcel-${parcel.id}`
      let name = parcel.name || parcel.address
      let description = `${parcel.name ? parcel.address : ''} - https://www.cryptovoxels.com/parcels/${parcel.id}`

      try {
        let room = await client.createRoom({ 
          "visibility":"public",
          "preset": "public_chat",
          "room_alias_name": alias,
          "name": name,
          "topic": description,
          "creation_content": {
            "m.federate": false,
            "m.room.history_visibility": "world_readable"
          }
        })

        console.log(` * Created rooom #${alias}`)

        let roomId = room.room_id

        await client.setGuestAccess(roomId, { allowJoin, allowRead })
      } catch (e) {
        // console.log(e.data)

        if (e.data && e.data.errcode == 'M_ROOM_IN_USE') {
          console.log(` * Room #${alias} exists, updating topic`)
        } else {
          console.error('createRoom error', e)
        }

        let a = await client.getRoomIdForAlias('#' + alias + ':matrix.cryptovoxels.com')
        let roomId = a.room_id

        await client.joinRoom(roomId)
        await client.setRoomTopic(roomId, description)
        await client.setGuestAccess(roomId, { allowJoin, allowRead })
        // console.log(r)
      }
    }
}

// client.publicRooms(function(err, data) {
//   console.log("Public Rooms: %s", JSON.stringify(data));
// });



