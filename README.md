# dma

This project uses **Vercel Blob** for file storage.

## Environment Variables

Set `BLOB_READ_WRITE_TOKEN` in your environment. It must be a Vercel Blob read/write token. The upload API refuses requests when this variable is missing.

## Upload Flow

Files are uploaded directly from the browser using a presigned URL. The browser first requests `/api/upload-blob` to obtain a presigned `uploadUrl`. It then `PUT`s the file to that URL and finally notifies the server once the upload is finished. See `app/page.tsx` and `app/api/upload-blob/route.ts` for implementation details.
