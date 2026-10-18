'use client'

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"

export default function Home() {
    return (
        <>
            <Navbar />
            <div className="w-full h-[calc(100dvh-3.5rem)] flex justify-center items-center flex-col space-y-2 ">
                <p className="text-xl text-zinc-700/50" >
                    uh, oh looks like there is no connected repository
                </p>
                <div>
                    <Button size={"lg"} > Import your repository </Button>
                </div>
            </div>
        </>
    )
}
