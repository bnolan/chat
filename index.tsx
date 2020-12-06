import { h, render, Component } from 'preact'
import { createStore, Provider, connect } from 'unistore/full/preact'
import HomeServer from './home-server'

// @ts-ignore
// require('./style.less')

/* @jsx h */

let hs

Object.assign(window, { hs })

interface Event {
  event_id: string
  sender: string
  origin_server_ts: number
  content: any
  type: string
  redacts?: string
  unsigned?: any
}

interface Room {
  name: string
  alias: string
  topic: string
  events: Array<Event>
}

interface State {
  roomCount?: number
  rooms?: Map<string, Room>
  currentRoom: string
  nextBatch?: string
  deviceId?: string
  userId?: string
  accessToken: string
  parcelRoom?: any
  visible?: boolean
}

const tryJson = t => {
  try { 
    return JSON.parse(t)
  } catch (e) {
    return null
  }
}

let rooms = {} // tryJson(localStorage.getItem('rooms')) || {}
let store = createStore<State>({ 
  roomCount: 0,
  rooms,
  currentRoom: '!tCdBIpyqHRthBhJtYE:matrix.cryptovoxels.com'
})

Object.assign(window, { store })

store.subscribe(state => {
  // console.log(state.rooms)
  localStorage.setItem('rooms', JSON.stringify(state.rooms))
})

const TIMEOUT = 30000

function createActions(store) {
  const actions = {
    async sync (state: State) {
      // First sync nextBatch is null
      let filter = {
        room: {
          timeline: {
            limit: 50,
          }
        }
      }

      let m = await hs.sync(state.nextBatch, filter, state.nextBatch && TIMEOUT) // null, 0, 0)

      console.log('sync', m)

      // This is wrong - sync should call another action to get the latest state
      let rooms = Object.assign({}, store.getState().rooms)

      Object.keys(m.rooms.join).forEach(key => {
        let room = m.rooms.join[key]
        
        let timeline = [].concat(room.state.events).concat(room.timeline.events)

        let tryState = (type, key) => {
          let state = timeline.find(e => e.type === type)

          if (state && key in state.content) {
            return state.content[key]
          } else {
            return ''
          }
        }

        let name = tryState('m.room.name', 'name')
        let alias = tryState('m.room.canonical_alias', 'alias').split(/:/)[0]
        let topic = tryState('m.room.topic', 'topic')

        if (!name) {
          let heroes = room.summary['m.heroes']

          if (heroes) {
            alias = heroes[0].split(/:/)[0]
          }
        }

        let events = room.timeline.events as Array<Event>

        if (rooms[key]) {
          let other = events.filter(e => e.type !== 'm.room.redaction')

          let room = rooms[key]
          room.events.push(...other)
          // console.log('events length: ', room.events.length)

          let redactions = events.filter(e => e.type === 'm.room.redaction')

          // console.log('redactions', redactions.length)

          redactions.forEach(r => {
            room.events = room.events.filter(e => e.event_id !== r.redacts)
          })

          // console.log('events length post redact: ', room.events.length)
        } else {
          // console.log('wtf assigned')
          rooms[key] = { name, events, alias, topic }
        }
      })

      // Delete rooms we left
      Object.keys(m.rooms.leave).forEach(key => {
        delete rooms[key]
      })

      let roomCount = Object.keys(rooms).length
      let nextBatch = m.next_batch

      setTimeout(() => store.action(actions.sync)(), 50)

      return { rooms, roomCount, nextBatch }
    },

    async postMessage (state: State, message: string) {
      let content = {
        body: message,
        msgtype: "m.text"      
      }

      let roomId = state.currentRoom

      await hs.send(roomId, 'm.room.message', hs.txnId, content)
    },

    setRoom (state, roomId: string) {
      return { currentRoom: roomId }
    },

    leave (state, roomId: string) {
      hs.leave(roomId)

      let rooms = Object.assign({}, state.rooms)
      delete rooms[roomId]

      let { currentRoom } = state

      if (state.currentRoom == roomId) {
        currentRoom = null
      }

      return { rooms, currentRoom }
    },

    async login (state, username, password) {
      hs = new HomeServer('https://matrix.cryptovoxels.com')

      const loginData = await hs.passwordLogin(username, password)
      let accessToken = loginData.access_token
      hs.setAccessToken(accessToken)

      setTimeout(() => store.action(actions.sync)(), 50)

      return { 
        deviceId: loginData.device_id,
        userId: loginData.user_id,
        accessToken
      }
    },

    async enterParcel (state, id) {
      if (!hs) {
        return {}
      }

      if (state.parcelRoom) {
        await store.action(actions.leave)(state.parcelRoom)
      }

      let parcelRoom = (await hs.join(`#parcel-${id}:matrix.cryptovoxels.com`)).room_id
      let currentRoom = parcelRoom

      return { parcelRoom, currentRoom }
    },

    toggleChat (state) {
      return { visible: !this.state.visible }
    }
  }

  return actions
}

