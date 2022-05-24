import * as fsp from "node:fs/promises";
import worker from "./index.js";

let filepath = process.argv[2];
if (!filepath) {
	console.log("node ./test.js data.jpeg");
	process.exit(1);
}
let data = await fsp.readFile(filepath, { encoding: "base64" });
let request = new Request("https://example.com", {
	method: "POST",
	body: JSON.stringify({ data }),
});
worker
	.fetch(request, process.env)
	.then((res) => res.json())
	.then(console.log);
