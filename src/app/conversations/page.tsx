"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSessions, useCreateSession, useDeleteSession } from "@/hooks/use-sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Users, Swords, Gamepad2, Trophy, Joystick } from "lucide-react";

const statusConfig: Record<string, { class: string; label: string }> = {
  SETUP: { class: "border-neon-yellow text-neon-yellow bg-neon-yellow/10", label: "SETUP" },
  ACTIVE: { class: "border-neon-green text-neon-green bg-neon-green/10 animate-arcade-pulse", label: "LIVE" },
  PAUSED: { class: "border-neon-cyan text-neon-cyan bg-neon-cyan/10", label: "PAUSE" },
  COMPLETED: { class: "border-muted-foreground text-muted-foreground bg-muted/20", label: "GG" },
};

export default function ConversationsPage() {
  const router = useRouter();
  const { data: sessions, isLoading } = useSessions();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    turnOrder: "ROUND_ROBIN" as string,
    memoryStrategy: "SLIDING_WINDOW" as string,
    memoryWindowSize: 50,
  });

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Name required",
        variant: "destructive",
      });
      return;
    }

    try {
      const session = await createSession.mutateAsync({
        name: formData.name,
        turnOrder: formData.turnOrder as "ROUND_ROBIN" | "MANUAL" | "ORCHESTRATED",
        memoryStrategy: formData.memoryStrategy as "SLIDING_WINDOW" | "SUMMARIZATION",
        memoryWindowSize: formData.memoryWindowSize,
      });
      setDialogOpen(false);
      setFormData({
        name: "",
        turnOrder: "ROUND_ROBIN",
        memoryStrategy: "SLIDING_WINDOW",
        memoryWindowSize: 50,
      });
      router.push(`/conversations/${session.id}`);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (sessionId: string, name: string) => {
    if (!confirm(`Delete session "${name}"? This cannot be undone.`)) return;
    try {
      await deleteSession.mutateAsync(sessionId);
      toast({ title: "Session deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="font-pixel text-sm text-primary glow-pink animate-arcade-pulse">
          LOADING...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-xl text-primary glow-pink mb-2">
            SELECT GAME
          </h1>
          <p className="text-xl text-muted-foreground font-retro">
            Choose a battle arena or create a new one
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="font-pixel">
          <Plus className="mr-2 h-4 w-4" />
          NEW GAME
        </Button>
      </div>

      {/* Empty State */}
      {sessions?.length === 0 && (
        <div className="relative flex flex-col items-center justify-center border-2 border-dashed border-primary/40 p-16 text-center overflow-hidden">
          <Gamepad2 className="mb-6 h-16 w-16 text-primary animate-arcade-pulse" />
          <h3 className="mb-3 font-pixel text-sm text-primary glow-pink">
            NO GAMES FOUND
          </h3>
          <p className="mb-6 text-xl text-muted-foreground font-retro">
            INSERT COIN TO START
          </p>
          <Button onClick={() => setDialogOpen(true)} className="font-pixel animate-arcade-pulse">
            <Plus className="mr-2 h-4 w-4" />
            INSERT COIN
          </Button>
        </div>
      )}

      {/* Session Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sessions?.map((session: any) => {
          const status = statusConfig[session.status] || statusConfig.SETUP;
          return (
            <Card
              key={session.id}
              className="cursor-pointer transition-all hover:box-glow-pink hover:border-primary group"
              onClick={() => router.push(`/conversations/${session.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Swords className="h-4 w-4 text-primary" />
                    <CardTitle className="text-xs">{session.name}</CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className={status.class}
                  >
                    {status.label}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-4 text-sm mt-2">
                  <span className="flex items-center gap-1 text-neon-cyan">
                    <Users className="h-3 w-3" />
                    {session.agents?.length || 0} PLAYERS
                  </span>
                  <span className="text-neon-yellow">
                    <Trophy className="h-3 w-3 inline mr-1" />
                    {session._count?.messages || 0} MSG
                  </span>
                  <span className="text-neon-green">
                    {session.turnOrder.replace("_", " ")}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-retro">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:text-destructive hover:border-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(session.id, session.name);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* New Session Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>NEW GAME</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="session-name" className="font-pixel text-[10px] text-neon-cyan uppercase">
                Arena Name
              </Label>
              <Input
                id="session-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Enter arena name..."
              />
            </div>

            <div>
              <Label className="font-pixel text-[10px] text-neon-cyan uppercase">Turn Order</Label>
              <Select
                value={formData.turnOrder}
                onValueChange={(v) =>
                  setFormData((f) => ({ ...f, turnOrder: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="ORCHESTRATED">Orchestrated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-pixel text-[10px] text-neon-cyan uppercase">Memory Strategy</Label>
              <Select
                value={formData.memoryStrategy}
                onValueChange={(v) =>
                  setFormData((f) => ({ ...f, memoryStrategy: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SLIDING_WINDOW">
                    Sliding Window
                  </SelectItem>
                  <SelectItem value="SUMMARIZATION">Summarization</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.memoryStrategy === "SLIDING_WINDOW" && (
              <div>
                <Label htmlFor="window-size" className="font-pixel text-[10px] text-neon-cyan uppercase">
                  Window Size
                </Label>
                <Input
                  id="window-size"
                  type="number"
                  value={formData.memoryWindowSize}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      memoryWindowSize: parseInt(e.target.value) || 50,
                    }))
                  }
                  min={10}
                  max={200}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              CANCEL
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createSession.isPending}
            >
              START GAME
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