let actions = createActions(store)

// exported helpers so we dont leak unistore everywhere
export function login (username, password) {
  // console.log('leaking secrets', username, password)
  store.action(actions.login)(username.toLowerCase(), password)
}

export function toggle () {
  store.action(actions.toggleChat)()
}

export function enterParcel (id) {
  store.action(actions.enterParcel)(id)
}

Object.assign(window, { actions })

const dated = (d: Date) => {
  return `Today at ${d.getHours()}:${d.getMinutes()} PM`
}

class RoomMessagesClass extends Component<any, any> {
  onKeydown (e) {
    if (e.keyCode == 13) {
      this.send()
      e.preventDefault()
    }
  }

  send () {
    this.props.postMessage(this.state.text)

    this.setState({ text: '' })

    // process.nextTick(() => {
    //   this.textarea.blur()
    // })
  }

  get textarea (): HTMLTextAreaElement {
    return document.querySelector('.matrix-chat .room textarea')
  }

  componentDidUpdate (prevProps) {
    if (prevProps.room == this.props.room) {
      this.scroll('smooth')
    } else {
      this.scroll()
    }
  }

  // Auto is jump to scroll, 'smooth' is animated
  scroll (behavior: any = 'auto') {
    window.requestAnimationFrame(() => {
      let el = document.querySelector('.matrix-chat .scroll div:last-child') as HTMLDivElement

      if (el) {
        el.scrollIntoView({ behavior })
      }
    })
  }

  render () {
    let room = this.props.rooms[this.props.room] as Room

    if (!room) {
      return null
    }

    let events = room.events
    events = events.filter(e => e.type === 'm.room.message')

    let messages = events.map(e => {
      let redacted = e.unsigned && e.unsigned.redacted_by

      if (redacted) {
        return null
      }

      let char = e.sender.slice(1, 2)
      let hue = 360 / 26 * (char.toLowerCase().charCodeAt(0) - 97)
      let color = `hsl(${hue}, 75%, 60%)`

      return (
        <div key={e.event_id} className='message'>
          <div style={{backgroundColor: color}} class='avatar'>{char}</div>
          <p>
            <span style={{color}} class='name'>{ e.sender.split(/:/)[0].slice(1) }</span>
            <span class='meta'>{ dated(new Date(e.origin_server_ts)) }</span>
          </p>

          <p>
            { redacted ? 'Message deleted' : e.content.body}
          </p>
        </div>
      )
    })

    return (
      <div className='room'>
        <h3>{ room.name }:</h3>

        <div className='messages'>
          <div class='scroll'>
            { messages }
          </div>
        </div>

        <div className='form'>
          <textarea 
            value={this.state.text}
            placeholder='Post a message...'
            onInput={e => this.setState({ text: e.target['value'] })}
            onKeyDown={e => this.onKeydown(e)} />
        </div>
      </div>
    )
  }
}
const RoomMessages = connect('rooms,boolean', actions)(RoomMessagesClass)

interface Props {
  currentRoom?: 'string'
  rooms?: Map<string, Room>
  sync?: any
  setRoom?: any
  leave?: any
  login?: any
  visible?: boolean
}

class AppClass extends Component<Props, any> {
  render () {
    // if (!this.props.visible) {
    //   return null
    // }

    // @ts-ignore
    let rooms = Object.keys(this.props.rooms).map(
      (key) => {
        let value = this.props.rooms[key]

        let onClick = e => {
          this.props.setRoom(key)
        }

        let leave = e => {
          this.props.leave(key)
        }

        let c = key === this.props.currentRoom ? 'active' : ''

        return (
          <li className={c}>
            { 
              value.name
                ? <span onClick={onClick}><b>{value.name}</b><br /><small>{value.topic}</small></span>
                : <span onClick={onClick}><b>{value.alias}</b></span>
            }
            <button onClick={leave}>&times;</button>
          </li>
        )
      }
    )

    return (
      <section>
        <h3>Rooms:</h3>

        <ul class='rooms'>
          {rooms}
        </ul>

        <RoomMessages room={this.props.currentRoom} />
     </section>
    )
  }
}
const App = connect('currentRoom,rooms', actions)(AppClass)

export const Chat = () => {
  return (
    <Provider store={store}>
      <App />
    </Provider>
  )
}

export const Homeserver = () => {
  return hs
}

if (typeof window !== 'undefined' && window.location && window.location.port == '9966') {
  let div = document.createElement('div')
  div.className = 'matrix-chat'
  document.body.appendChild(div)

  // require('./style.less')

  render(<Chat />, div)

  setTimeout(() => {
    login('bnolan', '')
  }, 250)  
}
