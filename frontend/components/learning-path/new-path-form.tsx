"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, type LearningPathCreate, type LearningPathListItem } from "@/lib/api";

export function NewPathForm({
  token,
  onCreated,
  onCancel,
  compact = false,
}: {
  token: string;
  onCreated: (path: LearningPathListItem) => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Enter a path name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: LearningPathCreate = { title: trimmed };
      if (description.trim()) body.description = description.trim();
      const created = await apiFetch<LearningPathListItem>("/learning-paths", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      onCreated(created);
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create path");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4"}>
      <Input
        placeholder="Path name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 text-sm"
        autoFocus
      />
      {!compact && (
        <Input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-8 text-sm"
        />
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="button" size="sm" onClick={handleCreate} disabled={saving} className="flex-1">
          {saving ? (
            <>
              <Loader2 className="mr-1 size-3.5 animate-spin" />
              Creating…
            </>
          ) : (
            "Create path"
          )}
        </Button>
      </div>
    </div>
  );
}
