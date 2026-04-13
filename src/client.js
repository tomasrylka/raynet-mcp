// src/client.js
'use strict';

class RaynetClient {
  constructor(config) {
    this.instanceUrl = (config.instanceUrl || 'https://app.raynet.cz/api/v2').replace(/\/$/, '');
    this.instanceName = config.instanceName;
    this.username = config.username;
    this.apiKey = config.apiKey;
  }

  _headers() {
    const creds = Buffer.from(`${this.username}:${this.apiKey}`).toString('base64');
    return {
      'Authorization': `Basic ${creds}`,
      'X-Instance-Name': this.instanceName,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async _request(method, path, body) {
    const url = this.instanceUrl + path;
    const opts = { method, headers: this._headers() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }

  _parse({ ok, status, text }) {
    if (!ok) {
      let msg = `HTTP ${status}`;
      try { const j = JSON.parse(text); msg = j.message || j.translatedMessage || msg; } catch {}
      return { success: false, error: msg };
    }
    if (!text) return { success: true };
    try {
      const j = JSON.parse(text);
      if (j.data !== undefined) return { success: true, data: j.data, totalCount: j.totalCount, offset: j.offset, limit: j.limit };
      return { success: true, data: j };
    } catch {
      return { success: true, data: text };
    }
  }

  async get(path, params) {
    try {
      let p = path;
      if (params && Object.keys(params).length > 0) {
        const qs = Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&');
        if (qs) p += '?' + qs;
      }
      return this._parse(await this._request('GET', p));
    } catch (e) { return { success: false, error: e.message }; }
  }

  async put(path, body) {
    try { return this._parse(await this._request('PUT', path, body)); }
    catch (e) { return { success: false, error: e.message }; }
  }

  async post(path, body) {
    try { return this._parse(await this._request('POST', path, body)); }
    catch (e) { return { success: false, error: e.message }; }
  }

  async del(path) {
    try { return this._parse(await this._request('DELETE', path)); }
    catch (e) { return { success: false, error: e.message }; }
  }

  static body(fields) {
    const b = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) b[k] = v;
    return b;
  }

  static ref(id) {
    return id !== undefined ? { id } : undefined;
  }
}
async put(path, body) {
  try {
    console.log('PUT', path, JSON.stringify(body)); // ← PŘIDEJ
    return this._parse(await this._request('PUT', path, body));
  } catch (e) { return { success: false, error: e.message }; }
}

module.exports = { RaynetClient };
