'use client'

import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"

export default function Home() {
    const router = useRouter()
    return (
        <>
        <div className="w-full h-screen flex justify-center items-center" >
            <Button onClick={() => router.push('/auth/register')} >
                Start <ChevronRight />
            </Button>
        </div>
        </>
    )
}
