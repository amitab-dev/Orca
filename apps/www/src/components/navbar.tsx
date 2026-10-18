"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Loader2, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

export function Navbar() {
    const [signingOut, setSigningOut] = useState(false);
    const router = useRouter();

    const handleSignOut = async () => {
        setSigningOut(true);
        try {
            await api.post("/api/v1/auth/logout");
        } catch {
            toast.error("Failed to sign out cleanly");
        } finally {
            setSigningOut(false);
            router.replace("/auth/login");
            router.refresh();
        }
    };

    return (
        <nav className="w-full h-14 px-60 flex justify-between items-center border-b border-zinc-950/10">
            <Link href={"/home"} className="font-semibold tracking-tight text-xl">
                ORCA
            </Link>
            <div className="flex items-center space-x-3">
                <Button
                    variant={"ghost"}
                    size={"sm"}
                    disabled={signingOut}
                    onClick={handleSignOut}
                >
                    {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                    Sign out
                </Button>
            </div>
        </nav>
    );
}
