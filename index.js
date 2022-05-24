// @ts-check
import OAuth from "oauth-1.0a";
import HmacSHA1 from "crypto-js/hmac-sha1.js";
import Base64 from "crypto-js/enc-base64.js";

/**
 * @typedef Env
 * @prop {string} TWITTER_API_KEY
 * @prop {string} TWITTER_API_SECRET
 * @prop {string} TWITTER_ACCESS_TOKEN
 * @prop {string} TWITTER_ACCESS_TOKEN_SECRET
 */

/**
 * @typedef MediaUploadResponse
 * @prop {number} media_id
 * @prop {string} media_id_string
 * @prop {number} size
 * @prop {number} expires_after_secs
 * @prop {{ image_type: string, w: number, h: number }} image
 */

/**
 * Minimial typings of status update response... The actual payload is much much larger.
 *
 * @typedef StatusUpdateResponse
 * @prop {{ media: { display_url: string }[] }} entities
 */

class Twitter {
	/** @param {{ consumer: OAuth.Consumer, token: OAuth.Token }} options */
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
	 * @param {Record<string, string>} data
	 */
	async post(subdomain, resource, data) {
		let method = "POST";
		let url = `https://${subdomain}.twitter.com/1.1/${resource}`;
		let response = await fetch(url, {
			method,
			body: new URLSearchParams(data),
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"Accept": "application/json",
				...this.auth.toHeader(
					this.auth.authorize({ url, method, data }, this.token),
				),
			},
		});
		return response.json();
	}

	/**
	 * @param {string} media base64 encoded media
	 * @return {Promise<MediaUploadResponse>}
	 */
	upload(media) {
		return this.post("upload", "media/upload.json", { media });
	}

	/**
	 * @param {string} status
	 * @param {string=} media_id
	 * @return {Promise<StatusUpdateResponse>}
	 */
	tweet(status, media_id) {
		return this.post("api", "statuses/update.json", {
			status,
			media_ids: media_id,
		});
	}
}

export default {
	/**
	 * Cloudflare Worker [Module](https://developers.cloudflare.com/workers/wrangler/module-system/)
	 *
	 * @param {Request} request
	 * @param {Env} env
	 */
	async fetch(request, env) {
		if (request.method === "OPTIONS") {
			let headers = new Headers();
			// Check if we are dealing with a CORS preflight request (https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)
			if (
				request.headers.get("Origin") !== null &&
				request.headers.get("Access-Control-Request-Method") !== null &&
				request.headers.get("Access-Control-Request-Headers") !== null
			) {
				headers.append("Access-Control-Allow-Origin", "*");
				headers.append("Access-Control-Allow-Methods", "POST");
				headers.append("Access-Control-Max-Age", "86400");
				headers.append(
					"Access-Control-Allow-Headers",
					request.headers.get("Access-Control-Request-Headers"),
				);
			} else {
				headers.append("Allow", "POST");
			}
			return new Response(null, { status: 204, headers });
		}

		if (request.method !== "POST") {
			return new Response(null, {
				status: 405,
				statusText: "method not allowed",
			});
		}

		let client = new Twitter({
			consumer: {
				key: env.TWITTER_API_KEY,
				secret: env.TWITTER_API_SECRET,
			},
			token: {
				key: env.TWITTER_ACCESS_TOKEN,
				secret: env.TWITTER_ACCESS_TOKEN_SECRET,
			},
		});

		let url = await request.json()
			.then((json) => client.upload(json.data))
			.then((media) => client.tweet("BioVis Copy", media.media_id_string))
			.then((tweet) => tweet.entities.media[0].display_url);

		return new Response(JSON.stringify({ url }), {
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST",
			},
		});
	},
};
