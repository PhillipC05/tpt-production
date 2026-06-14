"use client";

import { useState, FormEvent } from "react";
import { Button } from "@tpt/ui/button";
import { Input } from "@tpt/ui/input";
import { Label } from "@tpt/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@tpt/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const FILE_TYPES = ["STL", "OBJ", "3MF", "STEP"] as const;
type FileType = (typeof FILE_TYPES)[number];

interface UploadResponse {
  uploadUrl: string;
  fileId: string;
  fileName: string;
}

export default function DesignUploadPage() {
  const [uploaderId, setUploaderId] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<FileType>("STL");
  const [drmEnabled, setDrmEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadedFileId, setUploadedFileId] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("uploading");
    setErrorMessage("");

    try {
      // Step 1: Request upload URL from API
      const res = await fetch(`${API_URL}/designs/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploaderId,
          fileName: fileName || `design.${fileType.toLowerCase()}`,
          fileType,
          drmEnabled,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Request failed: ${res.status}`);
      }

      const data: UploadResponse = await res.json();

      // Step 2: PUT placeholder file to the returned upload URL
      await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Blob(["placeholder"], { type: "application/octet-stream" }),
      });

      setUploadedFileId(data.fileId);
      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="container py-12 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Upload Successful</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your design file has been uploaded successfully.
            </p>
            {uploadedFileId && (
              <p className="text-xs font-mono bg-muted rounded px-2 py-1">
                File ID: {uploadedFileId}
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setStatus("idle");
                setUploaderId("");
                setFileName("");
                setFileType("STL");
                setDrmEnabled(false);
                setUploadedFileId("");
              }}
            >
              Upload Another
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Upload Design File</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <Label htmlFor="uploaderId">Uploader ID <span className="text-destructive">*</span></Label>
              <Input
                id="uploaderId"
                value={uploaderId}
                onChange={(e) => setUploaderId(e.target.value)}
                placeholder="Your user ID"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="fileName">File Name</Label>
              <Input
                id="fileName"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="my-design"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use a default name based on file type.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="fileType">File Type</Label>
              <select
                id="fileType"
                value={fileType}
                onChange={(e) => setFileType(e.target.value as FileType)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {FILE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="drmEnabled"
                type="checkbox"
                checked={drmEnabled}
                onChange={(e) => setDrmEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <Label htmlFor="drmEnabled" className="cursor-pointer">
                Enable DRM Protection
              </Label>
            </div>

            {status === "error" && (
              <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                {errorMessage}
              </p>
            )}

            <Button type="submit" disabled={status === "uploading"} className="w-full">
              {status === "uploading" ? "Uploading..." : "Upload Design"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
