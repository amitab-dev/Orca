"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";

export default function ProviderPopup() {
    return (
        <div className="w-full h-7 flex justify-between items-center bg-primary px-60">
            <div className="text-secondary text-sm flex justify-center items-center space-x-1">
                <p>Connect you remote repository and</p>
                <Link className="underline" href={"/profile#connect-vcs"}>
                    get started
                </Link>
                <ChevronRight className="size-4" />
            </div>
            <div className="w-1/12 flex justify-end">
                <Button onClick={() => console.log("true")}>
                    <X />
                </Button>
            </div>
        </div>
    );
}
