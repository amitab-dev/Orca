'use client'
import { ChevronLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { useRouter } from "next/navigation";

export default function NotFound() {
    const router = useRouter()
    return (
        <>
            <div className="w-full h-screen flex justify-center items-center flex-col space-y-3" >
                <div className="w-full flex justify-center items-center flex-col" >
                    <h1 className="text-4xl font-mono font-semibold">404</h1>
                    <p className="mt-2 text-gray-500">
                        Sorry, the page you are looking for does not exist.
                    </p>
                </div>
                <Button size={"lg"} variant={"secondary"} onClick={() => router.back()} >
                    <ChevronLeft />
                    Back
                </Button>
            </div>
        </>
    )
}