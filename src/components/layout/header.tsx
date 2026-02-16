"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessageSquare, Settings, Wrench, Gamepad2, Swords, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { useSettings } from "@/hooks/use-settings";

const navItems = [
  { href: "/conversations", label: "ARENA", icon: Swords, glow: "glow-cyan" },
  { href: "/tools", label: "POWER-UPS", icon: Zap, glow: "glow-yellow" },
];

export function Header() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: settings } = useSettings({ enabled: true });

  useEffect(() => {
    if (settings && !settings.OPENROUTER_API_KEY) {
      setSettingsOpen(true);
    }
  }, [settings]);

  return (
    <>
      <header className="border-b-2 border-primary bg-background/95">
        <div className="flex h-16 items-center px-6">
          {/* Logo */}
          <Link href="/" className="mr-8 flex items-center gap-3 group">
            <div className="relative">
              <Gamepad2 className="h-7 w-7 text-primary animate-arcade-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-pixel text-sm text-primary glow-pink tracking-wider">
                AGENT
              </span>
              <span className="font-pixel text-[10px] text-neon-cyan glow-cyan tracking-widest">
                ARCADE
              </span>
            </div>
          </Link>

          {/* Nav Items */}
          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 border-2 px-4 py-2 font-pixel text-xs transition-all",
                    isActive
                      ? "border-primary bg-primary/10 text-primary box-glow-pink"
                      : "border-muted text-muted-foreground hover:border-primary/50 hover:text-primary/80"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive && "animate-arcade-pulse")} />
                  <span className={cn(isActive && item.glow)}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground font-pixel">
              <span className="h-2 w-2 bg-neon-green animate-arcade-pulse" />
              <span className="text-[8px]">ONLINE</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              title="CONFIG"
              className="border-2 border-muted hover:border-neon-yellow hover:text-neon-yellow"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="h-[2px] bg-gradient-to-r from-neon-pink via-neon-cyan to-neon-green" />
      </header>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
