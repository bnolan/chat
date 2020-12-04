export default class HomeServerApi {
  _accessToken: string
  _homeserver: string
  _txnId: number

  constructor(server, token?) {
    this._homeserver = server
    this._accessToken = token
    this._txnId = Math.floor(Math.random() * 0xFFFFFFFF)
  }

  setAccessToken (token) {
    this._accessToken = token
  }

  get txnId () {
    return this._txnId++
  }

  private _url(csPath) {
      return `${this._homeserver}/_matrix/client/r0${csPath}`;
  }

  private _encodeQueryParams(queryParams: object) {
    // @ts-ignore
    return Object.entries(queryParams || {})
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => {
          if (typeof value === "object") {
              value = JSON.stringify(value);
          }
          return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
      })
      .join("&");
  }

  private async _request(method, url, queryParams, body, options) {
      const queryString = this._encodeQueryParams(queryParams);
      url = `${url}?${queryString}`;

      let bodyString;

      const headers = {}

      if (this._accessToken) {
          headers["Authorization"] = `Bearer ${this._accessToken}`
      }

      headers["Accept"] = "application/json"

      if (body) {
        headers["Content-Type"] = "application/json"
        bodyString = JSON.stringify(body)
      }

      options = Object.assign({}, {
        mode: "cors",
        credentials: "omit",
        referrer: "no-referrer",
        cache: "no-cache"
      }, { method, headers, body: bodyString }, options)

      // console.log(options)

      // @ts-ignore
      let f = await fetch(url, options)
      let r = await f.json()

      return r
  }

  _post(csPath, queryParams, body, options) {
      return this._request("POST", this._url(csPath), queryParams, body, options);
  }

  _put(csPath, queryParams, body, options) {
      return this._request("PUT", this._url(csPath), queryParams, body, options);
  }

  _delete(csPath, queryParams, body, options) {
      return this._request("DELETE", this._url(csPath), queryParams, body, options);
  }

  _get(csPath, queryParams, body, options) {
      return this._request("GET", this._url(csPath), queryParams, body, options);
  }

  sync(since, filter = 0, timeout = 0, options = null) {
      return this._get("/sync", {since, timeout, filter}, null, options);
  }

  // params is from, dir and optionally to, limit, filter.
  messages(roomId, params, options = null) {
      return this._get(`/rooms/${encodeURIComponent(roomId)}/messages`, params, null, options);
  }

  send(roomId, eventType, txnId, content, options = null) {
      return this._put(`/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}`, {}, content, options);
  }

  join (roomIdOrAlias) {
    return this._post(`/join/${encodeURIComponent(roomIdOrAlias)}`, '', null, null)
  }

  leave (roomId) {
    return this._post(`/rooms/${encodeURIComponent(roomId)}/leave`, '', null, null)
  }

  deleteRoom (alias) {
    return this._delete(`/directory/room/${encodeURIComponent(alias)}`, '', null, null)
  }

  createRoom(alias, name, description) {
    let body = 
      {
        "visibility":"public",
        "preset": "public_chat",
        "room_alias_name": alias,
        "name": name,
        "topic": description,
        "creation_content": {
          "m.federate": false
        }
      }

    return this._post('/createRoom', {}, body, {})
  }

  passwordLogin(username, password, options = null) {
      return this._post("/login", null, {
        "type": "m.login.password",
        "identifier": {
          "type": "m.id.user",
          "user": username
        },
        "password": password
      }, options);
  }

  createFilter(userId, filter, options = null) {
      return this._post(`/user/${encodeURIComponent(userId)}/filter`, null, filter, options);
  }

  versions(options = null) {
      return this._request("GET", `${this._homeserver}/_matrix/client/versions`, null, null, options);
  }

  _parseMxcUrl(url) {
      const prefix = "mxc://";
      if (url.startsWith(prefix)) {
          return url.substr(prefix.length).split("/", 2);
      } else {
          return null;
      }
  }

  mxcUrlThumbnail(url, width, height, method) {
      const parts = this._parseMxcUrl(url);
      if (parts) {
          const [serverName, mediaId] = parts;
          const httpUrl = `${this._homeserver}/_matrix/media/r0/thumbnail/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
          return httpUrl + "?" + this._encodeQueryParams({width, height, method});
      }
      return null;
  }

  mxcUrl(url) {
      const parts = this._parseMxcUrl(url);
      if (parts) {
          const [serverName, mediaId] = parts;
          return `${this._homeserver}/_matrix/media/r0/download/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
      } else {
          return null;
      }
  }
}
