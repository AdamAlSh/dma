import { NextResponse } from "next/server"
import { generateUploadUrl } from "@vercel/blob"

export async function POST(request: Request): Promise<NextResponse> {
  console.log("[upload-blob] Handler invoked.") // VERY FIRST LOG

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[upload-blob] CRITICAL: BLOB_READ_WRITE_TOKEN is not set.")
    return NextResponse.json({ error: "Server configuration error: Missing Blob token." }, { status: 500 })
  }
  console.log("[upload-blob] BLOB_READ_WRITE_TOKEN is present.")

  let body: any
  try {
    body = await request.json()
    console.log("[upload-blob] Request body parsed:", body)
  } catch (e: any) {
    console.error("[upload-blob] Error parsing request JSON:", e.message)
    return NextResponse.json({ error: `Invalid request body: ${e.message}` }, { status: 400 })
  }

  // If the client notifies that the upload completed, log the info and exit
  if (body.completed) {
    console.log("[upload-blob] Upload completed:", body.blob?.pathname)
    if (body.tokenPayload) {
      try {
        const payload = JSON.parse(body.tokenPayload)
        console.log("[upload-blob] Token payload on completion:", payload)
      } catch {
        console.log("[upload-blob] Token payload on completion:", body.tokenPayload)
      }
    }
    return NextResponse.json({ status: "ok" })
  }

  try {
    const { url: uploadUrl, tokenPayload } = await generateUploadUrl({
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      pathname: body.pathname || body.filename,
      contentType: body.contentType,
      addRandomSuffix: true,
    })
    console.log("[upload-blob] Generated upload URL for", body.pathname)
    return NextResponse.json({ uploadUrl, tokenPayload })
  } catch (error: any) {
    console.error("[upload-blob] Error generating upload URL:", error.message)
    return NextResponse.json({ error: `Blob upload processing failed: ${error.message}` }, { status: 500 })
  }
}

// Optional: Add a GET handler to test if the route file itself is reachable
export async function GET(request: Request): Promise<NextResponse> {
  console.log("[upload-blob] GET request received. Route is reachable.")
  return NextResponse.json({ message: "GET request to /api/upload-blob successful." })
}
