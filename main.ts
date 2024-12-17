const kv = await Deno.openKv()

interface EventBody {
	event: string
	eventSessionId: string
	data: {
		referredFrom?: string
		selectedItemsData?: object
		cartContents?: object
		url?: string
	}
}

const isValid = (body: EventBody) => {
	if (typeof body !== "object") return false

	// Confirm body has valid event name
	if (typeof body.event !== "string" || ["pageLoad", "addToCart"].includes(body.event) === false) return false

	// Confirm body has valid eventSessionId
	if (typeof body.eventSessionId !== "string") return false

	// Confirm body has data property
	if (typeof body.data !== "object") return false

	// Confirm data has valid props
	if (body.event === "pageLoad") {
		if (typeof body.data.referredFrom !== "string") return false
	} else if (body.event === "addToCart") {
		if (!body.data.selectedItemsData || typeof body.data.url !== "string") {
			return false
		}
	}

	return true
}

const endpoint = async (request: Request) => {
	// If request method is not GET or POST, return 405
	if (!["GET", "POST", "OPTIONS"].includes(request.method))
		return new Response("Method not allowed", { status: 405 })

	// If request method is OPTIONS, return 200
	if (request.method === "OPTIONS")
		return new Response(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
				"Access-Control-Allow-Headers": "*"
			}
		})

	// If GET request, return all logs from KV
	if (request.method === "GET") {
		try {
			const logArray = []
			const logs = kv.list({ prefix: ["event"] })
			for await (const entry of logs) {
				logArray.push(entry.value)
			}
	
			return new Response(JSON.stringify(logArray), {
				headers: {
					"content-type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			})
		} catch (error) {
			console.error(error)
			return new Response("Internal server error", { status: 500 })
		}
	}

	// If POST request, parse the body, validate, and log the event
	try {
		const body = await request.json()

		if (!isValid(body)) return new Response("Request is invalid", { status: 400 })

		const dateSubmitted = new Date().toISOString()

		const log = {
			...body,
			dateSubmitted			
		}

		console.log("Logging event:", log)

		await kv.set(["event", body.event, dateSubmitted], log)
		return new Response("Log recieved", { 
			status: 200,
			headers: {
				"content-type": "application/json",
				"Access-Control-Allow-Origin": "*"
			}
		})
	} catch (error) {
		console.error(error)
		return new Response("Internal server error", { status: 500 })
	}
}

Deno.serve(endpoint)
