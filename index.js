// @ts-check
import OAuth from "oauth-1.0a";
import HmacSHA1 from "crypto-js/hmac-sha1.js";
import Base64 from "crypto-js/enc-base64.js";

class Twitter {
	constructor({ consumer, token }) {
		this.auth = new OAuth({
			consumer,
			signature_method: "HMAC-SHA1",
			hash_function(base, key) {
				return HmacSHA1(base, key).toString(Base64);
			},
		});
		this.token = token;
	}

	/**
	 * @param {'api' | 'upload'} subdomain
	 * @param {string} resource
	 * @param {Record<string, any>} data
	 */
	async post(subdomain, resource, data) {
		let url = `https://${subdomain}.twitter.com/1.1/${resource}`;
		let request = { method: "POST", url, data };
		let response = await fetch(request.url, {
			method: request.method,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"Accept": "application/json",
				...this.auth.toHeader(this.auth.authorize(request, this.token)),
			},
			body: new URLSearchParams(request.data),
		});
		return response.json();
	}
	/**
	 * @typedef {{
	 *   media_id: number;
	 *   media_id_string: string;
	 *   size: number;
	 *   expires_after_secs: number;
	 *   image: { image_type: string, w: number, h: number };
	 * }} MediaUploadResponse
	 */

	/**
	 * @param {string} media base64 encoded media
	 * @return {Promise<MediaUploadResponse>}
	 */
	upload_media(media) {
		return this.post("upload", "media/upload.json", { media });
	}

	/**
	 * @typedef {{
	 *    entities: { media: { display_url: string }[] },
	 *  }} StatusUpdateResponse
	 *
	 * Minimial typings of API response... The actual payload is much much larger.
	 */
	/**
	 * @param {string} media_id
	 * @return {Promise<StatusUpdateResponse>}
	 */
	tweet(media_id) {
		return this.post("api", "statuses/update.json", {
			status: "BioVis Copy",
			media_ids: media_id,
		});
	}
}

/**
 * @param {Request} request
 *
 * Check if we are dealing with a CORS preflight request (https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)
 */
function is_preflight(request) {
	return (
		request.method === "OPTIONS" &&
		request.headers.get("Origin") !== null &&
		request.headers.get("Access-Control-Request-Method") !== null &&
		request.headers.get("Access-Control-Request-Headers") !== null
	);
}

export default {
	/**
	 * @param {Request} request
	 * @param {{
	 *   TWITTER_API_KEY: string,
	 *   TWITTER_API_SECRET: string,
	 *   TWITTER_ACCESS_TOKEN: string,
	 *   TWITTER_ACCESS_TOKEN_SECRET: string
	 * }} env
	 */
	async fetch(request, env) {
		if (request.method === "OPTIONS") {
			let headers = is_preflight(request)
				? {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "POST",
					"Access-Control-Max-Age": "86400",
					"Access-Control-Allow-Headers": request.headers.get(
						"Access-Control-Request-Headers",
					),
				}
				: { Allow: "POST" };
			return new Response(null, { status: 204, headers });
		}

		if (request.method !== "POST") {
			return new Response(null, {
				status: 405,
				statusText: "method not allowed",
			});
		}

		let client = new Twitter({
			consumer: { key: env.TWITTER_API_KEY, secret: env.TWITTER_API_SECRET },
			token: {
				key: env.TWITTER_ACCESS_TOKEN,
				secret: env.TWITTER_ACCESS_TOKEN_SECRET,
			},
		});

		let url = await request.json()
			.then((body) => client.upload_media(body.data))
			.then((media) => client.tweet(media.media_id_string))
			.then((tweet) => tweet.entities.media[0].display_url);

		return new Response(JSON.stringify({ url }), {
			headers: {
				"content-type": "application/json",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST",
			},
		});
	},
};
