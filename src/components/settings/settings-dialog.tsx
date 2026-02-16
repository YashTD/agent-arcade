"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { toast } from "@/components/ui/use-toast";

interface SettingsField {
  key: string;
  label: string;
  type: "text" | "password";
  readOnly?: boolean;
  description?: string;
  placeholder?: string;
}

const FIELDS: SettingsField[] = [
  {
    key: "OPENROUTER_API_KEY",
    label: "OpenRouter API Key",
    type: "password"
  },
  {
    key: "ORCHESTRATOR_MODEL",
    label: "Orchestrator Model",
    type: "text",
    description: "Default model for the orchestrator",
  },
  {
    key: "GMAIL_USER",
    label: "Gmail User",
    type: "text",
  },
  {
    key: "GMAIL_APP_PASSWORD",
    label: "Gmail App Password",
    type: "password",
  },
  {
    key: "BRAVE_SEARCH_API_KEY",
    label: "Brave Search API Key",
    type: "password"
  },
  {
    key: "SCRATCHPAD_FILE_PATH",
    label: "Scratchpad File Path",
    type: "text",
  },
  {
    key: "DATABASE_URL",
    label: "Database URL",
    type: "text",
    readOnly: true,
    description: "SQLite database file path (requires restart)",
  },
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { data, refetch, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  useEffect(() => {
    if (data) {
      setValues(data);
    }
  }, [data]);

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    try {
      await updateSettings.mutateAsync(values);
      toast({ title: "Settings saved", description: "Configuration updated successfully." });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save settings",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CONFIG</DialogTitle>
          <DialogDescription>
            Edit environment variables. Changes take effect immediately except
            for Database URL which requires a restart.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center font-pixel text-xs text-primary animate-arcade-pulse">
            LOADING CONFIG...
          </div>
        ) : (
          <div className="space-y-4">
            {FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key} className="font-pixel text-[8px] text-neon-cyan uppercase">
                  {field.label}
                </Label>
                <Input
                  id={field.key}
                  type={field.type}
                  value={values[field.key] ?? ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  readOnly={field.readOnly}
                  placeholder={field.placeholder}
                  className={field.readOnly ? "opacity-60" : ""}
                />
                {field.description && (
                  <p className="text-sm text-muted-foreground font-retro">
                    {field.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            CANCEL
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending || isLoading}
          >
            {updateSettings.isPending ? "SAVING..." : "SAVE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
