# biovis-upload

A Cloudflare Worker module for uploading images to Twitter.

```bash
pnpm dev # starts a local dev server for the Cloudflare Worker
pnpm release # push release to Cloudflare
```

This module is compatible natively with Node.js v18 or later. Earlier versions of Node.js require a global `fetch` polyfill.

```javascript
import * as fsp from "node:fs/promises";
import worker from "./index.js";

let request = new Request("https://example.com", {
  method: "POST",
  body: JSON.stringify({ 
    data: await fsp.readFile("./data.jpeg", { encoding: "base64" }),
  }),
});
worker
    .fetch(request, process.env)
    .then((res) => res.json())
    .then(console.log);
// { url: 'pic.twitter.com/V6ExgNsn7k' }
```

> **Note**
> Use of this module requires Twitter authentication credentials to be provided in the runtime environment via the second argument to `worker.fetch`.
> This is handled automatically with secrets added to Cloudflare.
