'use client'

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import axios from "axios"
import { useEffect, useState } from "react"

export default function Home() {
    const [loading, setLoading] = useState(false)
    const getUserWokspaces = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}`)
        } catch (error) {
            
        } finally {
            setLoading(true)
        }
    }

    useEffect(() => {
        getUserWokspaces()
    }, [])

    return (
        <>
            <Navbar />
            <div className="w-full h-[calc(100dvh-3.5rem)] flex justify-center items-center flex-col space-y-2 ">
                <p className="text-xl text-zinc-700/50" >
                    uh, oh looks like there is no workspace
                </p>
                <div>
                    <Button size={"lg"} > Create a workspace </Button>
                </div>
            </div>
        </>
    )
}
