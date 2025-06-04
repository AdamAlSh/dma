import { NextResponse } from "next/server"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"

export async function POST(request: Request): Promise<NextResponse> {
  console.log("[upload-blob] Handler invoked.") // VERY FIRST LOG

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[upload-blob] CRITICAL: BLOB_READ_WRITE_TOKEN is not set.")
    return NextResponse.json({ error: "Server configuration error: Missing Blob token." }, { status: 500 })
  }
  console.log("[upload-blob] BLOB_READ_WRITE_TOKEN is present.")

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
    console.log("[upload-blob] Request body parsed:", { pathname: body.pathname })
  } catch (e: any) {
    console.error("[upload-blob] Error parsing request JSON:", e.message)
    return NextResponse.json({ error: `Invalid request body: ${e.message}` }, { status: 400 })
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string, clientPayload?: string) => {
        console.log(`[upload-blob] onBeforeGenerateToken for pathname: ${pathname}`)
        // Minimal token options
        return {
          allowedContentTypes: [
            // Keep this reasonably broad for testing
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "text/markdown",
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
          ],
          tokenPayload: JSON.stringify({
            originalPathname: pathname,
            clientPayload: clientPayload || null,
          }),
          addRandomSuffix: true, // Good practice
          cacheControlMaxAge: 3600, // 1 hour, can be adjusted
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("[upload-blob] Upload completed:", blob.pathname)
        if (tokenPayload) {
          const payload = JSON.parse(tokenPayload)
          console.log(`[upload-blob] Token payload on completion:`, payload)
        }
      },
    })
    console.log("[upload-blob] handleUpload successful, returning JSON response.")
    return NextResponse.json(jsonResponse)
  } catch (error: any) {
    console.error("[upload-blob] Error during handleUpload:", error.message, error.stack)
    return NextResponse.json({ error: `Blob upload processing failed: ${error.message}` }, { status: 500 })
  }
}

// Optional: Add a GET handler to test if the route file itself is reachable
export async function GET(request: Request): Promise<NextResponse> {
  console.log("[upload-blob] GET request received. Route is reachable.")
  return NextResponse.json({ message: "GET request to /api/upload-blob successful." })
}
