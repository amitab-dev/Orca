'use client'

import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useState } from "react"

export default function ProfilePage() {
    const [githubLoader, setGithubLoader] = useState(false)
    return (
        <>
            <div className="w-full h-screen flex justify-start items-center flex-col pt-16" >
                <div className="min-w-5xl h-auto py-5" >
                    <div className="w-full flex justify-between items-center" >
                        <div className="w-3/4 flex justify-center items-start flex-col" >
                            <h1 className="text-lg font-semibold" >
                                Connect your version control system
                            </h1>
                            <p className="text-sm text-zinc-500/60" >
                                connect and import your repositories and youre ready to go.
                            </p>
                        </div>
                        <div className="w-1/4 flex justify-center items-end flex-col space-y-2" >
                            <Button variant={"outline"} className={"w-40"} onClick={() => setGithubLoader(e => !e)} >
                                {
                                    githubLoader ? <span className="animate-spin" ><Loader2 /></span> : "Connect with GitHub"
                                }
                            </Button>
                            <Button variant={"outline"} className={"w-40"} >
                                Connect with GitLab
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
