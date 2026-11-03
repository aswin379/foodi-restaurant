"use client"

import { useRef, useState } from "react"
import { Download, FileSpreadsheet, FileUp, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getAccessToken, getActiveRestaurantId } from "@/lib/api-client"

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000") + "/api/v1"

export function MenuExportImportButtons() {
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async (format: "xlsx" | "csv") => {
    setExporting(format)
    try {
      const token = getAccessToken()
      const restaurantId = getActiveRestaurantId()
      const headers: Record<string, string> = {
        "X-Requested-With": "foodi-seller",
      }
      if (token) headers["Authorization"] = `Bearer ${token}`
      if (restaurantId) headers["X-Seller-Id"] = String(restaurantId)

      const res = await fetch(`${API_BASE}/seller/menu/export?format=${format}`, {
        headers,
        credentials: "include",
      })

      if (!res.ok) throw new Error("Failed to export menu")

      if (format === "xlsx") {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `menu-${new Date().toISOString().slice(0, 10)}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const json = await res.json().catch(() => null)
        const csvContent = json?.data?.csv ?? ""
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `menu-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed")
    } finally {
      setExporting(null)
    }
  }

  const handleDownloadSample = async () => {
    try {
      const token = getAccessToken()
      const restaurantId = getActiveRestaurantId()
      const headers: Record<string, string> = {
        "X-Requested-With": "foodi-seller",
      }
      if (token) headers["Authorization"] = `Bearer ${token}`
      if (restaurantId) headers["X-Seller-Id"] = String(restaurantId)

      let res = await fetch(`${API_BASE}/seller/menu/export/sample`, {
        headers,
        credentials: "include",
      })

      if (!res.ok) {
        res = await fetch(`${API_BASE}/public/menu/sample`, {
          credentials: "include",
        })
      }

      if (!res.ok) throw new Error("Failed to download sample template")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `foodi-menu-sample.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed")
    }
  }

  const handleImportSubmit = async () => {
    if (!file) return
    setImporting(true)
    setStatusMsg(null)
    try {
      const token = getAccessToken()
      const restaurantId = getActiveRestaurantId()
      const formData = new FormData()
      formData.append("file", file)

      const headers: Record<string, string> = {
        "X-Requested-With": "foodi-seller",
      }
      if (token) headers["Authorization"] = `Bearer ${token}`
      if (restaurantId) headers["X-Seller-Id"] = String(restaurantId)

      const res = await fetch(`${API_BASE}/seller/menu/import`, {
        method: "POST",
        headers,
        credentials: "include",
        body: formData,
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || "Import failed")
      }

      const summary = json.data
      setStatusMsg({
        type: "success",
        text: `Successfully imported ${summary.created ?? 0} items! (${summary.failed ?? 0} failed)`,
      })
      setTimeout(() => {
        window.location.reload()
      }, 1200)
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Import failed",
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Button
        asChild
        variant="outline"
        size="sm"
        title="Download pre-filled dummy Excel template with sample dishes and column guide"
      >
        <a href="/foodi-menu-sample.xlsx" download="foodi-menu-sample.xlsx">
          <FileSpreadsheet className="mr-1 size-4 text-emerald-600" />
          Dummy Excel
        </a>
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={exporting !== null}
        onClick={() => handleExport("xlsx")}
      >
        {exporting === "xlsx" ? <Loader2 className="mr-1 size-4 animate-spin" /> : <FileSpreadsheet className="mr-1 size-4" />}
        Export Excel
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={exporting !== null}
        onClick={() => handleExport("csv")}
      >
        {exporting === "csv" ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Download className="mr-1 size-4" />}
        Export CSV
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setStatusMsg(null)
          setFile(null)
          setImportOpen(true)
        }}
      >
        <FileUp className="mr-1 size-4" />
        Import Menu
      </Button>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Menu Items</DialogTitle>
            <DialogDescription>
              Upload an Excel (.xlsx) or CSV file containing your menu dishes, categories, and prices.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-3">
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/40 p-3 text-xs">
              <div>
                <p className="font-semibold text-foreground">Need a sample template?</p>
                <p className="text-muted-foreground mt-0.5">Download our pre-filled dummy Excel file to see the format.</p>
              </div>
              <Button asChild type="button" variant="outline" size="sm">
                <a href="/foodi-menu-sample.xlsx" download="foodi-menu-sample.xlsx">
                  <Download className="mr-1.5 size-3.5" /> Sample Excel
                </a>
              </Button>
            </div>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/50 cursor-pointer"
            >
              <FileUp className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm font-medium">Click to select an Excel or CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx or .csv up to 10 MB</p>
              {file && (
                <p className="mt-3 text-xs font-semibold text-primary truncate max-w-xs">
                  Selected: {file.name}
                </p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0]
                if (picked) setFile(picked)
              }}
            />

            {statusMsg && (
              <p
                className={`rounded-lg p-2.5 text-xs font-medium ${
                  statusMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                {statusMsg.text}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={handleImportSubmit} disabled={!file || importing}>
              {importing && <Loader2 className="mr-1 size-4 animate-spin" />}
              Upload & Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

