"use client";

import { useState } from "react";
import { useTools, useCreateTool, useUpdateTool, useDeleteTool } from "@/hooks/use-tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Zap, Shield } from "lucide-react";
import type { Tool } from "@/types";

export default function ToolsPage() {
  const { data: tools, isLoading } = useTools();
  const createTool = useCreateTool();
  const updateTool = useUpdateTool();
  const deleteTool = useDeleteTool();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    parameters: '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}',
    implementation: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      parameters: '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}',
      implementation: "",
    });
    setEditingTool(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (tool: Tool) => {
    setEditingTool(tool);
    setFormData({
      name: tool.name,
      description: tool.description,
      parameters: JSON.stringify(tool.parameters, null, 2),
      implementation: tool.implementation,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      let params: Record<string, unknown>;
      try {
        params = JSON.parse(formData.parameters);
      } catch {
        toast({
          title: "Invalid JSON",
          description: "Parameters must be valid JSON Schema",
          variant: "destructive",
        });
        return;
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        parameters: params,
        implementation: formData.implementation,
      };

      if (editingTool) {
        await updateTool.mutateAsync({
          toolId: editingTool.id,
          data: payload,
        });
        toast({ title: "Tool updated" });
      } else {
        await createTool.mutateAsync(payload);
        toast({ title: "Tool created" });
      }

      setDialogOpen(false);
      resetForm();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (tool: Tool) => {
    if (!confirm(`Delete tool "${tool.name}"?`)) return;
    try {
      await deleteTool.mutateAsync(tool.id);
      toast({ title: "Tool deleted" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="font-pixel text-sm text-neon-yellow glow-yellow animate-arcade-pulse">
          LOADING POWER-UPS...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-xl text-neon-yellow glow-yellow mb-2">
            POWER-UPS
          </h1>
          <p className="text-xl text-muted-foreground font-retro">
            Equip your agents with special abilities
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          <span className="font-pixel text-[9px]">CRAFT</span>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tools?.map((tool) => (
          <Card key={tool.id} className="transition-all hover:box-glow-yellow hover:border-neon-yellow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-neon-yellow" />
                  <CardTitle className="text-xs">{tool.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  {tool.isPredefined && (
                    <Badge variant="secondary" className="border-neon-cyan text-neon-cyan bg-neon-cyan/10">
                      <Shield className="h-2 w-2 mr-1" />
                      CORE
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription className="line-clamp-2 text-sm">
                {tool.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(tool)}
                  disabled={tool.isPredefined}
                  className="hover:border-neon-cyan hover:text-neon-cyan"
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  <span className="font-pixel text-[8px]">EDIT</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(tool)}
                  disabled={tool.isPredefined}
                  className="hover:border-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  <span className="font-pixel text-[8px]">DEL</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTool ? "MODIFY POWER-UP" : "CRAFT POWER-UP"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="font-pixel text-[8px] text-neon-cyan uppercase">Name</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="my_tool_name"
              />
            </div>

            <div>
              <Label className="font-pixel text-[8px] text-neon-cyan uppercase">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="What this power-up does..."
                rows={2}
              />
            </div>

            <div>
              <Label className="font-pixel text-[8px] text-neon-yellow uppercase">Parameters (JSON Schema)</Label>
              <Textarea
                value={formData.parameters}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, parameters: e.target.value }))
                }
                className="font-retro text-sm"
                rows={8}
              />
            </div>

            <div>
              <Label className="font-pixel text-[8px] text-neon-green uppercase">Implementation (JavaScript)</Label>
              <Textarea
                value={formData.implementation}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    implementation: e.target.value,
                  }))
                }
                className="font-retro text-sm"
                rows={12}
                placeholder={`// Access parameters via 'params' object\n// Use 'fetch' for HTTP requests\n// Use 'process.env' for environment variables\n// Return the result\n\nconst result = params.input;\nreturn { result };`}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              CANCEL
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createTool.isPending || updateTool.isPending}
            >
              {editingTool ? "UPDATE" : "CREATE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
